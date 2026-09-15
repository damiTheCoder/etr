"""
Comprehensive Unit Tests for Invoice Accounting Lifecycle, Discounts, Amendments & Cancellation.
"""
import unittest
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from backend.core import database as db
from backend.core.schema_engine import Doc
from backend.seed_defaults import seed_all
from backend.models.sales_invoice import SalesInvoiceModel
from backend.models.invoice import safe_float, reverse_document_postings
from backend.main import app
from fastapi.testclient import TestClient

client = TestClient(app)


class TestInvoiceLifecycleAccounting(unittest.TestCase):

    def setUp(self):
        seed_all("default_company", reset_db=True)
        self.model = SalesInvoiceModel()

    def _create_invoice(self, customer="Acme Corp", qty=1, rate=100.0, discount_amt=0.0, discount_pct=0.0):
        res = client.post("/api/SalesInvoice", json={
            "customer": customer,
            "items": [{"item_code": "Software Service", "qty": qty, "rate": rate}],
            "discountAmount": discount_amt,
            "discountPercent": discount_pct
        })
        self.assertEqual(res.status_code, 200, res.text)
        return res.json()

    def test_1_normal_invoice(self):
        """1. Normal invoice: 100"""
        inv = self._create_invoice(rate=100.0)
        self.assertEqual(inv["grandTotal"], 100.0)

        entries = db.get_ledger_entries({"reference_name": inv["name"]})
        self.assertEqual(len(entries), 2)

        dr_entry = next((e for e in entries if e["debit"] > 0), None)
        cr_entry = next((e for e in entries if e["credit"] > 0), None)

        self.assertIsNotNone(dr_entry)
        self.assertIsNotNone(cr_entry)
        self.assertEqual(dr_entry["account"], "Debtors")
        self.assertEqual(dr_entry["debit"], 100.0)
        self.assertEqual(cr_entry["account"], "Sales")
        self.assertEqual(cr_entry["credit"], 100.0)

        tot_dr = sum(e["debit"] for e in entries if e["reverted"] == 0)
        tot_cr = sum(e["credit"] for e in entries if e["reverted"] == 0)
        self.assertAlmostEqual(tot_dr, tot_cr, places=2)

    def test_2_percent_discount_invoice(self):
        """2. 10% discounted invoice: subtotal 100 -> discount 10 -> net 90"""
        inv = self._create_invoice(rate=100.0, discount_pct=10.0)
        self.assertEqual(inv["grandTotal"], 90.0)
        self.assertEqual(inv["discountAmount"], 10.0)

        entries = db.get_ledger_entries({"reference_name": inv["name"]})
        tot_dr = sum(e["debit"] for e in entries if e["reverted"] == 0)
        tot_cr = sum(e["credit"] for e in entries if e["reverted"] == 0)
        self.assertAlmostEqual(tot_dr, tot_cr, places=2)
        self.assertEqual(tot_dr, 100.0)

        ar = next((e for e in entries if e["account"] == "Debtors"), None)
        disc = next((e for e in entries if e["account"] == "Discount Allowed"), None)
        sales = next((e for e in entries if e["account"] == "Sales"), None)

        self.assertIsNotNone(ar)
        self.assertIsNotNone(disc)
        self.assertIsNotNone(sales)
        self.assertEqual(ar["debit"], 90.0)
        self.assertEqual(disc["debit"], 10.0)
        self.assertEqual(sales["credit"], 100.0)

    def test_3_fixed_discount_invoice(self):
        """3. Fixed discount: subtotal 100 -> discount 10 -> net 90"""
        inv = self._create_invoice(rate=100.0, discount_amt=10.0)
        self.assertEqual(inv["grandTotal"], 90.0)

        entries = db.get_ledger_entries({"reference_name": inv["name"]})
        tot_dr = sum(e["debit"] for e in entries if e["reverted"] == 0)
        tot_cr = sum(e["credit"] for e in entries if e["reverted"] == 0)
        self.assertAlmostEqual(tot_dr, tot_cr, places=2)
        self.assertEqual(tot_dr, 100.0)

    def test_4_hundred_percent_discount_invoice(self):
        """4. 100% discount: subtotal 100 -> discount 100 -> total 0"""
        inv = self._create_invoice(rate=100.0, discount_pct=100.0)
        self.assertEqual(inv["grandTotal"], 0.0)
        self.assertEqual(inv["discountAmount"], 100.0)

        entries = db.get_ledger_entries({"reference_name": inv["name"]})
        tot_dr = sum(e["debit"] for e in entries if e["reverted"] == 0)
        tot_cr = sum(e["credit"] for e in entries if e["reverted"] == 0)
        self.assertAlmostEqual(tot_dr, tot_cr, places=2)
        self.assertEqual(tot_dr, 100.0)

        disc = next((e for e in entries if e["account"] == "Discount Allowed"), None)
        sales = next((e for e in entries if e["account"] == "Sales"), None)
        self.assertIsNotNone(disc)
        self.assertEqual(disc["debit"], 100.0)
        self.assertEqual(sales["credit"], 100.0)

    def test_5_invalid_discount_exceeds_subtotal(self):
        """5. Invalid discount > subtotal: subtotal 100, discount 150 rejected"""
        res = client.post("/api/SalesInvoice", json={
            "customer": "Acme Corp",
            "items": [{"item_code": "Service", "qty": 1, "rate": 100.0}],
            "discountAmount": 150.0
        })
        self.assertEqual(res.status_code, 400)
        self.assertIn("Discount amount cannot exceed item subtotal", res.text)

    def test_6_negative_discount(self):
        """6. Negative discount rejected"""
        res = client.post("/api/SalesInvoice", json={
            "customer": "Acme Corp",
            "items": [{"item_code": "Service", "qty": 1, "rate": 100.0}],
            "discountAmount": -10.0
        })
        self.assertEqual(res.status_code, 400)
        self.assertIn("Discount cannot be negative", res.text)

    def test_7_decimal_discount_rounding(self):
        """7. Decimal discount/rounding: subtotal 99.99, discount 10%"""
        inv = self._create_invoice(rate=99.99, discount_pct=10.0)
        self.assertEqual(inv["discountAmount"], 10.00)
        self.assertEqual(inv["grandTotal"], 89.99)

        entries = db.get_ledger_entries({"reference_name": inv["name"]})
        tot_dr = round(sum(e["debit"] for e in entries if e["reverted"] == 0), 2)
        tot_cr = round(sum(e["credit"] for e in entries if e["reverted"] == 0), 2)
        self.assertEqual(tot_dr, tot_cr)
        self.assertEqual(tot_dr, 99.99)

    def test_8_edit_posted_invoice(self):
        """8. Edit posted invoice 100 -> 200"""
        inv = self._create_invoice(rate=100.0)
        name = inv["name"]
        self.assertEqual(inv["grandTotal"], 100.0)

        res = client.put(f"/api/SalesInvoice/{name}", json={
            "data": {
                "items": [{"item_code": "Software Service", "quantity": 1, "rate": 200.0}]
            }
        })
        self.assertEqual(res.status_code, 200, res.text)
        updated_inv = res.json()
        self.assertEqual(updated_inv["grandTotal"], 200.0)

        entries = db.get_ledger_entries({"reference_name": name})
        dr_sum = sum(e["debit"] for e in entries if e["reverted"] == 0)
        cr_sum = sum(e["credit"] for e in entries if e["reverted"] == 0)

        ar_net = sum((e["debit"] - e["credit"]) for e in entries if e["account"] == "Debtors" and e["reverted"] == 0)
        sales_net = sum((e["credit"] - e["debit"]) for e in entries if e["account"] == "Sales" and e["reverted"] == 0)

        self.assertEqual(ar_net, 200.0)
        self.assertEqual(sales_net, 200.0)
        self.assertEqual(dr_sum, cr_sum)

    def test_9_edit_repeatedly(self):
        """9. Edit repeatedly 100 -> 200 -> 300"""
        inv = self._create_invoice(rate=100.0)
        name = inv["name"]

        # 100 -> 200
        client.put(f"/api/SalesInvoice/{name}", json={
            "data": {"items": [{"item_code": "Software Service", "quantity": 1, "rate": 200.0}]}
        })
        # 200 -> 300
        res = client.put(f"/api/SalesInvoice/{name}", json={
            "data": {"items": [{"item_code": "Software Service", "quantity": 1, "rate": 300.0}]}
        })
        self.assertEqual(res.status_code, 200, res.text)
        final_inv = res.json()
        self.assertEqual(final_inv["grandTotal"], 300.0)

        entries = db.get_ledger_entries({"reference_name": name})
        ar_net = sum((e["debit"] - e["credit"]) for e in entries if e["account"] == "Debtors" and e["reverted"] == 0)
        sales_net = sum((e["credit"] - e["debit"]) for e in entries if e["account"] == "Sales" and e["reverted"] == 0)

        self.assertEqual(ar_net, 300.0)
        self.assertEqual(sales_net, 300.0)

    def test_10_cancel_posted_invoice(self):
        """10. Cancel posted invoice"""
        inv = self._create_invoice(rate=100.0)
        name = inv["name"]

        res = client.post(f"/api/SalesInvoice/{name}/cancel")
        self.assertEqual(res.status_code, 200, res.text)
        cancelled_inv = res.json()

        self.assertTrue(cancelled_inv["cancelled"])
        self.assertEqual(cancelled_inv["status"], "Cancelled")
        self.assertEqual(cancelled_inv["outstandingAmount"], 0)

        entries = db.get_ledger_entries({"reference_name": name})
        ar_net = sum((e["debit"] - e["credit"]) for e in entries if e["account"] == "Debtors")
        sales_net = sum((e["credit"] - e["debit"]) for e in entries if e["account"] == "Sales")

        self.assertEqual(ar_net, 0.0)
        self.assertEqual(sales_net, 0.0)

    def test_11_attempt_cancel_twice(self):
        """11. Attempt to cancel twice"""
        inv = self._create_invoice(rate=100.0)
        name = inv["name"]

        res1 = client.post(f"/api/SalesInvoice/{name}/cancel")
        self.assertEqual(res1.status_code, 200)

        res2 = client.post(f"/api/SalesInvoice/{name}/cancel")
        self.assertEqual(res2.status_code, 400)
        self.assertIn("already cancelled", res2.text)

    def test_12_attempt_delete_posted_invoice(self):
        """12. Attempt to delete posted invoice -> rejected with 400"""
        inv = self._create_invoice(rate=100.0)
        name = inv["name"]

        res = client.delete(f"/api/SalesInvoice/{name}")
        self.assertEqual(res.status_code, 400)
        self.assertIn("has been POSTED and cannot be deleted", res.text)

        doc = db.get_doc("SalesInvoice", name)
        self.assertIsNotNone(doc)

    def test_13_delete_draft_invoice(self):
        """13. Delete draft invoice -> allowed"""
        doc = Doc("SalesInvoice", {
            "customer": "Draft Customer",
            "grandTotal": 100.0,
            "submitted": 0,
            "status": "Draft"
        })
        doc._not_inserted = True
        name = db.insert_doc(doc)

        res = client.delete(f"/api/SalesInvoice/{name}")
        self.assertEqual(res.status_code, 200)
        deleted = db.get_doc("SalesInvoice", name)
        self.assertIsNone(deleted)

    def test_14_failed_amendment_rollback(self):
        """14. Failed amendment -> verify complete rollback"""
        inv = self._create_invoice(rate=100.0)
        name = inv["name"]

        res = client.put(f"/api/SalesInvoice/{name}", json={
            "data": {
                "items": [{"item_code": "Service", "quantity": 1, "rate": 100.0}],
                "discountAmount": 150.0
            }
        })
        self.assertEqual(res.status_code, 400)

        saved_doc = db.get_doc("SalesInvoice", name)
        self.assertEqual(saved_doc.get("grandTotal"), 100.0)

        entries = db.get_ledger_entries({"reference_name": name})
        ar_net = sum((e["debit"] - e["credit"]) for e in entries if e["account"] == "Debtors" and e["reverted"] == 0)
        self.assertEqual(ar_net, 100.0)

    def test_15_report_consistency_across_financial_statements(self):
        """15. Verify report consistency across P&L, Balance Sheet, Trial Balance, AR Aging"""
        inv = self._create_invoice(customer="Acme Corp", rate=100.0, discount_pct=10.0)

        tb_res = client.get("/api/reports/trial-balance")
        self.assertEqual(tb_res.status_code, 200)
        tb = tb_res.json()
        self.assertTrue(tb["balanced"])
        self.assertAlmostEqual(tb["totalDebit"], tb["totalCredit"], places=2)

        pnl_res = client.get("/api/reports/profit-and-loss")
        self.assertEqual(pnl_res.status_code, 200)
        pnl = pnl_res.json()
        self.assertEqual(pnl["income"]["total"], 100.0)

        ar_res = client.get("/api/reports/ar-aging")
        self.assertEqual(ar_res.status_code, 200)
        ar = ar_res.json()
        self.assertEqual(ar["total"], 90.0)

    def test_16_cancelled_invoice_reports_consistency(self):
        """16. Verify cancelled invoice does not contribute to active revenue/AR"""
        inv = self._create_invoice(rate=100.0)
        name = inv["name"]

        client.post(f"/api/SalesInvoice/{name}/cancel")

        ar_res = client.get("/api/reports/ar-aging")
        self.assertEqual(ar_res.json()["total"], 0.0)

        pnl_res = client.get("/api/reports/profit-and-loss")
        self.assertEqual(pnl_res.json()["income"]["total"], 0.0)


if __name__ == "__main__":
    unittest.main()
