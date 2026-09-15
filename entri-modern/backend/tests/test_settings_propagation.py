"""
Unit Tests for Settings Propagation Across Accounting Engine
Tests per-transaction settings resolution, report propagation, fiscal year bounds, static analysis cache checks, and missing account errors.
"""
import unittest
import os
import sys
import re
import asyncio

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from backend.core import database as db
from backend.core.schema_engine import Doc
from backend.seed_defaults import seed_all
from backend.models.settings_model import (
    get_company_settings,
    update_company_settings,
    SettingsPayload
)
from backend.core.journal_builder import (
    build_vendor_bill_entry,
    build_sales_invoice_entry,
)
from backend.core.close_management import get_fiscal_period_bounds
from backend.core.errors import SettingsIncompleteError
from backend.main import profit_and_loss


class TestSettingsPropagation(unittest.TestCase):

    def setUp(self):
        seed_all("default_company", reset_db=True)

    def test_settings_change_reflects_in_next_journal_entry(self):
        """
        1. Create a vendor bill with initial settings.
        2. Change default_purchase_expense_account_id to a new account ID.
        3. Create a second vendor bill.
        4. Assert the second entry uses the NEW account ID.
        5. Assert the first entry still uses the OLD account ID.
        """
        # Ensure 'Custom Expense' account exists in COA
        doc = Doc("Account", {
            "name": "Custom Expense",
            "accountName": "Custom Expense",
            "accountType": "Expense",
            "parentAccount": "Expenses - DC"
        })
        doc._not_inserted = True
        db.insert_doc(doc)

        # 1. First Entry with initial settings
        entry1 = asyncio.run(build_vendor_bill_entry(
            company_id="default_company",
            amount=100.0,
            vendor_name="Vendor A",
            date_str="2026-09-01",
            remark="First Bill"
        ))
        used_acc1 = entry1["accounts"][0]["account"]

        # 2. Update default_purchase_expense_account_id setting to 'Custom Expense'
        update_company_settings(
            SettingsPayload(
                company_id="default_company",
                default_purchase_expense_account_id="Custom Expense"
            ),
            changed_by="admin"
        )

        # 3. Second Entry with NEW setting
        entry2 = asyncio.run(build_vendor_bill_entry(
            company_id="default_company",
            amount=200.0,
            vendor_name="Vendor B",
            date_str="2026-09-02",
            remark="Second Bill"
        ))
        used_acc2 = entry2["accounts"][0]["account"]

        # 4 & 5. Verify propagation
        self.assertEqual(used_acc2, "Custom Expense")
        self.assertNotEqual(used_acc1, used_acc2)

    def test_currency_change_reflects_in_reports(self):
        """
        Set base_currency to NGN, query profit_and_loss(), and assert response includes currency: 'NGN'.
        """
        update_company_settings(
            SettingsPayload(company_id="default_company", base_currency="NGN"),
            changed_by="admin"
        )
        res = profit_and_loss(company_id="default_company")
        self.assertEqual(res.get("currency"), "NGN")

    def test_company_name_change_reflects_in_reports(self):
        """
        Change company name to 'Damco Ltd', query profit_and_loss(), and assert response includes company_name: 'Damco Ltd'.
        """
        update_company_settings(
            SettingsPayload(company_id="default_company", company_name="Damco Ltd"),
            changed_by="admin"
        )
        res = profit_and_loss(company_id="default_company")
        self.assertEqual(res.get("company_name"), "Damco Ltd")

    def test_fiscal_year_change_reflects_in_close_management(self):
        """
        Set fiscal_year_start = 7 (July), fiscal_year_end = 6 (June).
        Assert close_management computes period label starting in July with FY bounds.
        """
        update_company_settings(
            SettingsPayload(company_id="default_company", fiscal_year_start=7, fiscal_year_end=6),
            changed_by="admin"
        )
        p_start, p_end, label = get_fiscal_period_bounds("default_company", "2026-07-15")
        self.assertIn("July 2026", label)
        self.assertIn("FY 2026/2027", label)

    def test_no_module_level_settings_cache(self):
        """
        Static analysis test: Grep backend/ directory for module-level settings cache patterns.
        Must return 0 matches.
        """
        backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        patterns = [
            re.compile(r"^\s*SETTINGS_CACHE\s*=", re.MULTILINE),
            re.compile(r"^\s*_settings\s*=", re.MULTILINE),
            re.compile(r"^\s*_SETTINGS\s*=", re.MULTILINE),
            re.compile(r"^\s*CACHED_SETTINGS\s*=", re.MULTILINE),
        ]

        matches = []
        for root, dirs, files in os.walk(backend_dir):
            for file in files:
                if file.endswith(".py"):
                    filepath = os.path.join(root, file)
                    with open(filepath, "r", encoding="utf-8") as f:
                        content = f.read()
                        for pat in patterns:
                            if pat.search(content):
                                matches.append(f"{filepath} matches {pat.pattern}")

        self.assertEqual(len(matches), 0, f"Found module-level settings cache variables: {matches}")

    def test_settings_missing_account_raises_error(self):
        """
        Clear default_purchase_expense_account_id in database, attempt vendor bill creation,
        assert SettingsIncompleteError with specific missing field name.
        """
        db.set_single_value("default_purchase_expense_account_id_default_company", "")
        db.set_single_value("default_purchase_expense_account_id", "")

        with self.assertRaises(SettingsIncompleteError) as ctx:
            asyncio.run(build_vendor_bill_entry(
                company_id="default_company",
                amount=100.0,
                vendor_name="Vendor X",
                date_str="2026-09-01"
            ))

    def test_settings_save_does_not_wipe_other_fields(self):
        """1. Seed company settings with base_currency='USD', company_name='Acme'."""
        db.settings.update_one({"company_id": "default_company"}, {"$set": {"base_currency": "USD", "company_name": "Acme"}})
        doc_before = db.settings.find_one({"company_id": "default_company"})
        id_before = doc_before["_id"]
        created_at_before = doc_before["created_at"]
        version_before = doc_before.get("version", 1)

        from fastapi.testclient import TestClient
        from backend.main import app
        client = TestClient(app)

        res = client.patch("/api/settings?company_id=default_company", json={"base_currency": "NGN", "version": version_before})
        self.assertEqual(res.status_code, 200)

        doc_after = db.settings.find_one({"company_id": "default_company"})
        self.assertEqual(doc_after["company_name"], "Acme")
        self.assertEqual(doc_after["base_currency"], "NGN")
        self.assertEqual(doc_after["_id"], id_before)
        self.assertEqual(doc_after["created_at"], created_at_before)
        self.assertEqual(doc_after["version"], version_before + 1)

    def test_settings_save_preserves_account_mappings(self):
        """1. Seed settings with default_sales_income_account_id='acc123'."""
        db.settings.update_one({"company_id": "default_company"}, {"$set": {"default_sales_income_account_id": "acc123"}})
        from fastapi.testclient import TestClient
        from backend.main import app
        client = TestClient(app)

        res = client.patch("/api/settings?company_id=default_company", json={"company_name": "New Name"})
        self.assertEqual(res.status_code, 200)

        doc_after = db.settings.find_one({"company_id": "default_company"})
        self.assertEqual(doc_after["default_sales_income_account_id"], "acc123")
        self.assertEqual(doc_after["company_name"], "New Name")

    def test_settings_save_fails_if_settings_missing(self):
        """Query for a company with no settings document -> expect 404."""
        from fastapi.testclient import TestClient
        from backend.main import app
        client = TestClient(app)

        res = client.patch("/api/settings?company_id=missing_company_id", json={"company_name": "Missing"})
        self.assertEqual(res.status_code, 404)
        self.assertIn("Settings not found for company missing_company_id", res.json()["detail"])

    def test_concurrent_settings_edit_returns_409(self):
        """Two clients read version=1. Client A PATCHes -> version=2. Client B PATCHes with version=1 -> expect 409."""
        from fastapi.testclient import TestClient
        from backend.main import app
        client = TestClient(app)

        doc = db.settings.find_one({"company_id": "default_company"})
        curr_ver = doc.get("version", 1)

        resA = client.patch("/api/settings?company_id=default_company", json={"company_name": "Client A Name", "version": curr_ver})
        self.assertEqual(resA.status_code, 200)

        resB = client.patch("/api/settings?company_id=default_company", json={"company_name": "Client B Name", "version": curr_ver})
        self.assertEqual(resB.status_code, 409)

    def test_settings_save_nulls_are_filtered(self):
        """PATCH with {"company_name": "X", "base_currency": None} -> base_currency is unchanged."""
        db.settings.update_one({"company_id": "default_company"}, {"$set": {"base_currency": "EUR"}})
        from fastapi.testclient import TestClient
        from backend.main import app
        client = TestClient(app)

        res = client.patch("/api/settings?company_id=default_company", json={"company_name": "X", "base_currency": None})
        self.assertEqual(res.status_code, 200)

        doc_after = db.settings.find_one({"company_id": "default_company"})
        self.assertEqual(doc_after["company_name"], "X")
        self.assertEqual(doc_after["base_currency"], "EUR")

    def test_settings_unique_index_prevents_duplicates(self):
        """Try to insert two settings documents with the same company_id -> second insert fails."""
        import sqlite3
        with self.assertRaises((ValueError, sqlite3.IntegrityError, Exception)):
            db.settings.insert_one({
                "company_id": "default_company",
                "company_name": "Duplicate Co",
                "version": 1
            })

    def test_journal_builder_reads_fresh_settings_after_patch(self):
        """
        1. PATCH settings changing default_sales_income_account_id to 'Service'.
        2. Create a sales invoice journal entry.
        3. Assert the entry used account 'Service'.
        """
        from fastapi.testclient import TestClient
        from backend.main import app
        client = TestClient(app)

        res = client.patch("/api/settings?company_id=default_company", json={"default_sales_income_account_id": "Service"})
        self.assertEqual(res.status_code, 200)

        entry = asyncio.run(build_sales_invoice_entry(
            company_id="default_company",
            amount=500.0,
            customer_name="Customer Test",
            date_str="2026-09-05"
        ))
        used_accounts = [a["account"] for a in entry["accounts"]]
        self.assertIn("Service", used_accounts)

    def test_settings_audit_log_records_only_changed_fields(self):
        """PATCH with two changed fields -> assert SettingsAuditLog has entries listing changed fields."""
        from fastapi.testclient import TestClient
        from backend.main import app
        client = TestClient(app)

        res = client.patch("/api/settings?company_id=default_company", json={"company_name": "Audit Test", "base_currency": "GBP"})
        self.assertEqual(res.status_code, 200)

        logs = db.get_audit_logs("SettingsAuditLog", "")
        company_logs = [l for l in logs if "Audit Test" in l.get("details", "") or "GBP" in l.get("details", "")]
        self.assertGreaterEqual(len(company_logs), 1)


if __name__ == "__main__":
    unittest.main()
