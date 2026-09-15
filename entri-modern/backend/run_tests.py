"""
Test runner script for test_journal_builder.py.
Executes all test functions and reports pass/fail status.
"""
import inspect
import sys
import os
import asyncio
import traceback


# Ensure project root is in python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.tests.test_journal_builder import (
    setup_test_db,
    test_get_and_update_settings,
    test_fiscal_year_equal_start_end_fails,
    test_account_deletion_guard,
    test_flow_1_sales_invoice,
    test_flow_2_sales_invoice_with_tax,
    test_flow_3_customer_payment,
    test_flow_4_5_vendor_bill_and_tax,
    test_flow_6_vendor_payment,
    test_flow_7_early_payment_discount,
    test_flow_8_rounding_adjustment,
    test_flow_9_depreciation_run,
    test_reversal_entry,
    test_fx_adjustment_entry,
    test_idempotency_option_a,
    test_override_accounts,
    test_missing_setting_raises_error,
    test_posted_immutability_guard,
    test_approval_workflow,
    test_self_approval_blocked,
    test_report_filters_pending_approvals,
)

from backend.tests.test_bank_reconciliation import (
    test_bank_reconciliation_flow,
    test_auto_match_requires_secondary_factor,
    test_reconciliation_lock_blocks_reversal,
)

from backend.tests.test_close_management import (
    test_close_blocked_when_checklist_fails,
    test_close_succeeds_when_all_checks_pass,
    test_posting_to_closed_period_raises_error,
    test_reopen_requires_manager_role,
    test_reopen_requires_reason,
    test_reopened_period_allows_posting_again,
    test_checklist_detects_draft_entries,
    test_checklist_detects_unreconciled_bank_items,
    test_trial_balance_balanced_check,
    test_depreciation_check_skipped_when_no_assets,
    test_close_audit_log_is_append_only,
)

async def run_all():
    tests = [
        ("test_get_and_update_settings", test_get_and_update_settings),
        ("test_fiscal_year_equal_start_end_fails", test_fiscal_year_equal_start_end_fails),
        ("test_account_deletion_guard", test_account_deletion_guard),
        ("test_flow_1_sales_invoice", test_flow_1_sales_invoice),
        ("test_flow_2_sales_invoice_with_tax", test_flow_2_sales_invoice_with_tax),
        ("test_flow_3_customer_payment", test_flow_3_customer_payment),
        ("test_flow_4_5_vendor_bill_and_tax", test_flow_4_5_vendor_bill_and_tax),
        ("test_flow_6_vendor_payment", test_flow_6_vendor_payment),
        ("test_flow_7_early_payment_discount", test_flow_7_early_payment_discount),
        ("test_flow_8_rounding_adjustment", test_flow_8_rounding_adjustment),
        ("test_flow_9_depreciation_run", test_flow_9_depreciation_run),
        ("test_reversal_entry", test_reversal_entry),
        ("test_fx_adjustment_entry", test_fx_adjustment_entry),
        ("test_idempotency_option_a", test_idempotency_option_a),
        ("test_override_accounts", test_override_accounts),
        ("test_missing_setting_raises_error", test_missing_setting_raises_error),
        ("test_posted_immutability_guard", test_posted_immutability_guard),
        ("test_approval_workflow", test_approval_workflow),
        ("test_self_approval_blocked", test_self_approval_blocked),
        ("test_report_filters_pending_approvals", test_report_filters_pending_approvals),
        ("test_bank_reconciliation_flow", test_bank_reconciliation_flow),
        ("test_auto_match_requires_secondary_factor", test_auto_match_requires_secondary_factor),
        ("test_reconciliation_lock_blocks_reversal", test_reconciliation_lock_blocks_reversal),
        ("test_close_blocked_when_checklist_fails", test_close_blocked_when_checklist_fails),
        ("test_close_succeeds_when_all_checks_pass", test_close_succeeds_when_all_checks_pass),
        ("test_posting_to_closed_period_raises_error", test_posting_to_closed_period_raises_error),
        ("test_reopen_requires_manager_role", test_reopen_requires_manager_role),
        ("test_reopen_requires_reason", test_reopen_requires_reason),
        ("test_reopened_period_allows_posting_again", test_reopened_period_allows_posting_again),
        ("test_checklist_detects_draft_entries", test_checklist_detects_draft_entries),
        ("test_checklist_detects_unreconciled_bank_items", test_checklist_detects_unreconciled_bank_items),
        ("test_trial_balance_balanced_check", test_trial_balance_balanced_check),
        ("test_depreciation_check_skipped_when_no_assets", test_depreciation_check_skipped_when_no_assets),
        ("test_close_audit_log_is_append_only", test_close_audit_log_is_append_only),
    ]






    passed = 0
    failed = 0

    print("==================================================")
    print(" Running Entri Accounting Engine Test Suite")
    print("==================================================")

    for name, test_fn in tests:
        # Reset DB state before each test
        setup_test_db()
        try:
            if inspect.iscoroutinefunction(test_fn):
                await test_fn()

            else:
                test_fn()
            print(f"  ✅ PASS: {name}")
            passed += 1
        except Exception as e:
            print(f"  ❌ FAIL: {name}")
            traceback.print_exc()
            failed += 1

    print("--------------------------------------------------")
    print(f"Results: {passed} passed, {failed} failed.")
    print("==================================================")

    if failed > 0:
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(run_all())
