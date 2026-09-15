"""
Close Management & Period Locking Core Engine.
Handles month-end close workflows, period locking, 8 auto-check tasks,
and append-only audit trail logging.
"""
from datetime import datetime, date
import calendar
import json
from typing import Any, Dict, List, Optional, Tuple

from backend.core import database as db
from backend.core.errors import PeriodClosedError
from backend.models import get_model


# ─── Date & Label Utilities ──────────────────────────────────────────────────

def _normalize_date_str(date_val: str | date | datetime) -> str:
    if isinstance(date_val, (date, datetime)):
        return date_val.strftime("%Y-%m-%d")
    val = str(date_val).strip()
    if "T" in val:
        val = val.split("T")[0]
    return val[:10]


def get_fiscal_period_bounds(company_id: str, date_val: str | date | datetime) -> Tuple[str, str, str]:
    """
    Computes period start, period end, and label respecting the company's fiscal year settings.
    Reads fiscal_year_start (1..12) from company settings per request.
    """
    from backend.models.settings_model import get_company_settings
    settings = get_company_settings(company_id)
    fy_start_month = settings.company.fiscal_year_start or 1

    dt_str = _normalize_date_str(date_val)
    dt = datetime.strptime(dt_str, "%Y-%m-%d")
    year = dt.year
    month = dt.month

    last_day = calendar.monthrange(year, month)[1]
    p_start = f"{year:04d}-{month:02d}-01T00:00:00Z"
    p_end = f"{year:04d}-{month:02d}-{last_day:02d}T23:59:59Z"
    month_name = dt.strftime("%B")

    if fy_start_month == 1:
        label = f"{month_name} {year}"
    else:
        if month >= fy_start_month:
            fy_label = f"FY {year}/{year+1}"
        else:
            fy_label = f"FY {year-1}/{year}"
        label = f"{month_name} {year} ({fy_label})"

    return p_start, p_end, label


def _get_month_bounds(date_val: str | date | datetime) -> Tuple[str, str, str]:
    """Returns (period_start_iso, period_end_iso, period_label) for default company."""
    return get_fiscal_period_bounds("default_company", date_val)


# ─── Period Management ────────────────────────────────────────────────────────

def get_or_create_period(company_id: str, period_start: str | date | datetime) -> Dict[str, Any]:
    """Idempotently fetches or creates a fiscal period for the month of period_start."""
    p_start, p_end, label = get_fiscal_period_bounds(company_id, period_start)

    # Search existing
    existing = db.get_all_docs("FiscalPeriod", {"company_id": company_id})
    for p in existing:
        if p.get("period_start") == p_start or p.get("label") == label:
            return p.to_dict()

    # Create new OPEN period
    fp_model = get_model("FiscalPeriod")
    now_str = datetime.utcnow().isoformat() + "Z"
    payload = {
        "company_id": company_id,
        "period_start": p_start,
        "period_end": p_end,
        "label": label,
        "status": "OPEN",
        "checklist_snapshot": json.dumps([]),
        "created_at": now_str,
        "updated_at": now_str,
    }
    doc = fp_model.create(payload)
    fp_model.save(doc)
    return doc.to_dict()


def get_period_for_date(company_id: str, entry_date: str | date | datetime) -> Optional[Dict[str, Any]]:
    """Returns the fiscal period containing entry_date, or None if no period exists."""
    dt_str = _normalize_date_str(entry_date)
    all_periods = db.get_all_docs("FiscalPeriod", {"company_id": company_id})

    for p in all_periods:
        p_start_date = p.get("period_start", "")[:10]
        p_end_date = p.get("period_end", "")[:10]
        if p_start_date <= dt_str <= p_end_date:
            return p.to_dict()
    return None


def is_posting_allowed(company_id: str, entry_date: str | date | datetime) -> bool:
    """
    Returns False if entry_date falls into a CLOSED or LOCKED period.
    Returns True if period is OPEN, CLOSING, or if no period exists (Option A).
    """
    period = get_period_for_date(company_id, entry_date)
    if not period:
        return True
    if period.get("status") in ["CLOSED", "LOCKED"]:
        return False
    return True


# ─── Close Checklist Templates ────────────────────────────────────────────────

DEFAULT_CHECKLIST_TASKS = [
    {
        "task_id": "bank_reconciled",
        "label": "All bank accounts reconciled",
        "description": "Count unreconciled ledger entries for bank accounts in period date range.",
        "is_required": True,
        "auto_check": True,
        "check_function": "check_bank_reconciled",
        "sort_order": 1,
    },
    {
        "task_id": "no_draft_entries",
        "label": "No draft journal entries in this period",
        "description": "Ensure all journal entries in the period are submitted or posted.",
        "is_required": True,
        "auto_check": True,
        "check_function": "check_no_draft_entries",
        "sort_order": 2,
    },
    {
        "task_id": "no_pending_approvals",
        "label": "No pending approvals in this period",
        "description": "Ensure no documents remain in pending approval state.",
        "is_required": True,
        "auto_check": True,
        "check_function": "check_no_pending_approvals",
        "sort_order": 3,
    },
    {
        "task_id": "depreciation_posted",
        "label": "Depreciation posted for the period",
        "description": "Verify depreciation entry has been posted if company owns fixed assets.",
        "is_required": True,
        "auto_check": True,
        "check_function": "check_depreciation_posted",
        "sort_order": 4,
    },
    {
        "task_id": "invoices_posted",
        "label": "All customer invoices posted",
        "description": "Verify all customer invoices in period are submitted/posted.",
        "is_required": True,
        "auto_check": True,
        "check_function": "check_invoices_posted",
        "sort_order": 5,
    },
    {
        "task_id": "bills_posted",
        "label": "All vendor bills posted",
        "description": "Verify all vendor bills in period are submitted/posted.",
        "is_required": True,
        "auto_check": True,
        "check_function": "check_bills_posted",
        "sort_order": 6,
    },
    {
        "task_id": "trial_balance_balanced",
        "label": "Trial Balance is balanced (debits == credits)",
        "description": "Ensure total debits equal total credits for period ledger entries.",
        "is_required": True,
        "auto_check": True,
        "check_function": "check_trial_balance_balanced",
        "sort_order": 7,
    },
    {
        "task_id": "no_unposted_fx",
        "label": "No unposted FX adjustments",
        "description": "Ensure no draft foreign exchange adjustment entries exist.",
        "is_required": True,
        "auto_check": True,
        "check_function": "check_no_unposted_fx",
        "sort_order": 8,
    },
]


def get_or_create_checklist_template(company_id: str) -> Dict[str, Any]:
    """Fetch or initialize default checklist template for company."""
    templates = db.get_all_docs("CloseChecklistTemplate", {"company_id": company_id})
    for t in templates:
        if t.get("is_active", True):
            return t.to_dict()

    # Create default template
    now_str = datetime.utcnow().isoformat() + "Z"
    tmpl_model = get_model("CloseChecklistTemplate")
    doc = tmpl_model.create({
        "company_id": company_id,
        "tasks": json.dumps(DEFAULT_CHECKLIST_TASKS),
        "is_active": True,
        "created_at": now_str,
        "updated_at": now_str,
    })
    tmpl_model.save(doc)
    return doc.to_dict()


# ─── 8 Auto-Check Functions ───────────────────────────────────────────────────

def check_bank_reconciled(company_id: str, period: Dict[str, Any]) -> Tuple[str, str]:
    p_start = period.get("period_start", "")[:10]
    p_end = period.get("period_end", "")[:10]

    all_entries = db.get_ledger_entries()
    unreconciled_count = 0
    for e in all_entries:
        if e.get("reverted"):
            continue
        dt = e.get("date", "")[:10]
        if p_start <= dt <= p_end:
            acct = e.get("account", "").lower()
            if "bank" in acct or "cash" in acct:
                if not e.get("reconciled"):
                    unreconciled_count += 1

    if unreconciled_count == 0:
        return ("PASS", "All bank accounts reconciled")
    return ("FAIL", f"{unreconciled_count} unreconciled bank ledger entries found")


def check_no_draft_entries(company_id: str, period: Dict[str, Any]) -> Tuple[str, str]:
    p_start = period.get("period_start", "")[:10]
    p_end = period.get("period_end", "")[:10]

    jes = db.get_all_docs("JournalEntry", {"company_id": company_id})
    draft_count = 0
    for je in jes:
        dt = je.get("date", "")[:10]
        if p_start <= dt <= p_end:
            st = je.get("status", "Draft")
            submitted = je.get("submitted", False)
            if st == "Draft" or not submitted:
                if not je.get("cancelled"):
                    draft_count += 1

    if draft_count == 0:
        return ("PASS", "No draft journal entries in period")
    return ("FAIL", f"{draft_count} draft journal entries found in period")


def check_no_pending_approvals(company_id: str, period: Dict[str, Any]) -> Tuple[str, str]:
    p_start = period.get("period_start", "")[:10]
    p_end = period.get("period_end", "")[:10]

    jes = db.get_all_docs("JournalEntry", {"company_id": company_id})
    pending_count = 0
    for je in jes:
        dt = je.get("date", "")[:10]
        if p_start <= dt <= p_end:
            if je.get("approvalStatus") == "Pending" and not je.get("cancelled"):
                pending_count += 1

    approvals = db.get_all_docs("Approval", {"company_id": company_id})
    for app in approvals:
        dt = app.get("created_at", "")[:10]
        if p_start <= dt <= p_end:
            if app.get("status") == "Pending":
                pending_count += 1

    if pending_count == 0:
        return ("PASS", "No pending approvals in period")
    return ("FAIL", f"{pending_count} pending approvals found in period")


def check_depreciation_posted(company_id: str, period: Dict[str, Any]) -> Tuple[str, str]:
    p_start = period.get("period_start", "")[:10]
    p_end = period.get("period_end", "")[:10]

    jes = db.get_all_docs("JournalEntry", {"company_id": company_id})
    found_deprec = False
    for je in jes:
        dt = je.get("date", "")[:10]
        if p_start <= dt <= p_end:
            etype = (je.get("entryType") or "").lower()
            reftype = (je.get("referenceType") or "").lower()
            refname = (je.get("referenceName") or "").lower()
            remark = (je.get("user_remark") or "").lower()
            if "depreciation" in etype or "depreciation" in reftype or "depreciation" in refname or "depreciation" in remark:
                if je.get("submitted") or je.get("status") in ["Submitted", "Posted"]:
                    found_deprec = True
                    break

    if found_deprec:
        return ("PASS", "Depreciation entry posted for period")

    # Check if company has fixed asset documents or schedules
    try:
        fixed_assets = db.get_all_docs("FixedAsset", {"company_id": company_id})
    except Exception:
        fixed_assets = []

    if not fixed_assets:
        try:
            fixed_assets = db.get_all_docs("Asset", {"company_id": company_id})
        except Exception:
            fixed_assets = []

    if not fixed_assets:
        return ("SKIPPED", "No fixed asset records found for company")

    return ("FAIL", "Depreciation entry not posted for period")



def check_invoices_posted(company_id: str, period: Dict[str, Any]) -> Tuple[str, str]:
    p_start = period.get("period_start", "")[:10]
    p_end = period.get("period_end", "")[:10]

    try:
        invoices = db.get_all_docs("SalesInvoice")
    except Exception:
        invoices = []

    if not invoices:
        try:
            invoices = db.get_all_docs("Invoice")
        except Exception:
            invoices = []

    unposted = 0
    for inv in invoices:
        cid = inv.get("company_id")
        if cid and cid != company_id:
            continue
        dt = inv.get("date", "")[:10]
        if p_start <= dt <= p_end:
            if not inv.get("submitted") and not inv.get("cancelled"):
                unposted += 1

    if unposted == 0:
        return ("PASS", "All customer invoices posted")
    return ("FAIL", f"{unposted} unposted customer invoices found in period")


def check_bills_posted(company_id: str, period: Dict[str, Any]) -> Tuple[str, str]:
    p_start = period.get("period_start", "")[:10]
    p_end = period.get("period_end", "")[:10]

    try:
        bills = db.get_all_docs("PurchaseInvoice")
    except Exception:
        bills = []

    unposted = 0
    for b in bills:
        cid = b.get("company_id")
        if cid and cid != company_id:
            continue
        dt = b.get("date", "")[:10]
        if p_start <= dt <= p_end:
            if not b.get("submitted") and not b.get("cancelled"):
                unposted += 1

    if unposted == 0:
        return ("PASS", "All vendor bills posted")
    return ("FAIL", f"{unposted} unposted vendor bills found in period")



def check_trial_balance_balanced(company_id: str, period: Dict[str, Any]) -> Tuple[str, str]:
    p_start = period.get("period_start", "")[:10]
    p_end = period.get("period_end", "")[:10]

    all_entries = db.get_ledger_entries()
    total_debit_cents = 0
    total_credit_cents = 0

    for e in all_entries:
        if e.get("reverted"):
            continue
        dt = e.get("date", "")[:10]
        if p_start <= dt <= p_end:
            dr = int(round(float(e.get("debit", 0)) * 100))
            cr = int(round(float(e.get("credit", 0)) * 100))
            total_debit_cents += dr
            total_credit_cents += cr

    if total_debit_cents == total_credit_cents:
        return ("PASS", "Trial Balance is balanced (debits == credits)")
    delta = abs(total_debit_cents - total_credit_cents)
    return ("FAIL", f"Trial Balance unbalanced: Debits ({total_debit_cents}c) != Credits ({total_credit_cents}c), delta = {delta} cents")


def check_no_unposted_fx(company_id: str, period: Dict[str, Any]) -> Tuple[str, str]:
    p_start = period.get("period_start", "")[:10]
    p_end = period.get("period_end", "")[:10]

    jes = db.get_all_docs("JournalEntry", {"company_id": company_id})
    unposted_fx = 0
    for je in jes:
        dt = je.get("date", "")[:10]
        if p_start <= dt <= p_end:
            remark = (je.get("user_remark") or "").lower()
            etype = (je.get("entryType") or "").lower()
            if "fx" in remark or "foreign exchange" in remark or "fx" in etype:
                if not je.get("submitted") and not je.get("cancelled"):
                    unposted_fx += 1

    if unposted_fx == 0:
        return ("PASS", "No unposted FX adjustments")
    return ("FAIL", f"{unposted_fx} unposted FX adjustment entries found")


AUTO_CHECK_MAP = {
    "check_bank_reconciled": check_bank_reconciled,
    "check_no_draft_entries": check_no_draft_entries,
    "check_no_pending_approvals": check_no_pending_approvals,
    "check_depreciation_posted": check_depreciation_posted,
    "check_invoices_posted": check_invoices_posted,
    "check_bills_posted": check_bills_posted,
    "check_trial_balance_balanced": check_trial_balance_balanced,
    "check_no_unposted_fx": check_no_unposted_fx,
}


# ─── Checklist Runner & Close Operations ──────────────────────────────────────

def log_close_audit(
    company_id: str,
    period_id: str,
    action: str,
    user_id: str,
    details: Optional[Dict[str, Any]] = None,
    ip_address: str = "127.0.0.1"
) -> Dict[str, Any]:
    """Append-only audit logger for close management actions."""
    audit_model = get_model("CloseAuditLog")
    now_str = datetime.utcnow().isoformat() + "Z"
    doc = audit_model.create({
        "company_id": company_id,
        "period_id": period_id,
        "action": action,
        "user_id": user_id,
        "timestamp": now_str,
        "details": json.dumps(details or {}),
        "ip_address": ip_address,
    })
    audit_model.save(doc)
    return doc.to_dict()


def run_checklist(company_id: str, period_id: str, user_id: str, persist_snapshot: bool = True) -> Dict[str, Any]:
    period = db.get_doc("FiscalPeriod", period_id)
    if not period:
        docs = db.get_all_docs("FiscalPeriod", {"name": period_id})
        if docs:
            period = docs[0]
    if not period:
        raise ValueError(f"Fiscal period '{period_id}' not found.")

    p_dict = period.to_dict()
    tmpl = get_or_create_checklist_template(company_id)
    tasks_def = json.loads(tmpl.get("tasks", "[]")) if isinstance(tmpl.get("tasks"), str) else tmpl.get("tasks", [])

    snapshot_tasks = []
    blocking_tasks = []
    now_str = datetime.utcnow().isoformat() + "Z"

    for t in tasks_def:
        fn_name = t.get("check_function")
        is_req = t.get("is_required", True)
        label = t.get("label", "")
        task_id = t.get("task_id", "")

        if fn_name in AUTO_CHECK_MAP:
            status, details = AUTO_CHECK_MAP[fn_name](company_id, p_dict)
        else:
            status, details = ("SKIPPED", "No auto-check function defined")

        if is_req and status == "FAIL":
            blocking_tasks.append(task_id)

        snapshot_tasks.append({
            "task_id": task_id,
            "label": label,
            "status": status,
            "details": details,
            "verified_at": now_str,
            "verified_by": user_id,
            "is_required": is_req,
        })

    ready_to_close = len(blocking_tasks) == 0

    if persist_snapshot:
        period._data["checklist_snapshot"] = json.dumps(snapshot_tasks)
        period._data["updated_at"] = now_str
        db.update_doc(period)

        log_close_audit(
            company_id=company_id,
            period_id=period.name,
            action="CHECKLIST_RUN",
            user_id=user_id,
            details={"ready_to_close": ready_to_close, "blocking_count": len(blocking_tasks)}
        )

    return {
        "period": p_dict,
        "tasks": snapshot_tasks,
        "ready_to_close": ready_to_close,
        "blocking_tasks": blocking_tasks,
    }


def is_period_ready_to_close(company_id: str, period_id: str) -> bool:
    res = run_checklist(company_id, period_id, user_id="system", persist_snapshot=False)
    return res["ready_to_close"]


def close_period(company_id: str, period_id: str, closed_by: str) -> Dict[str, Any]:
    period = db.get_doc("FiscalPeriod", period_id)
    if not period:
        docs = db.get_all_docs("FiscalPeriod", {"name": period_id})
        if docs:
            period = docs[0]
    if not period:
        raise ValueError(f"Fiscal period '{period_id}' not found.")

    # Check readiness
    chk = run_checklist(company_id, period.name, user_id=closed_by, persist_snapshot=True)
    if not chk["ready_to_close"]:
        blockers = ", ".join(chk["blocking_tasks"])
        raise PeriodClosedError(
            period.get("label"),
            f"Cannot close fiscal period '{period.get('label')}': required checklist tasks failed ({blockers})."
        )

    now_str = datetime.utcnow().isoformat() + "Z"
    period._data["status"] = "CLOSED"
    period._data["closed_by"] = closed_by
    period._data["closed_at"] = now_str
    period._data["updated_at"] = now_str
    db.update_doc(period)

    log_close_audit(
        company_id=company_id,
        period_id=period.name,
        action="CLOSE",
        user_id=closed_by,
        details={"label": period.get("label")}
    )

    return period.to_dict()


def reopen_period(
    company_id: str,
    period_id: str,
    reopened_by: str,
    reason: str,
    user_role: str
) -> Dict[str, Any]:
    if user_role not in ["MANAGER", "ADMIN"]:
        raise PermissionError(f"User role '{user_role}' is not authorized to reopen closed periods. Must be MANAGER or ADMIN.")

    if not reason or not reason.strip():
        raise ValueError("A non-empty reopen reason is strictly required to reopen a closed period.")

    period = db.get_doc("FiscalPeriod", period_id)
    if not period:
        docs = db.get_all_docs("FiscalPeriod", {"name": period_id})
        if docs:
            period = docs[0]
    if not period:
        raise ValueError(f"Fiscal period '{period_id}' not found.")

    now_str = datetime.utcnow().isoformat() + "Z"
    period._data["status"] = "OPEN"
    period._data["reopened_by"] = reopened_by
    period._data["reopened_at"] = now_str
    period._data["reopen_reason"] = reason.strip()
    period._data["updated_at"] = now_str
    db.update_doc(period)

    log_close_audit(
        company_id=company_id,
        period_id=period.name,
        action="REOPEN",
        user_id=reopened_by,
        details={"reason": reason.strip(), "role": user_role}
    )

    return period.to_dict()
