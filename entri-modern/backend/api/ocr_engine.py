"""
OCR Engine for document processing.
Uses PaddleOCR for text extraction from bank statements, invoices, and vouchers.

P0-FIX-2: Prompt injection sanitization
P0-FIX-5: Scanned PDF detection and rasterization fallback
"""
import os
import re
import logging
import threading
import tempfile
from typing import Optional

logger = logging.getLogger(__name__)

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
    """Lazy-load PaddleOCR. Returns None if not installed."""
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
    try:
        import pdfplumber
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages[:3]:  # Check first 3 pages
                text = page.extract_text() or ""
                if len(text.strip()) > 20:
                    return False  # Has real text
        return True  # No extractable text found
    except ImportError:
        logger.warning("pdfplumber not installed — cannot detect scanned PDFs")
        return False
    except Exception as e:
        logger.warning("Error checking PDF text: %s", e)
        return False


def _rasterize_pdf(file_path: str) -> list[str]:
    """
    P0-FIX-5: Convert scanned PDF pages to temporary PNG images for OCR.
    Returns list of temp image file paths.
    """
    temp_images = []
    try:
        import fitz  # PyMuPDF
        doc = fitz.open(file_path)
        for page_num in range(len(doc)):
            page = doc[page_num]
            pix = page.get_pixmap(dpi=300)
            tmp = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
            pix.save(tmp.name)
            temp_images.append(tmp.name)
        doc.close()
    except ImportError:
        logger.error("PyMuPDF (fitz) not installed — cannot rasterize scanned PDFs")
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
    try:
        import fitz
        doc = fitz.open(file_path)
        count = len(doc)
        doc.close()
        return count
    except Exception:
        return 1


def extract_document(file_path: str) -> dict:
    """
    Extract text from a PDF or image file using PaddleOCR.
    
    Returns:
        {
            'raw_lines': list[str],       # Extracted text lines
            'confidence_scores': list[float],  # Per-line OCR confidence
            'raw_text': str,              # All lines joined
            'page_count': int,
            'error': str | None
        }
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

    engine = _get_ocr_engine()
    if engine is None:
        result["error"] = "PaddleOCR is not installed. Install with: pip install paddlepaddle paddleocr"
        return result

    result["page_count"] = _get_page_count(file_path)
    temp_images = []

    try:
        files_to_ocr = []

        if ext == ".pdf":
            # P0-FIX-5: Check if scanned PDF, rasterize if needed
            if _is_scanned_pdf(file_path):
                logger.info("Scanned PDF detected — rasterizing pages for OCR")
                temp_images = _rasterize_pdf(file_path)
                if not temp_images:
                    result["error"] = "Failed to rasterize scanned PDF. Install PyMuPDF: pip install PyMuPDF"
                    return result
                files_to_ocr = temp_images
            else:
                files_to_ocr = [file_path]
        else:
            # Image file — OCR directly
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

        # P0-FIX-2: Sanitize injection patterns
        sanitized_lines, redacted_indices = sanitize_ocr_output(raw_lines)

        # Mark redacted lines as low confidence so they get flagged
        for idx in redacted_indices:
            confidence_scores[idx] = 0.0

        result["raw_lines"] = sanitized_lines
        result["confidence_scores"] = confidence_scores
        result["raw_text"] = "\n".join(sanitized_lines)

    except Exception as e:
        logger.error("OCR extraction failed: %s", e, exc_info=True)
        result["error"] = f"OCR extraction failed: {str(e)}"
    finally:
        # Clean up rasterized temp images
        for tmp in temp_images:
            try:
                os.remove(tmp)
            except OSError:
                pass

    return result
