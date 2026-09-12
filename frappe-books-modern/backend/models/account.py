"""
Account model - mirrors models/baseModels/Account/Account.ts

Handles Chart of Accounts, root types (Asset/Liability/Equity/Income/Expense),
and debit/credit classification per accounting standards.

Accounting rule:
  - Assets and Expenses are debit-natured (normal debit balance)
  - Liabilities, Equity, and Income are credit-natured (normal credit balance)
"""
from typing import Optional
from backend.core.base_model import BaseModel
from backend.core.schema_engine import Doc
from backend.core import database as db
from backend.coa import (
    is_debit,
    is_credit,
    normal_balance_side,
    get_account_balance,
)


class AccountModel(BaseModel):
    schema_name = "Account"

    def get_defaults(self, doc: Doc) -> dict:
        return {
            "isGroup": False,
            "balance": 0,
            "lft": 0,
            "rgt": 0,
        }

    async def before_sync(self, doc: Doc):
        # Inherit accountType from parent if not set
        if not doc.get("accountType") and doc.get("parentAccount"):
            parent = db.get_doc("Account", doc.get("parentAccount"))
            if parent:
                doc._data["accountType"] = parent.get("accountType")

        # Validate that parentAccount rootType matches this account's rootType
        if doc.get("parentAccount"):
            parent = db.get_doc("Account", doc.get("parentAccount"))
            if parent and parent.get("rootType"):
                doc._data["rootType"] = parent.get("rootType")

    @staticmethod
    def is_debit(root_type: str) -> bool:
        """Returns True if accounts of this root type are debit-natured."""
        return is_debit(root_type)

    @staticmethod
    def is_credit(root_type: str) -> bool:
        """Returns True if accounts of this root type are credit-natured."""
        return is_credit(root_type)

    @staticmethod
    def normal_balance_side(root_type: str) -> str:
        """Returns 'Debit' or 'Credit' — the normal balance side."""
        return normal_balance_side(root_type)

    @staticmethod
    def get_balance(debit: float, credit: float, root_type: str) -> float:
        """Compute normal balance: positive = normal, negative = abnormal."""
        return get_account_balance(debit, credit, root_type)

    @staticmethod
    def get_account_tree():
        """Return all accounts as a hierarchical tree structure."""
        accounts = db.get_all_docs("Account")
        account_map = {a.get("name"): a for a in accounts}
        roots = [a for a in accounts if not a.get("parentAccount")]

        def build_children(account_name):
            return [
                {
                    "name": child.get("name"),
                    "accountNumber": child.get("accountNumber", ""),
                    "rootType": child.get("rootType", ""),
                    "accountType": child.get("accountType", ""),
                    "isGroup": child.get("isGroup", False),
                    "balance": child.get("balance", 0),
                    "children": build_children(child.get("name")),
                }
                for child in accounts
                if child.get("parentAccount") == account_name
            ]

        tree = []
        for root in roots:
            tree.append({
                "name": root.get("name"),
                "accountNumber": root.get("accountNumber", ""),
                "rootType": root.get("rootType", ""),
                "accountType": root.get("accountType", ""),
                "isGroup": root.get("isGroup", True),
                "balance": root.get("balance", 0),
                "debitNatured": is_debit(root.get("rootType", "")),
                "children": build_children(root.get("name")),
            })
        return tree
