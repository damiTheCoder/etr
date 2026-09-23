"""
OCR Engine for document processing.
Provides multi-tier resilient document extraction:
1. Local PaddleOCR engine (when installed with supported Python 3.9-3.13)
2. PaddleOCR Cloud API (when PADDLEOCR_ACCESS_TOKEN is configured)
3. Direct digital text extraction via PyMuPDF / pypdf (for text-based PDFs)
4. Graceful error reporting (never crashes or unhandled exceptions)

P0-FIX-2: Prompt injection sanitization
P0-FIX-5: Scanned PDF detection and rasterization fallback
"""
import os
import re
import json
import base64
import logging
import threading
import tempfile
from typing import Optional

logger = logging.getLogger(__name__)

# --- Safe imports for document extraction ---
try:
    from paddleocr import PaddleOCR
    PADDLEOCR_AVAILABLE = True
except ImportError:
    PADDLEOCR_AVAILABLE = False
    logger.warning("PaddleOCR not installed locally. Falling back to cloud API / text extraction.")

try:
    import pymupdf as fitz
except ImportError:
    try:
        import fitz
    except ImportError:
        fitz = None

try:
    import pypdf
except ImportError:
    pypdf = None

# --- Lazy-loaded singletons (thread-safe) ---
_ocr_engine = None
_ocr_lock = threading.Lock()
_init_lock = threading.Lock()

# P0-FIX-2: Injection patterns to redact from OCR output
_INJECTION_PATTERNS = [
    re.compile(r'ignore.*previous.*instruction', re.IGNORECASE),
    re.compile(r'you\s+are\s+now', re.IGNORECASE),
    re.compile(r'system\s*prompt', re.IGNORECASE),
    re.compile(r'admin\s*mode', re.IGNORECASE),
    re.compile(r'forget.*everything', re.IGNORECASE),
    re.compile(r'new\s+instruction', re.IGNORECASE),
    re.compile(r'disregard.*above', re.IGNORECASE),
]

REDACTED_MARKER = "[REDACTED — potential injection]"


def _get_ocr_engine():
    """Lazy-load PaddleOCR. Returns None if not installed or fails."""
    global _ocr_engine
    if _ocr_engine is not None:
        return _ocr_engine
    with _init_lock:
        if _ocr_engine is not None:
            return _ocr_engine
        try:
            from paddleocr import PaddleOCR
            _ocr_engine = PaddleOCR(use_angle_cls=True, lang="en", show_log=False)
            logger.info("PaddleOCR engine loaded successfully")
            return _ocr_engine
        except ImportError:
            logger.warning("PaddleOCR not installed. Install with: pip install paddlepaddle paddleocr")
            return None
        except Exception as e:
            logger.error("Failed to initialize PaddleOCR: %s", e)
            return None


def _is_scanned_pdf(file_path: str) -> bool:
    """
    P0-FIX-5: Check if a PDF has extractable text.
    Returns True if the PDF is scanned/rasterized (no selectable text).
    """
    if fitz is not None:
        try:
            doc = fitz.open(file_path)
            for page in doc[:3]:  # Check first 3 pages
                text = page.get_text("text") or ""
                if len(text.strip()) > 20:
                    doc.close()
                    return False  # Has real text
            doc.close()
            return True
        except Exception as e:
            logger.warning("fitz error checking PDF text: %s", e)

    if pypdf is not None:
        try:
            reader = pypdf.PdfReader(file_path)
            for page in reader.pages[:3]:
                text = page.extract_text() or ""
                if len(text.strip()) > 20:
                    return False
            return True
        except Exception as e:
            logger.warning("pypdf error checking PDF text: %s", e)

    return False


def _rasterize_pdf(file_path: str) -> list[str]:
    """
    P0-FIX-5: Convert scanned PDF pages to temporary PNG images for OCR.
    Returns list of temp image file paths.
    """
    temp_images = []
    if fitz is None:
        logger.error("PyMuPDF (fitz) not installed — cannot rasterize scanned PDFs")
        return temp_images

    try:
        doc = fitz.open(file_path)
        for page_num in range(len(doc)):
            page = doc[page_num]
            pix = page.get_pixmap(dpi=300)
            tmp = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
            pix.save(tmp.name)
            temp_images.append(tmp.name)
        doc.close()
    except Exception as e:
        logger.error("Error rasterizing PDF: %s", e)
    return temp_images


def sanitize_ocr_output(lines: list[str]) -> tuple[list[str], list[int]]:
    """
    P0-FIX-2: Strip LLM injection patterns from OCR output.
    Returns (sanitized_lines, list_of_redacted_indices).
    """
    sanitized = []
    redacted_indices = []
    for i, line in enumerate(lines):
        is_injection = any(pat.search(line) for pat in _INJECTION_PATTERNS)
        if is_injection:
            sanitized.append(REDACTED_MARKER)
            redacted_indices.append(i)
            logger.warning("Redacted potential injection at line %d", i)
        else:
            sanitized.append(line)
    return sanitized, redacted_indices


def _get_page_count(file_path: str) -> int:
    """Get the number of pages in a PDF."""
    ext = os.path.splitext(file_path)[1].lower()
    if ext != ".pdf":
        return 1
    if fitz is not None:
        try:
            doc = fitz.open(file_path)
            count = len(doc)
            doc.close()
            return count
        except Exception:
            pass
    if pypdf is not None:
        try:
            reader = pypdf.PdfReader(file_path)
            return len(reader.pages)
        except Exception:
            pass
    return 1


def _extract_with_paddleocr(file_path: str) -> dict:
    """Extract document text using local PaddleOCR engine."""
    result = {
        "raw_lines": [],
        "confidence_scores": [],
        "raw_text": "",
        "page_count": _get_page_count(file_path),
        "error": None,
    }
    engine = _get_ocr_engine()
    if engine is None:
        result["error"] = "PaddleOCR is not installed. Install with: pip install paddlepaddle paddleocr"
        return result

    ext = os.path.splitext(file_path)[1].lower()
    temp_images = []
    try:
        if ext == ".pdf":
            if _is_scanned_pdf(file_path):
                logger.info("Scanned PDF detected — rasterizing pages for local OCR")
                temp_images = _rasterize_pdf(file_path)
                if not temp_images:
                    result["error"] = "Failed to rasterize scanned PDF. Install PyMuPDF: pip install pymupdf"
                    return result
                files_to_ocr = temp_images
            else:
                files_to_ocr = [file_path]
        else:
            files_to_ocr = [file_path]

        raw_lines = []
        confidence_scores = []

        for fpath in files_to_ocr:
            with _ocr_lock:
                ocr_result = engine.ocr(fpath, cls=True)

            if ocr_result is None:
                continue

            for page in ocr_result:
                if page is None:
                    continue
                for line in page:
                    if line and len(line) >= 2:
                        text = line[1][0] if isinstance(line[1], (list, tuple)) else str(line[1])
                        conf = float(line[1][1]) if isinstance(line[1], (list, tuple)) and len(line[1]) > 1 else 0.0
                        raw_lines.append(text)
                        confidence_scores.append(round(conf, 4))

        sanitized_lines, redacted_indices = sanitize_ocr_output(raw_lines)
        for idx in redacted_indices:
            confidence_scores[idx] = 0.0

        result["raw_lines"] = sanitized_lines
        result["confidence_scores"] = confidence_scores
        result["raw_text"] = "\n".join(sanitized_lines)

    except Exception as e:
        logger.error("Local PaddleOCR extraction failed: %s", e, exc_info=True)
        result["error"] = f"OCR extraction failed: {str(e)}"
    finally:
        for tmp in temp_images:
            try:
                os.remove(tmp)
            except OSError:
                pass

    return result


def _extract_with_cloud_api(file_path: str) -> dict:
    """Extract document text using PaddleOCR Cloud API."""
    token = os.getenv("PADDLEOCR_ACCESS_TOKEN", "").strip()
    if not token:
        return {"error": "PADDLEOCR_ACCESS_TOKEN is not configured."}

    api_url = os.getenv("PADDLEOCR_API_URL", "https://aistudio.baidu.com/paddleocr/api/v1/ocr")
    page_count = _get_page_count(file_path)
    result = {
        "raw_lines": [],
        "confidence_scores": [],
        "raw_text": "",
        "page_count": page_count,
        "error": None,
    }

    try:
        import httpx
    except ImportError:
        try:
            import requests as httpx
        except ImportError:
            return {"error": "Neither httpx nor requests is available for Cloud OCR."}

    ext = os.path.splitext(file_path)[1].lower()
    temp_images = []
    files_to_send = []

    try:
        if ext == ".pdf":
            temp_images = _rasterize_pdf(file_path)
            if not temp_images:
                files_to_send = [file_path]
            else:
                files_to_send = temp_images
        else:
            files_to_send = [file_path]

        headers = {
            "token": token,
            "Authorization": f"token {token}",
        }

        all_lines = []
        all_confidences = []

        with httpx.Client(timeout=30.0) as client:
            for fpath in files_to_send:
                with open(fpath, "rb") as f:
                    file_bytes = f.read()

                b64_data = base64.b64encode(file_bytes).decode("utf-8")
                payload = {"image": b64_data}

                resp = client.post(api_url, json=payload, headers=headers)
                if resp.status_code != 200:
                    logger.warning("PaddleOCR Cloud API HTTP %d: %s", resp.status_code, resp.text[:200])
                    result["error"] = f"Cloud OCR HTTP error: {resp.status_code}"
                    return result

                data = resp.json()
                # Parse Baidu / PaddleX format
                # Common response formats:
                # 1. {"result": [{"text": "...", "confidence": 0.99}, ...]}
                # 2. {"results": [[{"text": "...", "score": 0.99}, ...]]}
                # 3. {"data": [{"words": "...", "probability": 0.99}, ...]}
                items = data.get("result") or data.get("results") or data.get("data") or []
                if isinstance(items, list):
                    for item in items:
                        if isinstance(item, list):
                            for sub in item:
                                t = sub.get("text") or sub.get("words") or ""
                                c = float(sub.get("confidence") or sub.get("score") or sub.get("probability") or 0.95)
                                if t:
                                    all_lines.append(t)
                                    all_confidences.append(round(c, 4))
                        elif isinstance(item, dict):
                            t = item.get("text") or item.get("words") or ""
                            c = float(item.get("confidence") or item.get("score") or item.get("probability") or 0.95)
                            if t:
                                all_lines.append(t)
                                all_confidences.append(round(c, 4))

        sanitized_lines, redacted_indices = sanitize_ocr_output(all_lines)
        for idx in redacted_indices:
            all_confidences[idx] = 0.0

        result["raw_lines"] = sanitized_lines
        result["confidence_scores"] = all_confidences
        result["raw_text"] = "\n".join(sanitized_lines)

    except Exception as e:
        logger.error("PaddleOCR Cloud API call failed: %s", e, exc_info=True)
        result["error"] = f"PaddleOCR Cloud API failed: {str(e)}"
    finally:
        for tmp in temp_images:
            try:
                os.remove(tmp)
            except OSError:
                pass

    return result


def _extract_with_text_engine(file_path: str) -> dict:
    """
    Direct text extraction fallback for text-based PDFs using PyMuPDF (fitz) or pypdf.
    Extracted digital text has 1.0 confidence.
    """
    page_count = _get_page_count(file_path)
    result = {
        "raw_lines": [],
        "confidence_scores": [],
        "raw_text": "",
        "page_count": page_count,
        "error": None,
        "engine": "text_extraction",
    }
    raw_lines = []

    # 1. Try PyMuPDF (fitz)
    if fitz is not None:
        try:
            doc = fitz.open(file_path)
            for page in doc:
                text = page.get_text("text") or ""
                for line in text.splitlines():
                    stripped = line.strip()
                    if stripped:
                        raw_lines.append(stripped)
            doc.close()
        except Exception as e:
            logger.warning("PyMuPDF text extraction failed: %s", e)

    # 2. Try pypdf fallback if raw_lines is still empty
    if not raw_lines and pypdf is not None:
        try:
            reader = pypdf.PdfReader(file_path)
            for page in reader.pages:
                text = page.extract_text() or ""
                for line in text.splitlines():
                    stripped = line.strip()
                    if stripped:
                        raw_lines.append(stripped)
        except Exception as e:
            logger.warning("pypdf text extraction failed: %s", e)

    if not raw_lines:
        result["error"] = "No extractable text found in PDF."
        return result

    sanitized_lines, redacted_indices = sanitize_ocr_output(raw_lines)
    confidence_scores = [1.0] * len(sanitized_lines)
    for idx in redacted_indices:
        confidence_scores[idx] = 0.0

    result["raw_lines"] = sanitized_lines
    result["confidence_scores"] = confidence_scores
    result["raw_text"] = "\n".join(sanitized_lines)
    return result


def extract_document(file_path: str) -> dict:
    """
    Extract text from a PDF or image file with a resilient fallback chain:
    1. Local PaddleOCR (when installed and running in supported Python 3.9-3.13)
    2. Cloud PaddleOCR API (when PADDLEOCR_ACCESS_TOKEN is provided)
    3. Direct digital text extraction via PyMuPDF / pypdf (for text-based PDFs)
    4. Informative error return (never raises uncaught exceptions)
    """
    result = {
        "raw_lines": [],
        "confidence_scores": [],
        "raw_text": "",
        "page_count": 0,
        "error": None,
    }

    if not os.path.isfile(file_path):
        result["error"] = f"File not found: {file_path}"
        return result

    ext = os.path.splitext(file_path)[1].lower()
    if ext not in (".pdf", ".jpg", ".jpeg", ".png"):
        result["error"] = f"Unsupported file type: {ext}"
        return result

    # 1. Try local PaddleOCR if installed
    if PADDLEOCR_AVAILABLE:
        paddle_res = _extract_with_paddleocr(file_path)
        if paddle_res.get("raw_lines") and not paddle_res.get("error"):
            return paddle_res
        logger.warning("Local PaddleOCR yielded no lines or error (%s), continuing fallback...", paddle_res.get("error"))

    # 2. Try Cloud API if token is configured
    if os.getenv("PADDLEOCR_ACCESS_TOKEN"):
        cloud_res = _extract_with_cloud_api(file_path)
        if cloud_res.get("raw_lines") and not cloud_res.get("error"):
            return cloud_res
        logger.warning("Cloud PaddleOCR failed (%s), continuing fallback...", cloud_res.get("error"))

    # 3. Try direct digital text extraction for PDFs
    if ext == ".pdf":
        text_res = _extract_with_text_engine(file_path)
        if text_res.get("raw_lines") and not text_res.get("error"):
            return text_res
        logger.warning("Text extraction yielded no lines (%s)", text_res.get("error"))

    # 4. All methods failed — return clear error message
    page_cnt = _get_page_count(file_path)
    return {
        "raw_lines": [],
        "confidence_scores": [],
        "raw_text": "",
        "page_count": page_cnt,
        "error": (
            "No OCR engine available. Install PaddleOCR locally "
            "(pip install paddlepaddle paddleocr) or configure "
            "PADDLEOCR_ACCESS_TOKEN for cloud API."
        )
    }
