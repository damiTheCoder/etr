"""
Unit tests for Bug 1 (CRITICAL): Multi-currency posting & no double-multiply.
"""
import unittest
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from backend.core import database as db
from backend.seed_defaults import seed_all
from backend.main import app
from fastapi.testclient import TestClient

client = TestClient(app)


class TestBug1MultiCurrency(unittest.TestCase):

    def setUp(self):
        seed_all("default_company", reset_db=True)

    def test_multi_currency_posting_no_double_multiply(self):
        """
        1. Create an invoice with currency="NGN", base_currency="USD", exchangeRate=1500.
        2. Line amount: ₦1,500,000.
        3. Post the invoice.
        4. Assert the ledger debit for Debtors == 1000 USD (in cents: 100000).
        5. Assert the credit for Sales == 1000 USD.
        6. Assert no hidden adjustment line exists.
        """
        res = client.post("/api/SalesInvoice", json={
            "customer": "Global Corp",
            "currency": "NGN",
            "base_currency": "USD",
            "exchangeRate": 1500,
            "items": [{"item_code": "Export Service", "qty": 1, "rate": 1500000.0, "account": "Sales"}]
        })
        self.assertEqual(res.status_code, 200, res.text)
        inv = res.json()
        self.assertEqual(inv["grandTotal"], 1500000.0)
        self.assertEqual(inv["baseGrandTotal"], 1000.0)

        entries = db.get_ledger_entries({"reference_name": inv["name"]})
        self.assertEqual(len(entries), 2, f"Expected 2 lines, got {len(entries)}: {entries}")

        debtors_entry = next((e for e in entries if e["account"] == "Debtors"), None)
        sales_entry = next((e for e in entries if e["account"] == "Sales"), None)

        self.assertIsNotNone(debtors_entry)
        self.assertIsNotNone(sales_entry)

        self.assertEqual(debtors_entry["debit"], 1000.0)
        self.assertEqual(int(round(debtors_entry["debit"] * 100)), 100000)

        self.assertEqual(sales_entry["credit"], 1000.0)
        self.assertEqual(int(round(sales_entry["credit"] * 100)), 100000)

    def test_multi_currency_balance_still_holds(self):
        """
        1. Multi-currency invoice with 7.5% output VAT line.
        2. Assert debits == credits exactly.
        """
        res = client.post("/api/SalesInvoice", json={
            "customer": "Global Corp",
            "currency": "NGN",
            "base_currency": "USD",
            "exchangeRate": 1500,
            "items": [{"item_code": "Export Service", "qty": 1, "rate": 1500000.0, "account": "Sales"}],
            "taxes": [{"tax_name": "VAT", "rate": 7.5}]
        })
        self.assertEqual(res.status_code, 200, res.text)
        inv = res.json()

        entries = db.get_ledger_entries({"reference_name": inv["name"]})
        tot_dr = sum(e["debit"] for e in entries if e["reverted"] == 0)
        tot_cr = sum(e["credit"] for e in entries if e["reverted"] == 0)

        self.assertAlmostEqual(tot_dr, tot_cr, places=2)
        self.assertAlmostEqual(tot_dr, 1075.0, places=2)  # 1000 + 75 VAT

    def test_single_currency_rate_1_unchanged(self):
        """
        1. Post an invoice with rate=1.
        2. Assert amounts are unchanged from before the fix.
        """
        res = client.post("/api/SalesInvoice", json={
            "customer": "Local Corp",
            "currency": "USD",
            "base_currency": "USD",
            "exchangeRate": 1,
            "items": [{"item_code": "Local Service", "qty": 1, "rate": 1000.0, "account": "Sales"}]
        })
        self.assertEqual(res.status_code, 200, res.text)
        inv = res.json()

        entries = db.get_ledger_entries({"reference_name": inv["name"]})
        debtors_entry = next((e for e in entries if e["account"] == "Debtors"), None)
        sales_entry = next((e for e in entries if e["account"] == "Sales"), None)

        self.assertEqual(debtors_entry["debit"], 1000.0)
        self.assertEqual(sales_entry["credit"], 1000.0)


if __name__ == "__main__":
    unittest.main()
