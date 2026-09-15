"""
Unit Tests for AI Accounting Agent & Intent Handler
Verifies end-to-end transaction recording, 2-signal validation, error propagation, and report querying.
"""
import unittest
import os
import sys

# Ensure backend path is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from backend.core import database as db
from backend.core.schema_engine import Doc
from backend.seed_defaults import seed_all
from backend.api.ai_router import (
    _local_fallback_intent_executor,
    _execute_get_profit_and_loss,
    format_agent_response
)

class TestAIAgent(unittest.TestCase):

    def setUp(self):
        seed_all("default_company", reset_db=True)
        # Ensure COA has Rent Expense and Bank
        acc_rent = db.get_doc("Account", "Rent Expense")
        if not acc_rent:
            doc = Doc("Account", {
                "name": "Rent Expense",
                "accountName": "Rent Expense",
                "accountType": "Expense",
                "parentAccount": "Expenses - DC"
            })
            doc._not_inserted = True
            db.insert_doc(doc)

        acc_bank = db.get_doc("Account", "Bank")
        if not acc_bank:
            doc = Doc("Account", {
                "name": "Bank",
                "accountName": "Bank",
                "accountType": "Bank",
                "parentAccount": "Asset - DC"
            })
            doc._not_inserted = True
            db.insert_doc(doc)

    def test_agent_records_expense_end_to_end(self):
        """
        End-to-End Test:
        1. Send 'paid shop rent 2500' to fallback executor
        2. Assert Journal Entry created in DB with correct debit/credit accounts and 2500.0 amount
        3. Assert P&L report reflects $2,500 in expenses
        """
        res = _local_fallback_intent_executor("paid shop rent 2500")

        # 1. Check response content
        self.assertIn("✅", res["content"])
        self.assertIn("Recorded Journal Entry", res["content"])

        # 2. Assert Journal Entry in DB
        entries = db.get_all_docs("JournalEntry")
        self.assertGreaterEqual(len(entries), 1)

        latest_je = entries[-1]
        self.assertEqual(latest_je.get("totalDebit"), 2500.0)
        self.assertEqual(latest_je.get("totalCredit"), 2500.0)

        accounts = latest_je.get("accounts", [])
        self.assertEqual(len(accounts), 2)

        rent_acc = next((a for a in accounts if "Rent" in a.get("account", "")), None)
        bank_acc = next((a for a in accounts if "Bank" in a.get("account", "")), None)

        self.assertIsNotNone(rent_acc, "Rent Expense account should be debited")
        self.assertEqual(rent_acc.get("debit"), 2500.0)

        self.assertIsNotNone(bank_acc, "Bank account should be credited")
        self.assertEqual(bank_acc.get("credit"), 2500.0)

        # 3. Assert P&L reflects the expense
        pnl = _execute_get_profit_and_loss()
        self.assertEqual(pnl.get("expenses", {}).get("total", 0.0), 2500.0)

    def test_agent_returns_error_on_failure(self):
        """
        Failure Test:
        If no expense account exists in COA, returns error verbatim with ❌ prefix,
        never returning empty or zero-value fallbacks.
        """
        # Clear all Account docs so no matching account exists
        for acc in db.get_all_docs("Account"):
            db.delete_doc("Account", acc.get("name"))

        res = _local_fallback_intent_executor("paid shop rent 2500")

        self.assertIn("❌", res["content"])
        self.assertIn("Transaction creation failed", res["content"])

    def test_two_signal_rule_prevents_false_positives(self):
        """
        2-Signal Rule Test:
        'I received my P&L last week' has verb 'received' but NO number.
        Must NOT create a journal entry, but instead route to P&L report!
        """
        res = _local_fallback_intent_executor("I received my P&L last week")

        # Must not create a Journal Entry
        entries = db.get_all_docs("JournalEntry")
        self.assertEqual(len(entries), 0)

        # Must route to P&L report
        self.assertIn("Profit & Loss Summary", res["content"])

    def test_two_signal_rule_query_without_amount(self):
        """
        'show me what I paid for rent' has verb 'paid' but NO number.
        Must NOT attempt to create a journal entry.
        """
        res = _local_fallback_intent_executor("show me what I paid for rent")

        entries = db.get_all_docs("JournalEntry")
        self.assertEqual(len(entries), 0)
        self.assertIn("I am your entri AI accounting assistant", res["content"])

    def test_execute_get_accounts_tree_import(self):
        """
        Verify _execute_get_accounts successfully imports and executes get_account_tree.
        Prevents regression of: cannot import name 'get_accounts_tree' from 'backend.main'.
        """
        from backend.api.ai_router import _execute_get_accounts, _execute_get_general_ledger
        tree = _execute_get_accounts()
        self.assertIsInstance(tree, list)

        ledger = _execute_get_general_ledger()
        self.assertIn("entries", ledger)


if __name__ == "__main__":
    unittest.main()
