"""
Payment model - mirrors models/baseModels/Payment/Payment.ts

Handles payments received/made with proper double-entry ledger posting.

Ledger posting rules:
  Receive (Customer pays us):
    Debit: Bank/Cash (Asset)    - asset increases
    Credit: Debtors (Receivable) - receivable decreases
  Pay (We pay supplier):
    Debit: Creditors (Payable)   - payable decreases
    Credit: Bank/Cash (Asset)   - asset decreases
"""
from datetime import date
from backend.core.base_model import BaseModel
from backend.core.schema_engine import Doc, LedgerPosting
from backend.core import database as db
from .invoice import _save_ledger_entry, _reverse_ledger_entry


class PaymentModel(BaseModel):
    schema_name = "Payment"

    def get_defaults(self, doc: Doc) -> dict:
        return {
            "date": date.today().isoformat(),
            "paymentMethod": "Cash",
            "submitted": False,
            "cancelled": False,
        }

    async def after_submit(self, doc: Doc):
        """Post payment ledger entries (double-entry)."""
        from backend.coa import resolve_account_name
        amount = float(doc.get("amount", 0))
        is_receive = doc.get("paymentType") == "Receive"
        account = resolve_account_name(doc.get("account", "Cash"))
        party = doc.get("party", "")

        # Auto-create party if passed and not present
        if party and isinstance(party, str) and party.strip():
            party = party.strip()
            existing_party = db.get_doc("Party", party)
            if not existing_party:
                party_type = "Customer" if is_receive else "Supplier"
                new_party = Doc("Party", {"name": party, "partyType": party_type})
                new_party._not_inserted = True
                db.insert_doc(new_party)

        posting = LedgerPosting(doc)

        if is_receive:
            posting.debit(account, amount)
            posting.credit("Debtors", amount)
        else:
            posting.debit("Creditors", amount)
            posting.credit(account, amount)

        posting.validate()
        for entry in posting.get_entries():
            _save_ledger_entry(entry)

        ref_type = doc.get("referenceType")
        ref_name = doc.get("referenceName")
        if ref_type and ref_name:
            inv = db.get_doc(ref_type, ref_name)
            if inv:
                outstanding = float(inv.get("outstandingAmount", 0)) - amount
                inv._data["outstandingAmount"] = max(0, outstanding)
                db.update_doc(inv)

        doc._data["submitted"] = True
        doc._data["cancelled"] = False
        db.update_doc(doc)

    async def after_cancel(self, doc: Doc):
        """Reverse all ledger entries for this payment."""
        entries = db.get_ledger_entries()
        for entry in entries:
            if entry.get("reference_name") == doc.get("name"):
                _reverse_ledger_entry(entry)

        # Restore outstanding amount on referenced invoice
        ref_type = doc.get("referenceType")
        ref_name = doc.get("referenceName")
        amount = float(doc.get("amount", 0))
        if ref_type and ref_name:
            inv = db.get_doc(ref_type, ref_name)
            if inv:
                outstanding = float(inv.get("outstandingAmount", 0)) + amount
                inv._data["outstandingAmount"] = outstanding
                db.update_doc(inv)

        doc._data["submitted"] = False
        doc._data["cancelled"] = True
        db.update_doc(doc)
