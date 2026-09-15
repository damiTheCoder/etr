"""
Journal Builder Core Engine.
Automates double-entry Journal Entry creation based on Default Account Mapping settings.
Implements integer cents precision, multi-tenancy (company_id), idempotency, and audit logging.
"""
from decimal import Decimal
from datetime import date
from typing import Any, Dict, List, Optional

from backend.core import database as db
from backend.core.errors import (
    AccountTypeMismatchError,
    PeriodClosedError,
    SettingsIncompleteError,
    UnbalancedEntryError,
)
from backend.models import get_model
from backend.models.settings_model import get_company_settings


def _amount_to_cents(amount: float | Decimal) -> int:
    """Convert floating/decimal amount to exact integer cents to eliminate floating point issues."""
    return int(round(Decimal(str(amount)) * 100))


def _ensure_account_exists(account_name_or_id: str, key_label: str):
    acct = db.get_doc("Account", account_name_or_id)
    if not acct:
        docs = db.get_all_docs("Account", {"name": account_name_or_id})
        if docs:
            acct = docs[0]
    if not acct:
        raise SettingsIncompleteError(
            f"Configured account '{account_name_or_id}' for '{key_label}' does not exist in Chart of Accounts."
        )


def _resolve_account(
    account_key: str,
    override_accounts: Optional[Dict[str, str]],
    company_id: str,
    fallback_name: Optional[str] = None
) -> str:
    """
    Resolve account ID/name for a given key (e.g., 'sales_income', 'receivable').
    Fetches fresh company settings per transaction.
    Raises SettingsIncompleteError if account mapping is missing or referenced account is deleted from COA.
    """
    long_key = f"default_{account_key}_account_id"
    if override_accounts:
        if account_key in override_accounts and override_accounts[account_key]:
            acct_id = override_accounts[account_key]
            _ensure_account_exists(acct_id, account_key)
            return acct_id
        if long_key in override_accounts and override_accounts[long_key]:
            acct_id = override_accounts[long_key]
            _ensure_account_exists(acct_id, account_key)
            return acct_id

    settings = get_company_settings(company_id)
    acct_ref = settings.defaults.get(account_key)

    if not acct_ref or not acct_ref.id:
        raise SettingsIncompleteError(
            f"Settings incomplete for company '{company_id}': '{long_key}' is not configured. "
            f"Go to Settings -> Default Transaction Accounts."
        )

    # Check if configured account exists in Chart of Accounts
    acct_doc = db.get_doc("Account", acct_ref.id)
    if not acct_doc:
        docs = db.get_all_docs("Account", {"name": acct_ref.id})
        if docs:
            acct_doc = docs[0]

    if not acct_doc:
        raise SettingsIncompleteError(
            f"Settings incomplete for company '{company_id}': Account ID '{acct_ref.id}' "
            f"referenced in settings '{long_key}' no longer exists in Chart of Accounts."
        )

    return str(acct_doc.get("name"))



async def _validate_and_build_entry(
    company_id: str,
    entry_date: str,
    entry_type: str,
    remark: str,
    lines: List[Dict[str, Any]],
    idempotency_key: Optional[str] = None,
    reference_type: Optional[str] = None,
    reference_name: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Validates double-entry cents balance, enforces period lock, enforces idempotency, and creates/posts JournalEntry.
    """
    # 0. Period Locking Guard
    from backend.core.close_management import is_posting_allowed, get_period_for_date
    effective_date = entry_date or date.today().isoformat()
    if not is_posting_allowed(company_id, effective_date):
        period = get_period_for_date(company_id, effective_date)
        label = period.get("label") if period else effective_date
        raise PeriodClosedError(
            label,
            f"Cannot post to closed period '{label}'. Contact an administrator to reopen the period."
        )

    # 1. Idempotency Check (Option A: return existing without raising)

    if idempotency_key:
        existing_entries = db.get_all_docs("JournalEntry", {"idempotency_key": idempotency_key})
        if existing_entries:
            return existing_entries[0].to_dict()

    # 2. Convert and validate double-entry balance in integer cents
    total_debit_cents = 0
    total_credit_cents = 0

    for line in lines:
        debit_cents = _amount_to_cents(line.get("debit", 0))
        credit_cents = _amount_to_cents(line.get("credit", 0))
        total_debit_cents += debit_cents
        total_credit_cents += credit_cents

    if total_debit_cents != total_credit_cents:
        raise UnbalancedEntryError(
            f"Unbalanced Journal Entry: Total Debits = {total_debit_cents} cents, "
            f"Total Credits = {total_credit_cents} cents."
        )

    # 3. Create document using JournalEntryModel
    je_model = get_model("JournalEntry")
    payload = {
        "company_id": company_id,
        "date": entry_date or date.today().isoformat(),
        "entryType": entry_type,
        "user_remark": remark,
        "idempotency_key": idempotency_key,
        "referenceType": reference_type,
        "referenceName": reference_name,
        "accounts": lines,
    }

    doc = je_model.create(payload)
    await je_model.before_sync(doc)
    je_model.save(doc)
    await je_model.after_submit(doc)

    db.add_audit_log(
        ref_type="JournalEntry",
        ref_name=doc.name,
        action="POST_AUTO",
        details=f"Auto-generated {entry_type} for company {company_id} (idempotency: {idempotency_key})"
    )

    return doc.to_dict()


# ─── 9 Transaction Flows ─────────────────────────────────────────────────────

async def build_sales_invoice_entry(
    company_id: str,
    amount: float,
    customer_name: str,
    date_str: str,
    remark: str = "",
    idempotency_key: Optional[str] = None,
    override_accounts: Optional[Dict[str, str]] = None,
    reference_name: Optional[str] = None,
) -> Dict[str, Any]:
    """Flow 1: Sales Invoice without tax."""
    receivable_acct = _resolve_account("receivable", override_accounts, company_id)
    sales_acct = _resolve_account("sales_income", override_accounts, company_id)

    lines = [
        {"account": receivable_acct, "debit": amount, "credit": 0.0, "party": customer_name},
        {"account": sales_acct, "debit": 0.0, "credit": amount, "party": ""},
    ]
    return await _validate_and_build_entry(
        company_id=company_id,
        entry_date=date_str,
        entry_type="Sales Invoice",
        remark=remark or f"Sales Invoice for {customer_name}",
        lines=lines,
        idempotency_key=idempotency_key,
        reference_type="SalesInvoice",
        reference_name=reference_name,
    )


async def build_sales_invoice_with_tax_entry(
    company_id: str,
    net_amount: float,
    tax_amount: float,
    customer_name: str,
    date_str: str,
    remark: str = "",
    idempotency_key: Optional[str] = None,
    override_accounts: Optional[Dict[str, str]] = None,
    reference_name: Optional[str] = None,
) -> Dict[str, Any]:
    """Flow 2: Sales Invoice with Sales Tax."""
    receivable_acct = _resolve_account("receivable", override_accounts, company_id)
    sales_acct = _resolve_account("sales_income", override_accounts, company_id)
    tax_acct = _resolve_account("tax_payable", override_accounts, company_id)

    total_amount = net_amount + tax_amount
    lines = [
        {"account": receivable_acct, "debit": total_amount, "credit": 0.0, "party": customer_name},
        {"account": sales_acct, "debit": 0.0, "credit": net_amount, "party": ""},
        {"account": tax_acct, "debit": 0.0, "credit": tax_amount, "party": ""},
    ]
    return await _validate_and_build_entry(
        company_id=company_id,
        entry_date=date_str,
        entry_type="Sales Invoice",
        remark=remark or f"Sales Invoice with Tax for {customer_name}",
        lines=lines,
        idempotency_key=idempotency_key,
        reference_type="SalesInvoice",
        reference_name=reference_name,
    )


async def build_customer_payment_entry(
    company_id: str,
    amount: float,
    customer_name: str,
    date_str: str,
    payment_method: str = "Cash",
    remark: str = "",
    idempotency_key: Optional[str] = None,
    override_accounts: Optional[Dict[str, str]] = None,
    reference_name: Optional[str] = None,
) -> Dict[str, Any]:
    """Flow 3: Customer Payment receipt."""
    payment_key = "cash" if payment_method.lower() == "cash" else "bank"
    payment_acct = _resolve_account(payment_key, override_accounts, company_id)
    receivable_acct = _resolve_account("receivable", override_accounts, company_id)

    lines = [
        {"account": payment_acct, "debit": amount, "credit": 0.0, "party": ""},
        {"account": receivable_acct, "debit": 0.0, "credit": amount, "party": customer_name},
    ]
    return await _validate_and_build_entry(
        company_id=company_id,
        entry_date=date_str,
        entry_type="Payment",
        remark=remark or f"Customer Payment from {customer_name}",
        lines=lines,
        idempotency_key=idempotency_key,
        reference_type="Payment",
        reference_name=reference_name,
    )


async def build_vendor_bill_entry(
    company_id: str,
    amount: float,
    vendor_name: str,
    date_str: str,
    remark: str = "",
    idempotency_key: Optional[str] = None,
    override_accounts: Optional[Dict[str, str]] = None,
    reference_name: Optional[str] = None,
) -> Dict[str, Any]:
    """Flow 4: Vendor Bill without tax."""
    expense_acct = _resolve_account("purchase_expense", override_accounts, company_id)
    payable_acct = _resolve_account("payable", override_accounts, company_id)

    lines = [
        {"account": expense_acct, "debit": amount, "credit": 0.0, "party": ""},
        {"account": payable_acct, "debit": 0.0, "credit": amount, "party": vendor_name},
    ]
    return await _validate_and_build_entry(
        company_id=company_id,
        entry_date=date_str,
        entry_type="Vendor Bill",
        remark=remark or f"Vendor Bill from {vendor_name}",
        lines=lines,
        idempotency_key=idempotency_key,
        reference_type="PurchaseInvoice",
        reference_name=reference_name,
    )


async def build_vendor_bill_with_tax_entry(
    company_id: str,
    net_amount: float,
    tax_amount: float,
    vendor_name: str,
    date_str: str,
    remark: str = "",
    idempotency_key: Optional[str] = None,
    override_accounts: Optional[Dict[str, str]] = None,
    reference_name: Optional[str] = None,
) -> Dict[str, Any]:
    """Flow 5: Vendor Bill with Purchase Tax."""
    expense_acct = _resolve_account("purchase_expense", override_accounts, company_id)
    tax_acct = _resolve_account("tax_receivable", override_accounts, company_id)
    payable_acct = _resolve_account("payable", override_accounts, company_id)

    total_amount = net_amount + tax_amount
    lines = [
        {"account": expense_acct, "debit": net_amount, "credit": 0.0, "party": ""},
        {"account": tax_acct, "debit": tax_amount, "credit": 0.0, "party": ""},
        {"account": payable_acct, "debit": 0.0, "credit": total_amount, "party": vendor_name},
    ]
    return await _validate_and_build_entry(
        company_id=company_id,
        entry_date=date_str,
        entry_type="Vendor Bill",
        remark=remark or f"Vendor Bill with Tax from {vendor_name}",
        lines=lines,
        idempotency_key=idempotency_key,
        reference_type="PurchaseInvoice",
        reference_name=reference_name,
    )


async def build_vendor_payment_entry(
    company_id: str,
    amount: float,
    vendor_name: str,
    date_str: str,
    payment_method: str = "Bank",
    remark: str = "",
    idempotency_key: Optional[str] = None,
    override_accounts: Optional[Dict[str, str]] = None,
    reference_name: Optional[str] = None,
) -> Dict[str, Any]:
    """Flow 6: Vendor Payment disbursement."""
    payable_acct = _resolve_account("payable", override_accounts, company_id)
    payment_key = "cash" if payment_method.lower() == "cash" else "bank"
    payment_acct = _resolve_account(payment_key, override_accounts, company_id)

    lines = [
        {"account": payable_acct, "debit": amount, "credit": 0.0, "party": vendor_name},
        {"account": payment_acct, "debit": 0.0, "credit": amount, "party": ""},
    ]
    return await _validate_and_build_entry(
        company_id=company_id,
        entry_date=date_str,
        entry_type="Payment",
        remark=remark or f"Vendor Payment to {vendor_name}",
        lines=lines,
        idempotency_key=idempotency_key,
        reference_type="Payment",
        reference_name=reference_name,
    )


async def build_early_payment_discount_entry(
    company_id: str,
    discount_amount: float,
    party_name: str,
    date_str: str,
    is_customer: bool = True,
    remark: str = "",
    idempotency_key: Optional[str] = None,
    override_accounts: Optional[Dict[str, str]] = None,
    reference_name: Optional[str] = None,
) -> Dict[str, Any]:
    """Flow 7: Early payment discount given or received."""
    discount_acct = _resolve_account("discount_allowed", override_accounts, company_id)

    if is_customer:
        receivable_acct = _resolve_account("receivable", override_accounts, company_id)
        lines = [
            {"account": discount_acct, "debit": discount_amount, "credit": 0.0, "party": ""},
            {"account": receivable_acct, "debit": 0.0, "credit": discount_amount, "party": party_name},
        ]
    else:
        payable_acct = _resolve_account("payable", override_accounts, company_id)
        lines = [
            {"account": payable_acct, "debit": discount_amount, "credit": 0.0, "party": party_name},
            {"account": discount_acct, "debit": 0.0, "credit": discount_amount, "party": ""},
        ]

    return await _validate_and_build_entry(
        company_id=company_id,
        entry_date=date_str,
        entry_type="Discount",
        remark=remark or f"Early Payment Discount for {party_name}",
        lines=lines,
        idempotency_key=idempotency_key,
        reference_name=reference_name,
    )


async def build_rounding_adjustment_entry(
    company_id: str,
    adjustment_amount: float,
    date_str: str,
    offset_account_id: str,
    remark: str = "",
    idempotency_key: Optional[str] = None,
    override_accounts: Optional[Dict[str, str]] = None,
    reference_name: Optional[str] = None,
) -> Dict[str, Any]:
    """Flow 8: Small rounding adjustment entry."""
    round_off_acct = _resolve_account("round_off", override_accounts, company_id)
    _ensure_account_exists(offset_account_id, "offset_account_id")

    abs_amount = abs(adjustment_amount)
    if adjustment_amount > 0:
        lines = [
            {"account": round_off_acct, "debit": abs_amount, "credit": 0.0, "party": ""},
            {"account": offset_account_id, "debit": 0.0, "credit": abs_amount, "party": ""},
        ]
    else:
        lines = [
            {"account": offset_account_id, "debit": abs_amount, "credit": 0.0, "party": ""},
            {"account": round_off_acct, "debit": 0.0, "credit": abs_amount, "party": ""},
        ]

    return await _validate_and_build_entry(
        company_id=company_id,
        entry_date=date_str,
        entry_type="Adjustment Entry",
        remark=remark or f"Rounding adjustment of {adjustment_amount}",
        lines=lines,
        idempotency_key=idempotency_key,
        reference_name=reference_name,
    )


async def build_depreciation_run_entry(
    company_id: str,
    amount: float,
    date_str: str,
    remark: str = "",
    idempotency_key: Optional[str] = None,
    override_accounts: Optional[Dict[str, str]] = None,
    reference_name: Optional[str] = None,
) -> Dict[str, Any]:
    """Flow 9: Fixed asset depreciation run."""
    deprec_acct = _resolve_account("depreciation", override_accounts, company_id)
    accum_acct = _resolve_account("accumulated_depreciation", override_accounts, company_id)

    lines = [
        {"account": deprec_acct, "debit": amount, "credit": 0.0, "party": ""},
        {"account": accum_acct, "debit": 0.0, "credit": amount, "party": ""},
    ]

    return await _validate_and_build_entry(
        company_id=company_id,
        entry_date=date_str,
        entry_type="Depreciation Entry",
        remark=remark or "Fixed asset depreciation run",
        lines=lines,
        idempotency_key=idempotency_key,
        reference_name=reference_name,
    )


# ─── Special Operations ───────────────────────────────────────────────────────

async def build_reversal_entry(
    company_id: str,
    original_entry_id: str,
    created_by: str = "system",
    date_str: Optional[str] = None,
    remark: str = "",
    idempotency_key: Optional[str] = None,
) -> Dict[str, Any]:
    """Reverses an existing journal entry by swapping debits and credits."""
    original_doc = db.get_doc("JournalEntry", original_entry_id)
    if not original_doc:
        docs = db.get_all_docs("JournalEntry", {"name": original_entry_id})
        if docs:
            original_doc = docs[0]

    if not original_doc:
        raise ValueError(f"Original journal entry '{original_entry_id}' not found.")

    # ─── Reconciliation Lock Guard ──────────────────────────────────────────
    conn = db.get_connection()
    reconciled_check = conn.execute(
        "SELECT name, reconciliation_id FROM AccountingLedgerEntry WHERE reference_name = ? AND reconciled = 1",
        (original_entry_id,)
    ).fetchall()
    if reconciled_check:
        recon_ids = ", ".join({r[1] for r in reconciled_check if r[1]}) or "bank statement"
        raise ValueError(
            f"Journal entry '{original_entry_id}' contains reconciled bank ledger entries (Statement: {recon_ids}) "
            "and cannot be reversed. Un-reconcile the bank statement first."
        )


    original_accounts = original_doc.get("accounts", [])
    reversed_lines = []
    for line in original_accounts:
        if isinstance(line, dict):
            reversed_lines.append({
                "account": line.get("account", ""),
                "debit": line.get("credit", 0.0),
                "credit": line.get("debit", 0.0),
                "party": line.get("party", ""),
            })

    rev_date = date_str or date.today().isoformat()
    rev_remark = remark or f"Reversal of Journal Entry {original_entry_id} (Created by {created_by})"

    return await _validate_and_build_entry(
        company_id=company_id,
        entry_date=rev_date,
        entry_type="Reversal Entry",
        remark=rev_remark,
        lines=reversed_lines,
        idempotency_key=idempotency_key,
        reference_type="JournalEntry",
        reference_name=original_entry_id,
    )


async def build_fx_adjustment_entry(
    company_id: str,
    gain_loss_amount: float,
    account_id: str,
    date_str: str,
    remark: str = "",
    idempotency_key: Optional[str] = None,
    override_accounts: Optional[Dict[str, str]] = None,
    reference_name: Optional[str] = None,
) -> Dict[str, Any]:
    """Unrealized FX gain/loss adjustment entry."""
    fx_acct = _resolve_account("fx_gain_loss", override_accounts, company_id)
    _ensure_account_exists(account_id, "account_id")

    abs_amount = abs(gain_loss_amount)
    if gain_loss_amount > 0:
        # Gain: Debit asset/liability account, Credit FX Gain account
        lines = [
            {"account": account_id, "debit": abs_amount, "credit": 0.0, "party": ""},
            {"account": fx_acct, "debit": 0.0, "credit": abs_amount, "party": ""},
        ]
    else:
        # Loss: Debit FX Loss account, Credit asset/liability account
        lines = [
            {"account": fx_acct, "debit": abs_amount, "credit": 0.0, "party": ""},
            {"account": account_id, "debit": 0.0, "credit": abs_amount, "party": ""},
        ]

    return await _validate_and_build_entry(
        company_id=company_id,
        entry_date=date_str,
        entry_type="Adjustment Entry",
        remark=remark or f"Unrealized FX adjustment for {account_id}",
        lines=lines,
        idempotency_key=idempotency_key,
        reference_name=reference_name,
    )
