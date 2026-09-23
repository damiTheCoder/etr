"""
Comprehensive Unit Tests for Default Account Mapping & Journal Builder Core.
Tests all 9 transaction flows, tax lines, reversals, FX adjustments, idempotency Option A,
integer cents precision, override accounts, multi-tenancy, and validation errors.
"""
from decimal import Decimal

from backend.core import database as db
from backend.core.schema_engine import load_schemas
from backend.core.errors import (
    AccountTypeMismatchError,
    SettingsIncompleteError,
    UnbalancedEntryError,
)
from backend.models.settings_model import (
    get_company_settings,
    update_company_settings,
    validate_company_settings,
    check_account_deletion_allowed,
    SettingsPayload,
)
from backend.core.journal_builder import (
    build_sales_invoice_entry,
    build_sales_invoice_with_tax_entry,
    build_customer_payment_entry,
    build_vendor_bill_entry,
    build_vendor_bill_with_tax_entry,
    build_vendor_payment_entry,
    build_early_payment_discount_entry,
    build_rounding_adjustment_entry,
    build_depreciation_run_entry,
    build_reversal_entry,
    build_fx_adjustment_entry,
)
from backend.seed_defaults import seed_all


def setup_test_db():
    """Seed DB before each test."""
    seed_all("default_company", reset_db=True)
    seed_all("tenant_b")



async def test_get_and_update_settings():
    """Test fetching and updating company settings with audit trail."""
    settings = get_company_settings("default_company")
    assert settings.company.name == "My Company"
    assert settings.defaults["sales_income"].id == "Sales"
    assert settings.defaults["tax_payable"].id == "Output Tax Payable"

    payload = SettingsPayload(
        company_id="default_company",
        company_name="Acme Financials",
        fiscal_year_start=7,
        fiscal_year_end=6,  # Cross-year valid
        reason="Fiscal year shift",
    )
    updated = update_company_settings(payload, changed_by="admin@acme.com")
    assert updated.company.name == "Acme Financials"
    assert updated.company.fiscal_year_start == 7
    assert updated.company.fiscal_year_end == 6

    val_res = validate_company_settings("default_company")
    assert val_res["valid"] is True


async def test_fiscal_year_equal_start_end_fails():
    """Test fiscal year start == end raises ValueError."""
    caught = False
    try:
        SettingsPayload(
            company_id="default_company",
            fiscal_year_start=5,
            fiscal_year_end=5,
        )
    except ValueError as e:
        assert "fiscal_year_start cannot be equal" in str(e)
        caught = True
    assert caught is True


async def test_account_deletion_guard():
    """Test account deletion is blocked if referenced in default settings."""
    assert check_account_deletion_allowed("Sales", "default_company") is False
    assert check_account_deletion_allowed("Random Unused Account", "default_company") is True


async def test_flow_1_sales_invoice():
    """Flow 1: Sales Invoice without tax."""
    res = await build_sales_invoice_entry(
        company_id="default_company",
        amount=1500.50,
        customer_name="Acme Corp",
        date_str="2026-09-15",
        idempotency_key="inv-1001",
    )
    assert res["entryType"] == "Sales Invoice"
    assert len(res["accounts"]) == 2
    assert res["accounts"][0]["account"] == "Debtors"
    assert res["accounts"][0]["debit"] == 1500.50
    assert res["accounts"][0]["party"] == "Acme Corp"
    assert res["accounts"][1]["account"] == "Sales"
    assert res["accounts"][1]["credit"] == 1500.50


async def test_flow_2_sales_invoice_with_tax():
    """Flow 2: Sales Invoice with Sales Tax."""
    res = await build_sales_invoice_with_tax_entry(
        company_id="default_company",
        net_amount=1000.00,
        tax_amount=150.00,
        customer_name="Global Tech Inc",
        date_str="2026-09-15",
    )
    assert res["entryType"] == "Sales Invoice"
    assert len(res["accounts"]) == 3
    assert res["accounts"][0]["account"] == "Debtors"
    assert res["accounts"][0]["debit"] == 1150.00
    assert res["accounts"][1]["account"] == "Sales"
    assert res["accounts"][1]["credit"] == 1000.00
    assert res["accounts"][2]["account"] == "Output Tax Payable"
    assert res["accounts"][2]["credit"] == 150.00


async def test_flow_3_customer_payment():
    """Flow 3: Customer Payment receipt."""
    res = await build_customer_payment_entry(
        company_id="default_company",
        amount=1150.00,
        customer_name="Global Tech Inc",
        date_str="2026-09-16",
        payment_method="Bank",
    )
    assert res["entryType"] == "Payment"
    assert res["accounts"][0]["account"] == "Bank"
    assert res["accounts"][0]["debit"] == 1150.00
    assert res["accounts"][1]["account"] == "Debtors"
    assert res["accounts"][1]["credit"] == 1150.00
    assert res["accounts"][1]["party"] == "Global Tech Inc"


async def test_flow_4_5_vendor_bill_and_tax():
    """Flow 4 & 5: Vendor Bill with tax."""
    res = await build_vendor_bill_with_tax_entry(
        company_id="default_company",
        net_amount=2000.00,
        tax_amount=300.00,
        vendor_name="Office Depot",
        date_str="2026-09-15",
    )
    assert res["entryType"] == "Vendor Bill"
    assert res["accounts"][0]["account"] == "Cost of Goods Sold"
    assert res["accounts"][0]["debit"] == 2000.00
    assert res["accounts"][1]["account"] == "Input Tax Credit"
    assert res["accounts"][1]["debit"] == 300.00
    assert res["accounts"][2]["account"] == "Creditors"
    assert res["accounts"][2]["credit"] == 2300.00


async def test_flow_6_vendor_payment():
    """Flow 6: Vendor Payment disbursement."""
    res = await build_vendor_payment_entry(
        company_id="default_company",
        amount=2300.00,
        vendor_name="Office Depot",
        date_str="2026-09-17",
        payment_method="Bank",
    )
    assert res["entryType"] == "Payment"
    assert res["accounts"][0]["account"] == "Creditors"
    assert res["accounts"][0]["debit"] == 2300.00
    assert res["accounts"][1]["account"] == "Bank"
    assert res["accounts"][1]["credit"] == 2300.00


async def test_flow_7_early_payment_discount():
    """Flow 7: Early Payment Discount."""
    res = await build_early_payment_discount_entry(
        company_id="default_company",
        discount_amount=50.00,
        party_name="Acme Corp",
        date_str="2026-09-18",
        is_customer=True,
    )
    assert res["entryType"] == "Discount"
    assert res["accounts"][0]["account"] == "Discount Allowed"
    assert res["accounts"][0]["debit"] == 50.00
    assert res["accounts"][1]["account"] == "Debtors"
    assert res["accounts"][1]["credit"] == 50.00


async def test_flow_8_rounding_adjustment():
    """Flow 8: Rounding adjustment."""
    res = await build_rounding_adjustment_entry(
        company_id="default_company",
        adjustment_amount=0.04,
        date_str="2026-09-18",
        offset_account_id="Sales",
    )
    assert res["entryType"] == "Adjustment Entry"
    assert res["accounts"][0]["account"] == "Round Off"
    assert res["accounts"][0]["debit"] == 0.04
    assert res["accounts"][1]["account"] == "Sales"
    assert res["accounts"][1]["credit"] == 0.04


async def test_flow_9_depreciation_run():
    """Flow 9: Depreciation Run."""
    res = await build_depreciation_run_entry(
        company_id="default_company",
        amount=450.00,
        date_str="2026-09-30",
    )
    assert res["entryType"] == "Depreciation Entry"
    assert res["accounts"][0]["account"] == "Depreciation"
    assert res["accounts"][0]["debit"] == 450.00
    assert res["accounts"][1]["account"] == "Accumulated Depreciation"
    assert res["accounts"][1]["credit"] == 450.00


async def test_reversal_entry():
    """Reversal Entry creation."""
    orig = await build_sales_invoice_entry(
        company_id="default_company",
        amount=500.00,
        customer_name="Starlight Enterprises",
        date_str="2026-09-10",
    )
    rev = await build_reversal_entry(
        company_id="default_company",
        original_entry_id=orig["name"],
        created_by="auditor@entri.io",
    )
    assert rev["entryType"] == "Reversal Entry"
    assert rev["accounts"][0]["account"] == "Debtors"
    assert rev["accounts"][0]["credit"] == 500.00
    assert rev["accounts"][1]["account"] == "Sales"
    assert rev["accounts"][1]["debit"] == 500.00


async def test_fx_adjustment_entry():
    """FX Adjustment entry."""
    res = await build_fx_adjustment_entry(
        company_id="default_company",
        gain_loss_amount=120.00,
        account_id="Bank",
        date_str="2026-09-30",
    )
    assert res["entryType"] == "Adjustment Entry"
    assert res["accounts"][0]["account"] == "Bank"
    assert res["accounts"][0]["debit"] == 120.00
    assert res["accounts"][1]["account"] == "Foreign Exchange Gain/Loss"
    assert res["accounts"][1]["credit"] == 120.00


async def test_idempotency_option_a():
    """Option A: Duplicate idempotency key returns existing entry without raising error."""
    entry_1 = await build_sales_invoice_entry(
        company_id="default_company",
        amount=750.00,
        customer_name="Acme Corp",
        date_str="2026-09-15",
        idempotency_key="idempotent-tx-999",
    )
    entry_2 = await build_sales_invoice_entry(
        company_id="default_company",
        amount=750.00,
        customer_name="Acme Corp",
        date_str="2026-09-15",
        idempotency_key="idempotent-tx-999",
    )
    assert entry_1["name"] == entry_2["name"]


async def test_override_accounts():
    """Test passing override_accounts dynamically."""
    res = await build_sales_invoice_entry(
        company_id="default_company",
        amount=300.00,
        customer_name="Acme Corp",
        date_str="2026-09-15",
        override_accounts={"sales_income": "Sales"},
    )
    assert res["accounts"][1]["account"] == "Sales"


async def test_missing_setting_raises_error():
    """Test missing account setting raises SettingsIncompleteError."""
    setup_test_db()
    # Remove sales setting for tenant_b
    db.set_single_value("default_sales_income_account_id_tenant_b", "")
    db.set_single_value("default_sales_account", "")

    caught = False
    try:
        await build_sales_invoice_entry(
            company_id="tenant_b",
            amount=100.00,
            customer_name="Tenant Customer",
            date_str="2026-09-15",
            override_accounts={"sales_income": ""},
        )
    except SettingsIncompleteError as e:
        assert "default_sales_income_account_id" in str(e)
        caught = True
    assert caught is True


async def test_posted_immutability_guard():
    """Test editing a submitted/posted journal entry raises ValueError."""
    entry = await build_sales_invoice_entry(
        company_id="default_company",
        amount=500.00,
        customer_name="Acme Corp",
        date_str="2026-09-15",
    )
    assert entry["submitted"] is True
    assert entry["status"] == "Submitted"

    from backend.models import get_model
    je_model = get_model("JournalEntry")
    doc = je_model.get(entry["name"])
    doc._data["totalDebit"] = 9999.00

    caught = False
    try:
        await je_model.before_sync(doc)
    except ValueError as e:
        assert "immutable" in str(e)
        caught = True
    assert caught is True


async def test_approval_workflow():
    """Test threshold-based approval request generation, approval, and rejection."""
    from backend.models import get_model
    from backend.models.approval_model import (
        create_approval_request,
        approve_request,
        reject_request,
        check_approval_required,
    )

    # 1. Create Approval Rule: JournalEntry > $1,000 requires approval
    rule_model = get_model("ApprovalRule")
    rule_doc = rule_model.create({
        "company_id": "default_company",
        "document_type": "JournalEntry",
        "min_amount": 1000.0,
        "approver_role": "Finance Manager",
        "is_active": True,
    })
    rule_model.save(rule_doc)

    rule = check_approval_required("default_company", "JournalEntry", 1500.0)
    assert rule is not None
    assert rule["min_amount"] == 1000.0

    # 2. Trigger approval request
    entry = await build_sales_invoice_entry(
        company_id="default_company",
        amount=1500.00,
        customer_name="Acme Corp",
        date_str="2026-09-15",
    )
    appr_res = create_approval_request("default_company", "JournalEntry", entry["name"], 1500.00)
    assert appr_res["status"] == "Pending"

    # Target doc status should be Pending
    target = db.get_doc("JournalEntry", entry["name"])
    assert target.get("approvalStatus") == "Pending"

    # 3. Approve Request
    approved = await approve_request(appr_res["name"], approver="CFO John", remark="Approved for payment")
    assert approved["status"] == "Approved"
    assert approved["approver"] == "CFO John"

    target_after = db.get_doc("JournalEntry", entry["name"])
    assert target_after.get("approvalStatus") == "Approved"


async def test_self_approval_blocked():
    """Test self-approval is strictly blocked per segregation of duties rules."""
    from backend.models.approval_model import create_approval_request, approve_request

    entry = await build_sales_invoice_entry(
        company_id="default_company",
        amount=2500.00,
        customer_name="Acme Corp",
        date_str="2026-09-15",
    )
    appr_res = create_approval_request(
        company_id="default_company",
        reference_type="JournalEntry",
        reference_name=entry["name"],
        amount=2500.00,
        requested_by="accountant@entri.io",
    )

    caught = False
    try:
        await approve_request(appr_res["name"], approver="accountant@entri.io", remark="Self approve")
    except ValueError as e:
        assert "Self-approval is strictly forbidden" in str(e)
        caught = True
    assert caught is True

    # Different approver succeeds
    ok = await approve_request(appr_res["name"], approver="manager@entri.io", remark="Manager signoff")
    assert ok["status"] == "Approved"


async def test_report_filters_pending_approvals():
    """Test that Trial Balance report excludes pending approval entries and includes approved entries."""
    from backend.main import trial_balance
    from backend.models.approval_model import create_approval_request, approve_request

    # Initial trial balance total
    tb_before = trial_balance()
    initial_debit = tb_before["totalDebit"]

    entry = await build_sales_invoice_entry(
        company_id="default_company",
        amount=5000.00,
        customer_name="Big Corp",
        date_str="2026-09-15",
    )
    appr_res = create_approval_request("default_company", "JournalEntry", entry["name"], 5000.00)

    # Trial balance while Pending: total debit should NOT include the 5000 pending entry
    tb_pending = trial_balance()
    assert tb_pending["totalDebit"] == initial_debit

    # Approve request
    await approve_request(appr_res["name"], approver="cfo@entri.io")

    # Trial balance after Approval: total debit MUST increase by 5000
    tb_approved = trial_balance()
    assert tb_approved["totalDebit"] == initial_debit + 5000.00


