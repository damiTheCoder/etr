"""
Unit tests for Bank Reconciliation Module.
Tests statement import, multi-factor auto-matching, manual overrides, and reconciliation submission.
"""
from backend.core import database as db
from backend.core.journal_builder import build_customer_payment_entry
from backend.core.bank_reconciliation import (
    import_bank_statement,
    auto_match_bank_statement,
    reconcile_bank_statement,
    get_unmatched_ledger_entries,
)
from backend.seed_defaults import seed_all


def setup_test_db():
    seed_all("default_company", reset_db=True)



async def test_bank_reconciliation_flow():
    """Full lifecycle: Payment entry -> Bank statement import -> Auto-match -> Reconcile."""
    setup_test_db()

    # 1. Create Customer Payment to Bank
    pay_entry = await build_customer_payment_entry(
        company_id="default_company",
        amount=1500.00,
        customer_name="Acme Corp",
        date_str="2026-09-15",
        payment_method="Bank",
        reference_name="INV-1001",
    )

    # Verify un-reconciled ledger entry exists
    unmatched_before = get_unmatched_ledger_entries("Bank", "default_company")
    assert len(unmatched_before) >= 1

    # 2. Import Bank Statement with matching transaction line
    stmt_lines = [
        {
            "date": "2026-09-15",
            "description": "Deposit Acme Corp INV-1001",
            "reference_number": "INV-1001",
            "deposit": 1500.00,
            "withdrawal": 0.0,
        },
        {
            "date": "2026-09-16",
            "description": "Bank Monthly Service Fee",
            "reference_number": "FEE-001",
            "deposit": 0.0,
            "withdrawal": 15.00,
        },
    ]

    imported = import_bank_statement(
        company_id="default_company",
        account_name="Bank",
        statement_date="2026-09-30",
        opening_balance=1000.00,
        closing_balance=2485.00,
        lines=stmt_lines,
        user_remark="September Bank Statement",
    )

    stmt_name = imported["name"]
    assert len(imported["entries"]) == 2

    # 3. Trigger Auto-Match
    match_res = auto_match_bank_statement(stmt_name)
    assert match_res["auto_matched_count"] == 1
    assert match_res["unmatched_count"] == 1

    # Check matched line details
    matched_line = match_res["lines"][0]
    assert matched_line["match_status"] == "Auto-Matched"
    assert matched_line["match_score"] >= 0.70

    # 4. Finalize Reconciliation
    recon_final = await reconcile_bank_statement(stmt_name)
    assert recon_final["status"] == "Completed"
    assert recon_final["reconciled_count"] == 1


async def test_auto_match_requires_secondary_factor():
    """Test auto-matching requires secondary factor (reference or date proximity) and refuses amount alone."""
    setup_test_db()

    # Create payment entry dated 2026-09-01
    await build_customer_payment_entry(
        company_id="default_company",
        amount=999.00,
        customer_name="Unknown Client",
        date_str="2026-09-01",
        payment_method="Bank",
    )

    # Import statement line on 2026-09-20 (19 days later, no reference match)
    stmt_lines = [
        {
            "date": "2026-09-20",
            "description": "Random Unrelated Wire",
            "reference_number": "WIRE-9999",
            "deposit": 999.00,
            "withdrawal": 0.0,
        }
    ]

    imported = import_bank_statement(
        company_id="default_company",
        account_name="Bank",
        statement_date="2026-09-30",
        opening_balance=0.0,
        closing_balance=999.00,
        lines=stmt_lines,
    )

    # Auto-match should NOT match on amount alone when date is > 3 days and no reference match
    match_res = auto_match_bank_statement(imported["name"])
    assert match_res["auto_matched_count"] == 0
    assert match_res["lines"][0]["match_status"] == "Unmatched"


async def test_reconciliation_lock_blocks_reversal():
    """Test that reconciled entries cannot be reversed until un-reconciled."""
    setup_test_db()

    from backend.core.journal_builder import build_reversal_entry
    from backend.core.bank_reconciliation import unreconcile_bank_statement

    entry = await build_customer_payment_entry(
        company_id="default_company",
        amount=3000.00,
        customer_name="Acme Corp",
        date_str="2026-09-15",
        payment_method="Bank",
    )

    imported = import_bank_statement(
        company_id="default_company",
        account_name="Bank",
        statement_date="2026-09-15",
        opening_balance=0.0,
        closing_balance=3000.00,
        lines=[{
            "date": "2026-09-15",
            "description": "Acme Corp Wire",
            "reference_number": "WIRE-3000",
            "deposit": 3000.00,
            "withdrawal": 0.0,
        }],
    )

    auto_match_bank_statement(imported["name"])
    await reconcile_bank_statement(imported["name"])

    # Attempting reversal on reconciled entry must fail
    caught = False
    try:
        await build_reversal_entry("default_company", entry["name"])
    except ValueError as e:
        assert "contains reconciled bank ledger entries" in str(e)
        caught = True
    assert caught is True

    # Un-reconcile statement unlocks the entry
    await unreconcile_bank_statement(imported["name"])

    # Reversal now succeeds
    rev = await build_reversal_entry("default_company", entry["name"])
    assert rev["entryType"] == "Reversal Entry"

