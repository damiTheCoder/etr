"""
Tests for account_categorizer.py — keyword mapping and P0-FIX-1 (DR/CR sanity integration).
"""
import pytest
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from backend.api.account_categorizer import categorize_transaction


class TestAccountCategorizer:
    def test_categorize_salary(self):
        res = categorize_transaction("SALARY PAYMENT FOR SEPT", 150000.0, "debit", accounts=[])
        assert res["account"] == "Salaries Expense"
        assert res["root_type"] == "Expense"
        assert res["flagged_for_review"] is False

    def test_categorize_transfer(self):
        res = categorize_transaction("NIP TRANSFER TO ABC", 50000.0, "debit", accounts=[])
        assert res["account"] == "Cash"
        assert res["root_type"] == "Asset"

    def test_categorize_unmatched_debit(self):
        res = categorize_transaction("RANDOM UNKNOWN SUPPLIER", 12000.0, "debit", accounts=[])
        assert res["account"] == "Miscellaneous Expense"
        assert res["root_type"] == "Expense"
        assert res["flagged_for_review"] is True
        assert "Unmatched debit" in res["flag_reason"]

    def test_categorize_unmatched_credit(self):
        res = categorize_transaction("RANDOM UNKNOWN DEPOSIT", 85000.0, "credit", accounts=[])
        assert res["account"] == "Sales Revenue"
        assert res["root_type"] == "Income"
        assert res["flagged_for_review"] is True
        assert "Unmatched credit" in res["flag_reason"]

    def test_p0_direction_sanity_credit_to_expense(self):
        # A credit transaction matching an expense keyword should trigger direction sanity check
        res = categorize_transaction("RENT PAYMENT REFUND", 50000.0, "credit", accounts=[])
        assert res["account"] == "Rent Expense"
        assert res["root_type"] == "Expense"
        assert res["flagged_for_review"] is True
        assert "Credit to Expense account is unusual" in (res["flag_reason"] or "")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
