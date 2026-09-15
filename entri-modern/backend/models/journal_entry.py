"""
Journal Entry model - mirrors models/baseModels/JournalEntry/JournalEntry.ts

General journal entries with manual debit/credit lines.
Supports multiple entry types per accounting standards:
  - Journal Entry (general purpose)
  - Opening Entry (setup opening balances)
  - Depreciation Entry (fixed asset depreciation)
  - Adjustment Entry (corrections)
  - Closing Entry (period close)
  - Reversal Entry (reversals)
  - Write Off Entry (bad debts)
  - Bank Reconciliation

The ledger validates that total debits = total credits (double-entry rule).
Enforces POSTED Immutability Guard: Submitted/Posted journal entries cannot be modified.
"""
from datetime import date
from backend.core.base_model import BaseModel
from backend.core.schema_engine import Doc, LedgerPosting
from backend.core import database as db
from .invoice import safe_float, _save_ledger_entry, _reverse_ledger_entry


class JournalEntryModel(BaseModel):
    schema_name = "JournalEntry"

    def get_defaults(self, doc: Doc) -> dict:
        return {
            "date": date.today().isoformat(),
            "entryType": "Journal Entry",
            "totalDebit": 0,
            "totalCredit": 0,
            "status": "Draft",
            "approvalStatus": "Pending",
            "submitted": False,
            "cancelled": False,
        }

    async def before_sync(self, doc: Doc):
        """Compute total debit and total credit before saving, enforce immutability guard on posted entries."""
        # ─── POSTED Immutability Guard ─────────────────────────────────────────
        if doc.name and not doc.not_inserted:
            existing = db.get_doc("JournalEntry", doc.name)
            if existing and (existing.get("submitted") or existing.get("status") in ["Submitted", "Posted"]):
                # Allow status updates during submit/cancel lifecycle transitions
                if not doc._data.get("_is_lifecycle_transition"):
                    raise ValueError(
                        f"Journal Entry '{doc.name}' has been POSTED/Submitted and is immutable. "
                        "Posted entries cannot be edited. Create a reversal entry instead."
                    )

        from backend.coa import resolve_account_name
        accounts = doc.get("accounts", [])
        if not isinstance(accounts, list):
            accounts = []

        normalized = []
        total_debit = 0.0
        total_credit = 0.0

        for line in accounts:
            if isinstance(line, dict):
                acct = resolve_account_name(line.get("account", ""))
                debit = abs(safe_float(line.get("debit"), 0))
                credit = abs(safe_float(line.get("credit"), 0))
                party = line.get("party", "")
                normalized.append({
                    "account": acct,
                    "debit": debit,
                    "credit": credit,
                    "party": party
                })
                total_debit += debit
                total_credit += credit

        # Auto-balance 2-line entries if one side was left 0
        if len(normalized) == 2:
            l1, l2 = normalized[0], normalized[1]
            if l1["debit"] > 0 and l1["credit"] == 0 and l2["debit"] == 0 and l2["credit"] == 0:
                l2["credit"] = l1["debit"]
            elif l1["credit"] > 0 and l1["debit"] == 0 and l2["debit"] == 0 and l2["credit"] == 0:
                l2["debit"] = l1["credit"]
            elif l2["debit"] > 0 and l2["credit"] == 0 and l1["debit"] == 0 and l1["credit"] == 0:
                l1["credit"] = l2["debit"]
            elif l2["credit"] > 0 and l2["debit"] == 0 and l1["debit"] == 0 and l1["credit"] == 0:
                l1["debit"] = l2["credit"]

            total_debit = sum(l["debit"] for l in normalized)
            total_credit = sum(l["credit"] for l in normalized)

        doc._data["accounts"] = normalized
        doc._data["totalDebit"] = total_debit
        doc._data["totalCredit"] = total_credit

    async def after_submit(self, doc: Doc):
        """Post journal entry to the ledger (double-entry)."""
        from backend.coa import resolve_account_name
        posting = LedgerPosting(doc)

        for line in doc.get("accounts", []):
            if isinstance(line, dict):
                debit = safe_float(line.get("debit"), 0)
                credit = safe_float(line.get("credit"), 0)
                account = resolve_account_name(line.get("account", ""))
                party = line.get("party", "")

                if not account:
                    continue

                if debit > 0:
                    posting.debit(account, debit)
                    if party and account in posting._debit_map:
                        posting._debit_map[account].party = party
                if credit > 0:
                    posting.credit(account, credit)
                    if party and account in posting._credit_map:
                        posting._credit_map[account].party = party

        posting.validate()

        for entry in posting.get_entries():
            _save_ledger_entry(entry)

        doc._data["_is_lifecycle_transition"] = True
        doc._data["submitted"] = True
        doc._data["status"] = "Submitted"
        doc._data["cancelled"] = False
        db.update_doc(doc)
        doc._data.pop("_is_lifecycle_transition", None)

    async def after_cancel(self, doc: Doc):
        """Reverse all ledger entries for this journal entry."""
        entries = db.get_ledger_entries()
        for entry in entries:
            if entry.get("reference_name") == doc.get("name"):
                _reverse_ledger_entry(entry)

        doc._data["_is_lifecycle_transition"] = True
        doc._data["submitted"] = False
        doc._data["status"] = "Cancelled"
        doc._data["cancelled"] = True
        db.update_doc(doc)
        doc._data.pop("_is_lifecycle_transition", None)
