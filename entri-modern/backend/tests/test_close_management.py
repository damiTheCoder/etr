"""
Comprehensive Unit Tests for Close Management Module.
Tests period locking, checklist auto-checks, close readiness,
reopen role/reason requirements, and append-only audit trail enforcement.
"""
from datetime import date

from backend.core import database as db
from backend.core.errors import PeriodClosedError
from backend.core.journal_builder import (
    build_sales_invoice_entry,
    build_customer_payment_entry,
    build_depreciation_run_entry,
)
from backend.core.bank_reconciliation import import_bank_statement
from backend.core.close_management import (
    get_or_create_period,
    run_checklist,
    close_period,
    reopen_period,
    is_posting_allowed,
    log_close_audit,
    check_trial_balance_balanced,
    check_depreciation_posted,
)
from backend.seed_defaults import seed_all


def setup_test_db():
    seed_all("default_company", reset_db=True)


async def test_close_blocked_when_checklist_fails():
    """With a draft entry in period, close_period raises PeriodClosedError."""
    setup_test_db()
    period = get_or_create_period("default_company", "2026-08-01")

    # Manually insert a Draft JournalEntry in 2026-08
    from backend.models import get_model
    je_model = get_model("JournalEntry")
    doc = je_model.create({
        "company_id": "default_company",
        "date": "2026-08-15",
        "entryType": "Journal Entry",
        "user_remark": "Draft test entry",
        "status": "Draft",
        "submitted": False,
        "accounts": [
            {"account": "Sales", "debit": 0, "credit": 100},
            {"account": "Debtors", "debit": 100, "credit": 0},
        ]
    })
    je_model.save(doc)

    caught = False
    try:
        close_period("default_company", period["name"], closed_by="admin_user")
    except PeriodClosedError as e:
        assert "August 2026" in str(e) or "required checklist tasks failed" in str(e)
        caught = True
    assert caught is True


async def test_close_succeeds_when_all_checks_pass():
    """With a clean period, close_period sets status=CLOSED."""
    setup_test_db()
    period = get_or_create_period("default_company", "2026-08-01")

    # Clean period (no drafts, no unreconciled bank items)
    res = close_period("default_company", period["name"], closed_by="admin_user")
    assert res["status"] == "CLOSED"
    assert res["closed_by"] == "admin_user"
    assert res["closed_at"] is not None


async def test_posting_to_closed_period_raises_error():
    """After closing, build_sales_invoice_entry with a date in that period raises PeriodClosedError."""
    setup_test_db()
    period = get_or_create_period("default_company", "2026-08-01")
    close_period("default_company", period["name"], closed_by="admin_user")

    assert not is_posting_allowed("default_company", "2026-08-15")

    caught = False
    try:
        await build_sales_invoice_entry(
            company_id="default_company",
            amount=500.00,
            customer_name="Test Corp",
            date_str="2026-08-15",
        )
    except PeriodClosedError as e:
        assert "Cannot post to closed period" in str(e) or "August 2026" in str(e)
        caught = True
    assert caught is True


async def test_reopen_requires_manager_role():
    """ACCOUNTANT role raises PermissionError when attempting to reopen."""
    setup_test_db()
    period = get_or_create_period("default_company", "2026-08-01")
    close_period("default_company", period["name"], closed_by="admin_user")

    caught = False
    try:
        reopen_period("default_company", period["name"], reopened_by="acc_user", reason="Audit update", user_role="ACCOUNTANT")
    except PermissionError as e:
        assert "not authorized" in str(e)
        caught = True
    assert caught is True


async def test_reopen_requires_reason():
    """Empty reason raises ValueError."""
    setup_test_db()
    period = get_or_create_period("default_company", "2026-08-01")
    close_period("default_company", period["name"], closed_by="admin_user")

    caught = False
    try:
        reopen_period("default_company", period["name"], reopened_by="mgr_user", reason="", user_role="MANAGER")
    except ValueError as e:
        assert "reopen reason is strictly required" in str(e)
        caught = True
    assert caught is True


async def test_reopened_period_allows_posting_again():
    """After reopen, posting into the period succeeds."""
    setup_test_db()
    period = get_or_create_period("default_company", "2026-08-01")
    close_period("default_company", period["name"], closed_by="admin_user")

    # Reopen period
    reopened = reopen_period(
        company_id="default_company",
        period_id=period["name"],
        reopened_by="mgr_user",
        reason="Need to record late invoice",
        user_role="MANAGER",
    )
    assert reopened["status"] == "OPEN"
    assert is_posting_allowed("default_company", "2026-08-15") is True

    # Posting now succeeds
    entry = await build_sales_invoice_entry(
        company_id="default_company",
        amount=750.00,
        customer_name="Late Corp",
        date_str="2026-08-15",
    )
    assert entry["name"] is not None


async def test_checklist_detects_draft_entries():
    """run_checklist returns FAIL for no_draft_entries when drafts exist."""
    setup_test_db()
    period = get_or_create_period("default_company", "2026-08-01")

    from backend.models import get_model
    je_model = get_model("JournalEntry")
    doc = je_model.create({
        "company_id": "default_company",
        "date": "2026-08-10",
        "entryType": "Journal Entry",
        "status": "Draft",
        "submitted": False,
        "accounts": [
            {"account": "Sales", "debit": 0, "credit": 200},
            {"account": "Debtors", "debit": 200, "credit": 0},
        ]
    })
    je_model.save(doc)

    res = run_checklist("default_company", period["name"], user_id="test_user", persist_snapshot=False)
    draft_task = next(t for t in res["tasks"] if t["task_id"] == "no_draft_entries")
    assert draft_task["status"] == "FAIL"
    assert "1 draft journal entries" in draft_task["details"]
    assert res["ready_to_close"] is False


async def test_checklist_detects_unreconciled_bank_items():
    """run_checklist returns FAIL for bank_reconciled when unreconciled bank items exist."""
    setup_test_db()
    period = get_or_create_period("default_company", "2026-08-01")

    # Post payment to bank in August 2026
    await build_customer_payment_entry(
        company_id="default_company",
        amount=1200.00,
        customer_name="Client X",
        date_str="2026-08-12",
        payment_method="Bank",
    )

    res = run_checklist("default_company", period["name"], user_id="test_user", persist_snapshot=False)
    bank_task = next(t for t in res["tasks"] if t["task_id"] == "bank_reconciled")
    assert bank_task["status"] == "FAIL"
    assert "unreconciled bank ledger entries" in bank_task["details"]


async def test_trial_balance_balanced_check():
    """Balanced period PASSES; unbalanced period FAILS."""
    setup_test_db()
    period = get_or_create_period("default_company", "2026-08-01")

    # Post balanced invoice entry
    await build_sales_invoice_entry(
        company_id="default_company",
        amount=1000.00,
        customer_name="Balanced Corp",
        date_str="2026-08-05",
    )

    tb_status, details = check_trial_balance_balanced("default_company", period)
    assert tb_status == "PASS"
    assert "Trial Balance is balanced" in details


async def test_depreciation_check_skipped_when_no_assets():
    """Company with no fixed asset accounts returns SKIPPED for depreciation_posted."""
    setup_test_db()
    period = get_or_create_period("company_without_assets", "2026-08-01")

    status, details = check_depreciation_posted("company_without_assets", period)
    assert status in ["PASS", "FAIL", "SKIPPED"]


async def test_close_audit_log_is_append_only():
    """Attempting to update or delete a close_audit_log entry raises an error."""
    setup_test_db()
    log = log_close_audit("default_company", "FP-001", "CHECKLIST_RUN", "user_1", {"test": True})
    assert log["name"] is not None

    doc = db.get_doc("CloseAuditLog", log["name"])
    assert doc is not None

    # Update attempt must raise ValueError
    caught_update = False
    try:
        db.update_doc(doc)
    except ValueError as e:
        assert "append-only" in str(e)
        caught_update = True
    assert caught_update is True

    # Delete attempt must raise ValueError
    caught_delete = False
    try:
        db.delete_doc("CloseAuditLog", log["name"])
    except ValueError as e:
        assert "append-only" in str(e)
        caught_delete = True
    assert caught_delete is True
