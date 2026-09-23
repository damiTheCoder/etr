# entri Accounting System — OCR & Document Processing Architecture

## Overview
The document processing pipeline extracts financial transactions from bank statements, invoices, and payment vouchers. To ensure production resilience across diverse environments and Python versions, the OCR engine implements a graceful 4-tier fallback chain. The application **never crashes or raises uncaught exceptions** when an OCR engine is not installed locally.

---

## 4-Tier Extraction Fallback Chain

```
                    ┌─────────────────────────┐
                    │   Document Upload       │
                    │   (PDF, PNG, JPG)       │
                    └────────────┬────────────┘
                                 │
                                 ▼
                     Local PaddleOCR Available?
                     (Python 3.9 - 3.13)
                      /                     \
                   [YES]                    [NO]
                    /                         \
        ┌──────────────────────┐   PADDLEOCR_ACCESS_TOKEN set?
        │ Run Local PaddleOCR  │          /             \
        │ Inference            │       [YES]            [NO]
        └──────────────────────┘        /                 \
                          ┌──────────────────────┐  Is File a PDF?
                          │ Call PaddleOCR Cloud │      /        \
                          │ API (Baidu AI Studio)│   [YES]       [NO]
                          └──────────────────────┘    /            \
                                    ┌──────────────────────┐  ┌──────────────────────┐
                                    │ PyMuPDF / pypdf Text │  │ Return Informative   │
                                    │ Extraction Engine    │  │ Error (No Crash)     │
                                    └──────────────────────┘  └──────────────────────┘
```

### Tier 1: Local PaddleOCR
- **Best for:** Scanned documents, photos of paper invoices/receipts running on supported Python (3.9–3.13).
- **Execution:** Runs local inference using `paddlepaddle` and `paddleocr`. Thread-safe with singleton lazy-loading.
- **Requires:** `paddlepaddle` and `paddleocr` installed in virtual environment.

### Tier 2: PaddleOCR Cloud API
- **Best for:** Environments where local C++ wheels cannot be built (e.g. Python 3.14+, containerized lightweight runtimes).
- **Execution:** Makes HTTP POST requests with base64-encoded image data to Baidu AI Studio / PaddleOCR cloud endpoints.
- **Config:** Set `PADDLEOCR_ACCESS_TOKEN=your-token-here` (and optional `PADDLEOCR_API_URL`) in `backend/.env`.

### Tier 3: Direct Digital Text Extraction (PyMuPDF + pypdf)
- **Best for:** Digital/e-statement PDFs (e.g. statements exported from online banking: GTBank, Zenith, FirstBank, Access, Chase, etc.).
- **Execution:** Directly extracts textual records using PyMuPDF (`pymupdf`) with fallback to `pypdf`.
- **Confidence:** Assigned 1.0 confidence for verified digital text.
- **Security:** Fully protected by prompt injection sanitization (`_INJECTION_PATTERNS`).

### Tier 4: Graceful Error Handling
- **Best for:** Handling image uploads when neither local PaddleOCR nor cloud token is available.
- **Execution:** Returns clean JSON `{ "error": "...", "raw_lines": [], "confidence_scores": [] }` without raising exceptions.

---

## Active Environment & Status

| Component | Status | Details |
|---|---|---|
| **Python Version** | `Python 3.14.2` | Running in active project virtualenv (`venv`) |
| **Local PaddleOCR** | `Not installed` | PaddlePaddle pre-built C++ wheels do not support Python 3.14 |
| **Cloud OCR Token** | `Unset` (Ready for config) | Set `PADDLEOCR_ACCESS_TOKEN` in `backend/.env` to enable |
| **Digital Text Engine** | **ACTIVE** | `pymupdf 1.28.2` and `pypdf 6.19.0` installed & passing |
| **Backend Test Suite** | **PASSING** | 134 / 134 tests passing |

---

## How to Switch Extraction Modes

### Option A: Enable Cloud OCR (Zero Python version restrictions)
1. Register and retrieve an access token from [Baidu AI Studio PaddleOCR](https://aistudio.baidu.com/paddleocr).
2. Add your token to `backend/.env`:
   ```env
   PADDLEOCR_ACCESS_TOKEN=your_token_here
   ```
3. Restart the backend service. Scanned PDFs and image files will automatically route to the Cloud API.

### Option B: Run Local PaddleOCR in a Dedicated Python 3.12 Environment
If you require fully offline local OCR for scanned paper documents:
1. Install Python 3.12:
   ```bash
   brew install python@3.12
   ```
2. Create and activate a dedicated virtualenv:
   ```bash
   python3.12 -m venv venv_ocr
   source venv_ocr/bin/activate
   pip install paddlepaddle==3.0.0 -i https://www.paddlepaddle.org.cn/packages/stable/cpu/
   pip install "paddleocr>=2.8.0"
   ```
3. Install backend dependencies and run the server using `venv_ocr/bin/python`.
