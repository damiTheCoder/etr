"""
Invoice base model - mirrors models/baseModels/Invoice/Invoice.ts

Handles common invoice logic:
  - Item amount calculation
  - Discount application (amount or percent)
  - Tax computation
  - Double-entry ledger posting on submit
  - Ledger reversal on cancel

Ledger posting rules per accounting standards:
  Sales Invoice:
    Debit: Debtors (Receivable)  - asset increases
    Credit: Sales (Income)       - income increases
    Credit: Output Tax Payable    - liability increases
  Purchase Invoice:
    Debit: Cost of Goods Sold (Expense) - expense increases
    Debit: Input Tax Credit (Asset)     - asset increases
    Credit: Creditors (Payable)          - liability increases
"""
from datetime import date
from typing import Any, Optional
from backend.core.base_model import BaseModel
from backend.core.schema_engine import Doc, LedgerPosting
from backend.core import database as db


def safe_float(val: Any, default: float = 0.0) -> float:
    if val is None or val == "":
        return float(default)
    try:
        return float(val)
    except (ValueError, TypeError):
        return float(default)


class InvoiceModel(BaseModel):
    schema_name = "Invoice"

    def get_defaults(self, doc: Doc) -> dict:
        return {
            "date": date.today().isoformat(),
            "currency": "USD",
            "exchangeRate": 1,
            "netTotal": 0,
            "taxTotal": 0,
            "grandTotal": 0,
            "baseGrandTotal": 0,
            "outstandingAmount": 0,
            "discountAmount": 0,
            "discountPercent": 0,
            "submitted": False,
            "cancelled": False,
        }

    async def before_sync(self, doc: Doc):
        """Calculate totals, taxes, and discounts before saving."""
        # Auto-create party if passed and doc doesn't exist in DB
        party_name = doc.get("party")
        if party_name and isinstance(party_name, str) and party_name.strip():
            party_name = party_name.strip()
            doc._data["party"] = party_name
            existing_party = db.get_doc("Party", party_name)
            if not existing_party:
                party_type = "Customer" if doc.schema_name == "SalesInvoice" else "Supplier"
                new_party = Doc("Party", {"name": party_name, "partyType": party_type})
                new_party._not_inserted = True
                db.insert_doc(new_party)

        items_data = doc.get("items", [])
        net_total = 0.0

        for item in items_data:
            if isinstance(item, dict):
                item_name = item.get("item")
                if item_name and isinstance(item_name, str) and item_name.strip():
                    item_name = item_name.strip()
                    item["item"] = item_name
                    existing_item = db.get_doc("Item", item_name)
                    if not existing_item:
                        new_item = Doc("Item", {
                            "name": item_name,
                            "rate": safe_float(item.get("rate"), 0),
                            "incomeAccount": "Sales",
                            "expenseAccount": "Cost of Goods Sold",
                        })
                        new_item._not_inserted = True
                        db.insert_doc(new_item)

                qty = safe_float(item.get("quantity"), 1)
                rate = safe_float(item.get("rate"), 0)
                amount = qty * rate
                item["amount"] = amount
                base_amount = amount * safe_float(doc.get("exchangeRate"), 1)
                item["baseAmount"] = base_amount
                net_total += amount

        doc._data["netTotal"] = net_total

        # Apply discount
        discount = safe_float(doc.get("discountAmount"), 0)
        discount_pct = safe_float(doc.get("discountPercent"), 0)
        if discount_pct > 0 and net_total > 0:
            discount = net_total * (discount_pct / 100)
            doc._data["discountAmount"] = discount

        discounted_total = net_total - discount

        # Compute taxes
        tax_total = 0.0
        taxes_data = doc.get("taxes", [])
        if taxes_data:
            for tax_row in taxes_data:
                if isinstance(tax_row, dict):
                    tax_rate = safe_float(tax_row.get("rate"), 0)
                    tax_amount = discounted_total * (tax_rate / 100)
                    tax_row["amount"] = tax_amount
                    tax_total += tax_amount

        doc._data["taxTotal"] = tax_total
        grand_total = discounted_total + tax_total
        doc._data["grandTotal"] = grand_total

        exchange_rate = safe_float(doc.get("exchangeRate"), 1)
        doc._data["baseGrandTotal"] = grand_total * exchange_rate

        if not doc.get("submitted"):
            doc._data["outstandingAmount"] = grand_total

    async def after_submit(self, doc: Doc):
        """Post ledger entries (double-entry accounting)."""
        posting = LedgerPosting(doc)

        is_sales = doc.schema_name == "SalesInvoice"
        exchange_rate = safe_float(doc.get("exchangeRate"), 1)
        base_grand_total = safe_float(doc.get("baseGrandTotal"), 0)

        if is_sales:
            # Debit Debtors (Receivable) — Asset increases
            posting.debit("Debtors", base_grand_total)

            # Credit Sales (Income) for each item — Income increases
            net_total = safe_float(doc.get("netTotal"), 0) * exchange_rate
            discount = safe_float(doc.get("discountAmount"), 0) * exchange_rate
            discounted_total = net_total - discount

            items_data = doc.get("items", [])
            if items_data:
                for item in items_data:
                    if isinstance(item, dict):
                        account = item.get("account", "Sales")
                        item_base = item.get("baseAmount")
                        item_amt = item.get("amount")
                        amount = safe_float(item_base if item_base is not None else item_amt, 0)
                        if amount > 0:
                            posting.credit(account, amount)
            else:
                posting.credit("Sales", discounted_total)

            # Credit Output Tax Payable — Liability increases
            tax_total = safe_float(doc.get("taxTotal"), 0) * exchange_rate
            if tax_total > 0:
                posting.credit("Output Tax Payable", tax_total)

        else:
            # Purchase Invoice
            # Credit Creditors (Payable) — Liability increases
            posting.credit("Creditors", base_grand_total)

            # Debit COGS/Expense accounts — Expense increases
            items_data = doc.get("items", [])
            if items_data:
                for item in items_data:
                    if isinstance(item, dict):
                        account = item.get("account", "Cost of Goods Sold")
                        item_base = item.get("baseAmount")
                        item_amt = item.get("amount")
                        amount = safe_float(item_base if item_base is not None else item_amt, 0)
                        if amount > 0:
                            posting.debit(account, amount)
            else:
                posting.debit("Cost of Goods Sold", safe_float(doc.get("netTotal"), 0) * exchange_rate)

            # Debit Input Tax Credit — Asset increases
            tax_total = safe_float(doc.get("taxTotal"), 0) * exchange_rate
            if tax_total > 0:
                posting.debit("Input Tax Credit", tax_total)

        posting.validate()
        for entry in posting.get_entries():
            _save_ledger_entry(entry)

        doc._data["submitted"] = True
        doc._data["cancelled"] = False
        db.update_doc(doc)

    async def after_cancel(self, doc: Doc):
        """Reverse all ledger entries for this document."""
        entries = db.get_ledger_entries()
        for entry in entries:
            if entry.get("reference_name") == doc.get("name"):
                _reverse_ledger_entry(entry)

        doc._data["submitted"] = False
        doc._data["cancelled"] = True
        db.update_doc(doc)


def _save_ledger_entry(entry) -> str:
    """Save a single ledger entry to the AccountingLedgerEntry table if not already saved."""
    conn = db.get_connection()
    ref_type = getattr(entry, "reference_type", "")
    ref_name = getattr(entry, "reference_name", "")
    acct = getattr(entry, "account", "")
    dr = safe_float(getattr(entry, "debit", 0), 0)
    cr = safe_float(getattr(entry, "credit", 0), 0)
    dt = entry.date.isoformat() if hasattr(entry.date, "isoformat") else str(entry.date)

    if ref_type and ref_name:
        existing = conn.execute(
            """SELECT name FROM AccountingLedgerEntry
               WHERE reference_type = ? AND reference_name = ? AND account = ? AND debit = ? AND credit = ? AND reverted = 0""",
            (ref_type, ref_name, acct, dr, cr)
        ).fetchone()
        if existing:
            return existing[0]

    import uuid
    name = str(uuid.uuid4())[:8]
    conn.execute(
        """INSERT INTO AccountingLedgerEntry
           (name, account, party, date, debit, credit, reference_type, reference_name, reverted)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)""",
        (name, acct, getattr(entry, "party", "") or "", dt, dr, cr, ref_type, ref_name)
    )
    conn.commit()
    return name


def _reverse_ledger_entry(entry: dict):
    """Reverse a ledger entry by swapping debit/credit and marking as reverted."""
    conn = db.get_connection()
    import uuid
    name = str(uuid.uuid4())[:8]
    conn.execute(
        """INSERT INTO AccountingLedgerEntry
           (name, account, party, date, debit, credit, reference_type, reference_name, reverted)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)""",
        (name, entry["account"], entry.get("party", ""), entry.get("date", ""),
         safe_float(entry.get("credit"), 0), safe_float(entry.get("debit"), 0),
         entry.get("reference_type", ""), entry.get("reference_name", ""))
    )
    conn.commit()

