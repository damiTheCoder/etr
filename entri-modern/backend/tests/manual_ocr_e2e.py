"""
Manual End-to-End Smoke Test Script for PaddleOCR Document Processing.
Executes extraction, parsing, categorization, flag checks, and total reconciliation
on a real local PDF/image file WITHOUT posting to the General Ledger.

Usage:
    python backend/tests/manual_ocr_e2e.py /path/to/statement.pdf
"""
import sys
import os
import json

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from backend.api.ocr_engine import extract_document
from backend.api.document_parser import (
    detect_document_type,
    detect_bank,
    parse_bank_statement,
    parse_invoice,
    parse_voucher,
)
from backend.api.account_categorizer import categorize_transaction


def main():
    if len(sys.argv) < 2:
        print("Usage: python backend/tests/manual_ocr_e2e.py <path_to_pdf_or_image>")
        sys.exit(1)

    file_path = os.path.abspath(sys.argv[1])
    if not os.path.exists(file_path):
        print(f"Error: File not found at {file_path}")
        sys.exit(1)

    print("=" * 80)
    print(f"RUNNING OCR MANUAL SMOKE TEST ON: {file_path}")
    print("=" * 80)

    # 1. OCR Extraction
    print("\n[Step 1] Running extract_document()...")
    ocr_result = extract_document(file_path)
    if ocr_result.get("error"):
        print(f"OCR Error: {ocr_result['error']}")
        sys.exit(1)

    raw_lines = ocr_result.get("raw_lines", [])
    confidence_scores = ocr_result.get("confidence_scores", [])
    print(f"Extracted {len(raw_lines)} lines across {ocr_result.get('page_count', 1)} page(s).")
    print("\n--- First 10 Raw OCR Lines ---")
    for i, line in enumerate(raw_lines[:10]):
        conf = confidence_scores[i] if i < len(confidence_scores) else "N/A"
        print(f"  [{i}] (conf: {conf}) {line}")

    # 2. Document Detection & Parsing
    print("\n[Step 2] Detecting document type & bank...")
    doc_type = detect_document_type(raw_lines)
    bank = detect_bank(raw_lines)
    print(f"Detected Document Type: {doc_type}")
    print(f"Detected Bank Format:   {bank}")

    print("\n[Step 3] Parsing document...")
    if doc_type == "bank_statement":
        parsed = parse_bank_statement(raw_lines, bank, confidence_scores)
    elif doc_type == "invoice":
        inv = parse_invoice(raw_lines)
        parsed = {
            "transactions": [
                {
                    "date": inv.get("date", ""),
                    "description": item.get("description", ""),
                    "amount": item.get("amount", 0),
                    "direction": "debit",
                    "confidence": 1.0,
                    "flagged_for_review": False,
                    "flag_reason": None,
                    "line_index": i,
                    "raw_line": item.get("description", ""),
                }
                for i, item in enumerate(inv.get("items", []))
            ],
            "header_total": inv.get("total"),
            "opening_balance": None,
            "closing_balance": None,
            "total_mismatch": False,
        }
    elif doc_type == "voucher":
        vch = parse_voucher(raw_lines)
        parsed = {
            "transactions": [
                {
                    "date": vch.get("date", ""),
                    "description": vch.get("narration", vch.get("payee", "Payment Voucher")),
                    "amount": vch.get("amount", 0),
                    "direction": "debit",
                    "confidence": 1.0,
                    "flagged_for_review": False,
                    "flag_reason": None,
                    "line_index": 0,
                    "raw_line": "",
                }
            ] if vch.get("amount") else [],
            "header_total": vch.get("amount"),
            "opening_balance": None,
            "closing_balance": None,
            "total_mismatch": False,
        }
    else:
        parsed = parse_bank_statement(raw_lines, "generic", confidence_scores)

    transactions = parsed.get("transactions", [])
    print(f"Parsed {len(transactions)} transaction(s).")

    # 3. Categorization & Sanity Checks
    print("\n[Step 4] Categorizing each transaction...")
    categorized = []
    flagged_rows = []

    for txn in transactions:
        cat = categorize_transaction(
            txn.get("description", ""),
            txn.get("amount", 0),
            txn.get("direction", "debit"),
            accounts=[],
        )
        txn["account"] = cat["account"]
        txn["account_root_type"] = cat["root_type"]
        txn["confidence"] = cat["confidence"]
        if cat["flagged_for_review"]:
            txn["flagged_for_review"] = True
            txn["flag_reason"] = cat["flag_reason"]
            flagged_rows.append(txn)
        categorized.append(txn)

    # 4. Display Summary Table
    print("\n" + "=" * 80)
    print(f"{'Date':<12} | {'Description':<28} | {'Debit':<10} | {'Credit':<10} | {'Account':<18} | {'Status'}")
    print("-" * 80)
    for t in categorized:
        dr = f"₦{t['amount']:,.2f}" if t["direction"] == "debit" else "-"
        cr = f"₦{t['amount']:,.2f}" if t["direction"] == "credit" else "-"
        status = f"FLAGGED: {t['flag_reason']}" if t["flagged_for_review"] else "OK"
        desc = (t["description"][:25] + "...") if len(t["description"]) > 28 else t["description"]
        print(f"{t.get('date', '-'):<12} | {desc:<28} | {dr:<10} | {cr:<10} | {t['account']:<18} | {status}")

    # 5. Flagged Rows Report
    print("\n[Step 5] Flagged Rows Summary:")
    if flagged_rows:
        print(f"Total flagged for human review: {len(flagged_rows)}")
        for idx, fr in enumerate(flagged_rows):
            print(f"  {idx + 1}. '{fr['description']}' -> Reason: {fr['flag_reason']}")
    else:
        print("  None. All rows categorized with high confidence.")

    # 6. Total Reconciliation Check
    print("\n[Step 6] Total Reconciliation:")
    print(f"  Opening Balance: {parsed.get('opening_balance')}")
    print(f"  Closing Balance: {parsed.get('closing_balance')}")
    print(f"  Header Total:    {parsed.get('header_total')}")
    print(f"  Total Mismatch:  {parsed.get('total_mismatch')}")

    print("\n" + "=" * 80)
    print("SMOKE TEST COMPLETE (Ledger write was skipped as planned).")
    print("=" * 80)


if __name__ == "__main__":
    main()
