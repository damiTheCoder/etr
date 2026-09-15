"""
Seed Defaults script for entri accounting core.
Populates Chart of Accounts and Default Account Mapping settings for default_company.
"""
import os
import sys

from backend.core import database as db
from backend.core.schema_engine import Doc, load_schemas
from backend.coa import build_coa_hierarchy


def seed_all(company_id: str = "default_company", reset_db: bool = False):
    """Seeds complete COA and default account mapping settings."""
    schemas_dir = os.environ.get(
        "BOOKS_SCHEMAS_DIR",
        os.path.join(os.path.dirname(os.path.dirname(__file__)), "schemas")
    )
    load_schemas(schemas_dir)
    db.init_database()
    if reset_db:
        db.reset_database()


    # 1. Ensure COA exists
    coa = build_coa_hierarchy()
    for acct in coa:
        existing = db.get_doc("Account", acct["name"])
        if not existing:
            doc = Doc("Account", {
                "name": acct["name"],
                "accountNumber": acct["accountNumber"],
                "rootType": acct["rootType"],
                "accountType": acct["accountType"],
                "parentAccount": acct["parentAccount"],
                "isGroup": acct["isGroup"],
                "balance": 0,
                "lft": 0,
                "rgt": 0,
            })
            doc._not_inserted = True
            db.insert_doc(doc)

    # Add any extra accounts needed by accounting flows if missing
    extra_accounts = [
        {"name": "Output Tax Payable", "accountNumber": "2110", "rootType": "Liability", "accountType": "Tax", "parentAccount": "Current Liabilities", "isGroup": False},
        {"name": "Input Tax Credit", "accountNumber": "1140", "rootType": "Asset", "accountType": "Tax", "parentAccount": "Current Assets", "isGroup": False},
        {"name": "Accumulated Depreciation", "accountNumber": "1210", "rootType": "Asset", "accountType": "Accumulated Depreciation", "parentAccount": "Fixed Assets", "isGroup": False},
        {"name": "Foreign Exchange Gain/Loss", "accountNumber": "5150", "rootType": "Expense", "accountType": "Expense", "parentAccount": "Expenses", "isGroup": False},
    ]

    for acct in extra_accounts:
        existing = db.get_doc("Account", acct["name"])
        if not existing:
            doc = Doc("Account", {
                "name": acct["name"],
                "accountNumber": acct["accountNumber"],
                "rootType": acct["rootType"],
                "accountType": acct["accountType"],
                "parentAccount": acct["parentAccount"],
                "isGroup": acct["isGroup"],
                "balance": 0,
                "lft": 0,
                "rgt": 0,
            })
            doc._not_inserted = True
            db.insert_doc(doc)

    # 2. Seed Default Settings
    db.settings.create_index("company_id", unique=True)
    existing_settings = db.settings.find_one({"company_id": company_id})

    if not existing_settings:
        from datetime import datetime
        now_str = datetime.utcnow().isoformat()
        db.settings.insert_one({
            "company_id": company_id,
            "company_name": "My Company",
            "base_currency": "NGN",
            "fiscal_year_start": 1,
            "fiscal_year_end": 12,
            "default_sales_income_account_id": "Sales",
            "default_purchase_expense_account_id": "Cost of Goods Sold",
            "default_receivable_account_id": "Debtors",
            "default_payable_account_id": "Creditors",
            "default_cash_account_id": "Cash",
            "default_bank_account_id": "Bank",
            "default_tax_payable_account_id": "Output Tax Payable",
            "default_tax_receivable_account_id": "Input Tax Credit",
            "round_off_account_id": "Round Off",
            "discount_allowed_account_id": "Discount Allowed",
            "stock_inventory_account_id": "Stock in Hand",
            "depreciation_account_id": "Depreciation",
            "accumulated_depreciation_account_id": "Accumulated Depreciation",
            "fx_gain_loss_account_id": "Foreign Exchange Gain/Loss",
            "version": 1,
            "created_at": now_str,
            "updated_at": now_str,
        })

    db.set_single_value(f"company_name_{company_id}", "My Company")
    db.set_single_value(f"currency_{company_id}", "NGN")
    db.set_single_value(f"fiscal_year_start_{company_id}", "1")
    db.set_single_value(f"fiscal_year_end_{company_id}", "12")

    defaults = {
        "default_sales_income_account_id": "Sales",
        "default_purchase_expense_account_id": "Cost of Goods Sold",
        "default_receivable_account_id": "Debtors",
        "default_payable_account_id": "Creditors",
        "default_cash_account_id": "Cash",
        "default_bank_account_id": "Bank",
        "default_tax_payable_account_id": "Output Tax Payable",
        "default_tax_receivable_account_id": "Input Tax Credit",
        "round_off_account_id": "Round Off",
        "discount_allowed_account_id": "Discount Allowed",
        "stock_inventory_account_id": "Stock in Hand",
        "depreciation_account_id": "Depreciation",
        "accumulated_depreciation_account_id": "Accumulated Depreciation",
        "fx_gain_loss_account_id": "Foreign Exchange Gain/Loss",
    }

    for key, acct_name in defaults.items():
        db.set_single_value(f"{key}_{company_id}", acct_name)

    print(f"✅ Successfully seeded defaults for '{company_id}'.")


if __name__ == "__main__":
    seed_all()
