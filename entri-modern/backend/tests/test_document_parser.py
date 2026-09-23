"""
Tests for document_parser.py — P0-FIX-1 (DR/CR sanity) and P0-FIX-8 (negative amounts).
"""
import unittest
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from backend.api.document_parser import (
    detect_document_type,
    detect_bank,
    parse_bank_statement,
    validate_direction,
    parse_invoice,
    parse_voucher,
)


class TestDetectDocumentType(unittest.TestCase):
    def test_bank_statement(self):
        lines = ["GUARANTY TRUST BANK", "Account Statement", "Opening Balance: 500,000", "Transaction Details"]
        assert detect_document_type(lines) == "bank_statement"

    def test_invoice(self):
        lines = ["INVOICE #1234", "Bill To: XYZ Company", "Subtotal: 50,000", "Total Due: 55,000"]
        assert detect_document_type(lines) == "invoice"

    def test_voucher(self):
        lines = ["PAYMENT VOUCHER", "Payee: John Doe", "Amount: 25,000"]
        assert detect_document_type(lines) == "voucher"

    def test_unknown(self):
        lines = ["Hello world", "This is a random document"]
        assert detect_document_type(lines) == "unknown"


class TestDetectBank(unittest.TestCase):
    def test_gtbank(self):
        lines = ["Guaranty Trust Bank PLC", "Account Statement for September 2024"]
        assert detect_bank(lines) == "gtbank"

    def test_zenith(self):
        lines = ["Zenith Bank", "Statement of Account"]
        assert detect_bank(lines) == "zenith"

    def test_access(self):
        lines = ["Access Bank PLC", "Account Statement"]
        assert detect_bank(lines) == "access"

    def test_generic(self):
        lines = ["Some Unknown Bank", "Statement"]
        assert detect_bank(lines) == "generic"


class TestParseNegativeAmount(unittest.TestCase):
    """P0-FIX-8: Reversal/negative amount detection."""

    def test_negative_naira(self):
        lines = [
            "Opening Balance: 500,000",
            "15/Sep/2024 REVERSAL -₦45,000.00 CR",
            "Closing Balance: 545,000",
        ]
        result = parse_bank_statement(lines, "gtbank")
        txns = result["transactions"]
        assert len(txns) >= 1
        # Find the reversal transaction
        reversal = [t for t in txns if "REVERSAL" in t["description"]]
        assert len(reversal) == 1
        assert reversal[0]["direction"] == "credit"

    def test_positive_debit(self):
        lines = [
            "Opening Balance: 500,000",
            "16/Sep/2024 SALARY PAYMENT ₦50,000.00 DR",
            "Closing Balance: 450,000",
        ]
        result = parse_bank_statement(lines, "gtbank")
        txns = result["transactions"]
        salary = [t for t in txns if "SALARY" in t["description"]]
        assert len(salary) == 1
        assert salary[0]["direction"] == "debit"
        assert salary[0]["amount"] == 50000.0

    def test_cr_suffix(self):
        lines = [
            "Opening Balance: 100,000",
            "17/Sep/2024 NIP CREDIT ₦25,000 CR",
            "Closing Balance: 125,000",
        ]
        result = parse_bank_statement(lines, "gtbank")
        txns = result["transactions"]
        credit = [t for t in txns if "CREDIT" in t["description"]]
        assert len(credit) == 1
        assert credit[0]["direction"] == "credit"


class TestDirectionSanity(unittest.TestCase):
    """P0-FIX-1: DR/CR direction sanity check."""

    def test_debit_to_income_flagged(self):
        is_suspicious, reason = validate_direction("debit", "Income")
        assert is_suspicious is True
        assert "unusual" in reason.lower()

    def test_credit_to_expense_flagged(self):
        is_suspicious, reason = validate_direction("credit", "Expense")
        assert is_suspicious is True
        assert "unusual" in reason.lower()

    def test_debit_to_expense_ok(self):
        is_suspicious, reason = validate_direction("debit", "Expense")
        assert is_suspicious is False
        assert reason is None

    def test_credit_to_income_ok(self):
        is_suspicious, reason = validate_direction("credit", "Income")
        assert is_suspicious is False
        assert reason is None

    def test_debit_to_asset_ok(self):
        is_suspicious, reason = validate_direction("debit", "Asset")
        assert is_suspicious is False

    def test_credit_to_liability_ok(self):
        is_suspicious, reason = validate_direction("credit", "Liability")
        assert is_suspicious is False


class TestTotalReconciliation(unittest.TestCase):
    def test_reconciliation_pass(self):
        lines = [
            "Opening Balance: 100,000",
            "15/Sep/2024 DEPOSIT ₦50,000 CR",
            "Closing Balance: 150,000",
        ]
        result = parse_bank_statement(lines, "gtbank")
        assert result["total_mismatch"] is False

    def test_reconciliation_fail(self):
        lines = [
            "Opening Balance: 100,000",
            "15/Sep/2024 DEPOSIT ₦50,000 CR",
            "Closing Balance: 200,000",  # Wrong — should be 150k
        ]
        result = parse_bank_statement(lines, "gtbank")
        assert result["total_mismatch"] is True


class TestParseInvoice(unittest.TestCase):
    def test_basic_invoice(self):
        lines = [
            "INVOICE #001",
            "Vendor: ABC Supplies Ltd",
            "Date: 15/09/2024",
            "Item 1: Office Chairs ₦25,000",
            "Item 2: Desks ₦40,000",
            "Subtotal: ₦65,000",
            "Total Due: ₦65,000",
        ]
        result = parse_invoice(lines)
        assert result["total"] == 65000.0


class TestParseVoucher(unittest.TestCase):
    def test_basic_voucher(self):
        lines = [
            "PAYMENT VOUCHER",
            "Payee: John Doe",
            "Date: 20/09/2024",
            "Amount: ₦35,000",
            "Narration: Consulting fees for September",
        ]
        result = parse_voucher(lines)
        assert result["payee"] == "John Doe"
        assert result["amount"] == 35000.0


if __name__ == "__main__":
    unittest.main()
