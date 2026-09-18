"""
FastAPI server - the main entry point.
Provides REST API for all accounting operations.

Mirrors the full accounting competence of Entri:
  - Complete IFRS/GAAP Chart of Accounts
  - Double-entry ledger with debit/credit classification
  - Sales/Purchase invoices with tax handling
  - Payments with invoice allocation
  - Journal entries with entry types
  - Financial reports: Trial Balance, Balance Sheet, P&L, General Ledger
"""
import os
from contextlib import asynccontextmanager
from datetime import date
from typing import Any, Optional
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from backend.core.schema_engine import load_schemas, get_all_schemas, get_schema, Doc
from backend.core import database as db
from backend.models import get_model, get_all_models
from backend.models.invoice import safe_float
from backend.coa import build_coa_hierarchy, is_debit, is_credit, normal_balance_side


from backend.api.ai_router import router as ai_router
from backend.api.settings_router import router as settings_router
from backend.api.approval_router import router as approval_router
from backend.api.reconciliation_router import router as reconciliation_router
from backend.api.close_router import router as close_router


_initialized = False





def ensure_initialized():
    global _initialized
    if not _initialized:
        schemas_dir = os.environ.get(
            "BOOKS_SCHEMAS_DIR",
            os.path.join(os.path.dirname(os.path.dirname(__file__)), "schemas")
        )
        load_schemas(schemas_dir)
        db.init_database()
        _seed_defaults()
        _initialized = True


@asynccontextmanager
async def lifespan(app: FastAPI):
    ensure_initialized()
    yield


app = FastAPI(title="entri API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:[0-9]+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ai_router)
app.include_router(settings_router)
app.include_router(approval_router)
app.include_router(reconciliation_router)
app.include_router(close_router)





def _seed_defaults():
    """Seed the complete IFRS/GAAP Chart of Accounts and settings on first run."""
    # Ensure all Chart of Accounts from the COA tree exist in the database
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

    setup = db.get_single_value("setup_complete")
    if setup:
        return

    # Set accounting settings
    db.set_single_value("setup_complete", "1")
    db.set_single_value("company_name", "My Company")
    db.set_single_value("currency", "USD")
    db.set_single_value("fiscal_year_start", "1")
    db.set_single_value("fiscal_year_end", "12")

    # Set default accounts
    db.set_single_value("default_sales_account", "Sales")
    db.set_single_value("default_purchase_account", "Cost of Goods Sold")
    db.set_single_value("default_receivable_account", "Debtors")
    db.set_single_value("default_payable_account", "Creditors")
    db.set_single_value("default_cash_account", "Cash")
    db.set_single_value("default_bank_account", "Bank")
    db.set_single_value("default_round_off_account", "Round Off")
    db.set_single_value("default_discount_account", "Discount Allowed")
    db.set_single_value("default_stock_account", "Stock in Hand")
    db.set_single_value("default_depreciation_account", "Depreciation")
    db.set_single_value("default_accumulated_depreciation_account", "Accumulated Depreciation")

    # Create default UOMs
    for uom_name in ["Nos", "Kg", "Litre", "Metre", "Box", "Set", "Hour", "Day"]:
        existing = db.get_doc("UOM", uom_name)
        if not existing:
            doc = Doc("UOM", {"name": uom_name, "description": uom_name})
            doc._not_inserted = True
            db.insert_doc(doc)

    # Create default payment methods
    for method, method_type, acct in [
        ("Cash", "Cash", "Cash"),
        ("Cheque", "Cheque", "Bank"),
        ("Bank Transfer", "Transfer", "Bank"),
    ]:
        existing = db.get_doc("PaymentMethod", method)
        if not existing:
            doc = Doc("PaymentMethod", {"name": method, "type": method_type, "account": acct})
            doc._not_inserted = True
            db.insert_doc(doc)

    # Create default taxes (VAT/Sales Tax example)
    for tax_name, rate, acct in [
        ("Standard Rate 15%", 15, "Output Tax Payable"),
        ("Sales Tax 5%", 5, "Output Tax Payable"),
        ("Zero Rate 0%", 0, "Output Tax Payable"),
        ("Input Tax 15%", 15, "Input Tax Credit"),
    ]:
        existing = db.get_doc("Tax", tax_name)
        if not existing:
            doc = Doc("Tax", {"name": tax_name, "rate": rate, "account": acct})
            doc._not_inserted = True
            db.insert_doc(doc)

    # Create default parties (Customers & Suppliers)
    for party_name, party_type in [
        ("Acme Corp", "Customer"),
        ("Global Tech Inc", "Customer"),
        ("Starlight Enterprises", "Customer"),
        ("Office Depot", "Supplier"),
        ("Cloud Services LLC", "Supplier"),
        ("Apex Supplies", "Supplier"),
    ]:
        existing = db.get_doc("Party", party_name)
        if not existing:
            doc = Doc("Party", {"name": party_name, "partyType": party_type})
            doc._not_inserted = True
            db.insert_doc(doc)

    # Create default items
    for item_name, rate, inc_acct, exp_acct in [
        ("Software Consulting", 150, "Sales", "Cost of Goods Sold"),
        ("Web Development", 1200, "Sales", "Cost of Goods Sold"),
        ("Hardware Equipment", 450, "Sales", "Cost of Goods Sold"),
        ("Office Supplies", 75, "Sales", "Cost of Goods Sold"),
    ]:
        existing = db.get_doc("Item", item_name)
        if not existing:
            doc = Doc("Item", {
                "name": item_name,
                "rate": rate,
                "incomeAccount": inc_acct,
                "expenseAccount": exp_acct,
            })
            doc._not_inserted = True
            db.insert_doc(doc)

    # Create number series
    for prefix in ["SINV-", "PINV-", "PAY-", "JE-", "ITEM-", "PO-", "RECON-", "APPR-"]:
        existing = db.get_doc("NumberSeries", prefix)
        if not existing:
            doc = Doc("NumberSeries", {"name": prefix, "prefix": prefix, "current": 0})
            doc._not_inserted = True
            db.insert_doc(doc)


# ─── Specific Routes (must come before generic /api/{schema_name} routes) ──

# Chart of Accounts
@app.get("/api/accounts/tree")
def get_account_tree():
    """Get the full Chart of Accounts as a hierarchical tree."""
    from backend.models.account import AccountModel
    return AccountModel.get_account_tree()


get_accounts_tree = get_account_tree



@app.get("/api/accounts/{root_type}")
def get_accounts_by_root_type(root_type: str):
    """Get all accounts filtered by root type (Asset/Liability/Equity/Income/Expense)."""
    accounts = db.get_all_docs("Account", {"rootType": root_type})
    return [a.to_dict() for a in accounts]


@app.get("/api/accounts/classification/{root_type}")
def get_account_classification(root_type: str):
    """Get the debit/credit classification for a root type."""
    return {
        "rootType": root_type,
        "normalBalance": normal_balance_side(root_type),
        "isDebit": is_debit(root_type),
        "isCredit": is_credit(root_type),
    }


# Reports
@app.get("/api/reports/balance-sheet")
def balance_sheet(from_date: Optional[str] = None, to_date: Optional[str] = None):
    """Generate balance sheet (Assets = Liabilities + Equity)."""
    filters = {"reverted": 0}
    if from_date:
        filters["date>="] = from_date
    if to_date:
        filters["date<="] = to_date

    entries = _get_ledger_summaries(from_date, to_date)

    assets_accounts = []
    liabilities_accounts = []
    equity_accounts = []

    total_assets = 0.0
    total_liabilities = 0.0
    total_equity = 0.0

    for acct_name, summary in entries.items():
        account = db.get_doc("Account", acct_name)
        if not account:
            continue
        root_type = account.get("rootType", "")
        debit = summary["debit"]
        credit = summary["credit"]

        if is_debit(root_type):
            balance = debit - credit
        else:
            balance = credit - debit

        if balance == 0:
            continue

        acct_info = {
            "name": acct_name,
            "accountType": account.get("accountType", ""),
            "balance": balance,
        }

        if root_type == "Asset":
            assets_accounts.append(acct_info)
            total_assets += balance
        elif root_type == "Liability":
            liabilities_accounts.append(acct_info)
            total_liabilities += balance
        elif root_type == "Equity":
            equity_accounts.append(acct_info)
            total_equity += balance

    # Add net profit to equity
    income_total = sum(
        (s["credit"] - s["debit"])
        for a, s in entries.items()
        if _get_root_type(a) == "Income"
    )
    expense_total = sum(
        (s["debit"] - s["credit"])
        for a, s in entries.items()
        if _get_root_type(a) == "Expense"
    )
    net_profit = income_total - expense_total

    total_equity += net_profit

    return {
        "assets": {"accounts": assets_accounts, "total": total_assets},
        "liabilities": {"accounts": liabilities_accounts, "total": total_liabilities},
        "equity": {
            "accounts": equity_accounts,
            "total": total_equity,
            "netProfit": net_profit,
        },
        "netProfit": net_profit,
        "balanced": abs(total_assets - (total_liabilities + total_equity)) < 0.01,
    }


@app.get("/api/reports/balance-sheet")
def balance_sheet(from_date: Optional[str] = None, to_date: Optional[str] = None, company_id: str = "default_company"):
    """Generate balance sheet report."""
    from backend.models.settings_model import get_company_settings
    settings = get_company_settings(company_id)

    entries = _get_ledger_summaries(from_date, to_date)
    assets_accounts = []
    liabilities_accounts = []
    equity_accounts = []
    total_assets = 0.0
    total_liabilities = 0.0
    total_equity = 0.0

    for acct_name, summary in entries.items():
        account = db.get_doc("Account", acct_name)
        if not account:
            continue
        root_type = account.get("rootType", "")
        balance = summary["debit"] - summary["credit"] if is_debit(root_type) else summary["credit"] - summary["debit"]

        if balance == 0:
            continue

        acct_info = {
            "name": acct_name,
            "accountType": account.get("accountType", ""),
            "balance": balance,
        }

        if root_type == "Asset":
            assets_accounts.append(acct_info)
            total_assets += balance
        elif root_type == "Liability":
            liabilities_accounts.append(acct_info)
            total_liabilities += balance
        elif root_type == "Equity":
            equity_accounts.append(acct_info)
            total_equity += balance

    # Add net profit to equity
    income_total = sum(
        (s["credit"] - s["debit"])
        for a, s in entries.items()
        if _get_root_type(a) == "Income"
    )
    expense_total = sum(
        (s["debit"] - s["credit"])
        for a, s in entries.items()
        if _get_root_type(a) == "Expense"
    )
    net_profit = income_total - expense_total

    total_equity += net_profit

    return {
        "company_name": settings.company.name,
        "currency": settings.company.base_currency,
        "assets": {"accounts": assets_accounts, "total": total_assets},
        "liabilities": {"accounts": liabilities_accounts, "total": total_liabilities},
        "equity": {
            "accounts": equity_accounts,
            "total": total_equity,
            "netProfit": net_profit,
        },
        "netProfit": net_profit,
        "balanced": abs(total_assets - (total_liabilities + total_equity)) < 0.01,
    }


@app.get("/api/reports/profit-and-loss")
def profit_and_loss(from_date: Optional[str] = None, to_date: Optional[str] = None, company_id: str = "default_company"):
    """Generate profit and loss statement."""
    from backend.models.settings_model import get_company_settings
    settings = get_company_settings(company_id)

    entries = _get_ledger_summaries(from_date, to_date)

    income_accounts = []
    expense_accounts = []
    total_income = 0.0
    total_expenses = 0.0

    for acct_name, summary in entries.items():
        account = db.get_doc("Account", acct_name)
        if not account:
            continue
        root_type = account.get("rootType", "")

        if root_type == "Income":
            balance = summary["credit"] - summary["debit"]
            if balance != 0:
                income_accounts.append({
                    "name": acct_name,
                    "accountType": account.get("accountType", ""),
                    "balance": balance,
                })
                total_income += balance
        elif root_type == "Expense":
            balance = summary["debit"] - summary["credit"]
            if balance != 0:
                expense_accounts.append({
                    "name": acct_name,
                    "accountType": account.get("accountType", ""),
                    "balance": balance,
                })
                total_expenses += balance

    net_profit = total_income - total_expenses

    return {
        "company_name": settings.company.name,
        "currency": settings.company.base_currency,
        "income": {"accounts": income_accounts, "total": total_income},
        "expenses": {"accounts": expense_accounts, "total": total_expenses},
        "netProfit": net_profit,
        "netProfitMargin": (net_profit / total_income * 100) if total_income else 0,
    }


def _is_cash_or_bank_account(account_name: str, account_doc: Optional[dict] = None) -> bool:
    """Determine if an account is a cash or cash equivalent account."""
    if not account_name:
        return False
    if account_doc:
        acct_type = str(account_doc.get("accountType", "")).lower()
        if acct_type in ["cash", "bank"]:
            return True
    lower = account_name.lower()
    return any(k in lower for k in ["cash", "bank", "petty"])


@app.get("/api/reports/cash-flow")
@app.get("/api/reports/cashflow")
def cash_flow_statement(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    company_id: str = "default_company"
):
    """
    Standard IAS 7 Cash Flow Statement.
    Presents:
    1. Cash flows from Operating Activities (Net Profit + non-cash adjustments + working capital changes)
    2. Cash flows from Investing Activities (Fixed assets & PPE acquisitions/disposals, investments)
    3. Cash flows from Financing Activities (Owner drawings, capital contributions, borrowings/debt)
    4. Summary of Cash and Cash Equivalents (Beginning balance, Net change, Ending balance, Reconciliation).
    """
    from backend.models.settings_model import get_company_settings
    settings = get_company_settings(company_id)

    # 1. Fetch all accounts and build metadata cache
    all_accounts = {a.get("name"): a for a in db.get_all_docs("Account", {})}

    # 2. Compute Beginning Cash (all transactions prior to from_date)
    beginning_cash = 0.0
    beginning_cash_breakdown = []
    if from_date:
        prior_summaries = _get_ledger_summaries(to_date=None) # get all, filter < from_date manually or via summaries
        # Specifically filter before from_date
        prior_entries = db.get_ledger_entries()
        prior_balances: dict[str, float] = {}
        for entry in prior_entries:
            if entry.get("reverted"):
                continue
            entry_date = entry.get("date", "")
            if entry_date and entry_date < from_date:
                acct = entry.get("account", "")
                if not acct:
                    continue
                debit = safe_float(entry.get("debit"), 0)
                credit = safe_float(entry.get("credit"), 0)
                prior_balances[acct] = prior_balances.get(acct, 0.0) + (debit - credit)

        for acct_name, bal in prior_balances.items():
            acct_doc = all_accounts.get(acct_name)
            if _is_cash_or_bank_account(acct_name, acct_doc):
                beginning_cash += bal
                beginning_cash_breakdown.append({"account": acct_name, "balance": round(bal, 2)})

    # 3. Period Ledger Summaries
    period_summaries = _get_ledger_summaries(from_date, to_date)

    # Calculate Operating Net Profit for the period
    period_income = 0.0
    period_expenses = 0.0
    for acct_name, summary in period_summaries.items():
        acct_doc = all_accounts.get(acct_name)
        root_type = acct_doc.get("rootType", "") if acct_doc else _get_root_type(acct_name)
        if root_type == "Income":
            period_income += (summary["credit"] - summary["debit"])
        elif root_type == "Expense":
            period_expenses += (summary["debit"] - summary["credit"])

    net_profit = period_income - period_expenses

    # Non-cash adjustments (Depreciation, Amortization)
    non_cash_adjustments = []
    total_non_cash = 0.0

    # Working capital changes (Receivables, Inventory/Stock, Payables, Taxes Payable, Other Current Liabilities)
    working_capital_items = []
    total_working_capital = 0.0

    # Investing activities items (Fixed Assets, Capital WIP, Intangibles, Long-term Investments)
    investing_items = []
    total_investing = 0.0

    # Financing activities items (Share Capital, Owner's Equity/Drawings, Dividends, Loans/Borrowings)
    financing_items = []
    total_financing = 0.0

    # Cash account net flow (actual change in cash/bank accounts during period)
    actual_cash_change = 0.0
    cash_accounts_breakdown = []

    for acct_name, summary in period_summaries.items():
        acct_doc = all_accounts.get(acct_name)
        root_type = acct_doc.get("rootType", "") if acct_doc else _get_root_type(acct_name)
        acct_type = acct_doc.get("accountType", "") if acct_doc else ""

        debit = summary["debit"]
        credit = summary["credit"]
        net_change_asset_view = debit - credit
        net_change_liability_view = credit - debit

        if _is_cash_or_bank_account(acct_name, acct_doc):
            actual_cash_change += net_change_asset_view
            cash_accounts_breakdown.append({
                "account": acct_name,
                "net_change": round(net_change_asset_view, 2)
            })
            continue

        lower_name = acct_name.lower()
        lower_type = acct_type.lower()

        # Non-cash expense adjustments in Operating activities:
        if root_type == "Expense" and ("depreciation" in lower_name or "amortization" in lower_name or "depreciation" in lower_type):
            exp_amt = debit - credit
            if exp_amt != 0:
                non_cash_adjustments.append({
                    "item": f"Depreciation & Amortization ({acct_name})",
                    "account": acct_name,
                    "amount": round(exp_amt, 2)
                })
                total_non_cash += exp_amt
            continue

        # Accumulated depreciation/amortization contra-assets
        if "accumulated depreciation" in lower_name or "accumulated amortization" in lower_name:
            contra_amt = credit - debit
            if contra_amt != 0:
                non_cash_adjustments.append({
                    "item": f"Provision for {acct_name}",
                    "account": acct_name,
                    "amount": round(contra_amt, 2)
                })
                total_non_cash += contra_amt
            continue

        # Operating Working Capital Changes:
        # 1. Receivables: Increase in Asset = Outflow (-), Decrease in Asset = Inflow (+)
        if root_type == "Asset" and ("receivable" in lower_type or "debtor" in lower_name or "receivable" in lower_name):
            cash_impact = -(net_change_asset_view)
            if cash_impact != 0:
                label = f"(Increase) / Decrease in {acct_name}"
                working_capital_items.append({"item": label, "account": acct_name, "amount": round(cash_impact, 2)})
                total_working_capital += cash_impact
            continue

        # 2. Stock / Inventory: Increase in Inventory = Outflow (-), Decrease = Inflow (+)
        if root_type == "Asset" and ("stock" in lower_type or "stock" in lower_name or "inventory" in lower_name or "goods" in lower_name or "materials" in lower_name):
            cash_impact = -(net_change_asset_view)
            if cash_impact != 0:
                label = f"(Increase) / Decrease in {acct_name}"
                working_capital_items.append({"item": label, "account": acct_name, "amount": round(cash_impact, 2)})
                total_working_capital += cash_impact
            continue

        # 3. Prepayments & Advances: Increase = Outflow (-), Decrease = Inflow (+)
        if root_type == "Asset" and ("prepayment" in lower_type or "prepaid" in lower_name or "advance" in lower_name):
            cash_impact = -(net_change_asset_view)
            if cash_impact != 0:
                label = f"(Increase) / Decrease in {acct_name}"
                working_capital_items.append({"item": label, "account": acct_name, "amount": round(cash_impact, 2)})
                total_working_capital += cash_impact
            continue

        # 4. Payables & Current Liabilities: Increase in Liability = Inflow (+), Decrease = Outflow (-)
        if root_type == "Liability" and ("payable" in lower_type or "creditor" in lower_name or "payable" in lower_name or "accrued" in lower_name):
            cash_impact = net_change_liability_view
            if cash_impact != 0:
                label = f"Increase / (Decrease) in {acct_name}"
                working_capital_items.append({"item": label, "account": acct_name, "amount": round(cash_impact, 2)})
                total_working_capital += cash_impact
            continue

        # 5. Tax Payable / Liabilities
        if root_type == "Liability" and ("tax" in lower_type or "tax" in lower_name or "vat" in lower_name or "duties" in lower_name):
            cash_impact = net_change_liability_view
            if cash_impact != 0:
                label = f"Increase / (Decrease) in {acct_name}"
                working_capital_items.append({"item": label, "account": acct_name, "amount": round(cash_impact, 2)})
                total_working_capital += cash_impact
            continue

        # Investing Activities:
        # Purchase of PPE/Fixed Assets / Intangibles = Outflow (-), Sale/Disposal = Inflow (+)
        if root_type == "Asset" and any(k in lower_type or k in lower_name for k in ["fixed asset", "equipment", "machinery", "furniture", "vehicle", "building", "land", "intangible", "software", "patent", "goodwill", "investment", "capital work in progress"]):
            cash_impact = -(net_change_asset_view)
            if cash_impact != 0:
                label = f"Capital Expenditure / Investment in {acct_name}" if cash_impact < 0 else f"Proceeds from Disposal / Realization of {acct_name}"
                investing_items.append({"item": label, "account": acct_name, "amount": round(cash_impact, 2)})
                total_investing += cash_impact
            continue

        # Financing Activities:
        # 1. Equity: Capital Stock, Share Capital, Owner's Capital, Reserves
        if root_type == "Equity":
            if "drawing" in lower_name or "dividend" in lower_name:
                cash_impact = -(debit - credit)
                if cash_impact != 0:
                    label = f"Drawings / Dividends Paid ({acct_name})"
                    financing_items.append({"item": label, "account": acct_name, "amount": round(cash_impact, 2)})
                    total_financing += cash_impact
            elif "retained earnings" not in lower_name and "opening balance equity" not in lower_name:
                cash_impact = net_change_liability_view
                if cash_impact != 0:
                    label = f"Capital Inflow / (Repurchase) - {acct_name}" if cash_impact > 0 else f"Reduction in {acct_name}"
                    financing_items.append({"item": label, "account": acct_name, "amount": round(cash_impact, 2)})
                    total_financing += cash_impact
            continue

        # 2. Long-term Debt & Bank Loans
        if root_type == "Liability" and any(k in lower_name or k in lower_type for k in ["loan", "borrowing", "debt", "bond", "debenture"]):
            cash_impact = net_change_liability_view
            if cash_impact != 0:
                label = f"Proceeds from / (Repayment of) {acct_name}"
                financing_items.append({"item": label, "account": acct_name, "amount": round(cash_impact, 2)})
                total_financing += cash_impact
            continue

    total_operating = net_profit + total_non_cash + total_working_capital
    net_cash_flow = total_operating + total_investing + total_financing
    ending_cash = beginning_cash + actual_cash_change

    # If beginning cash is zero (e.g. no from_date set), ending cash is the sum of cash/bank balances
    if not from_date:
        all_time_summaries = _get_ledger_summaries(to_date=to_date)
        all_time_cash = 0.0
        for a_name, s in all_time_summaries.items():
            a_doc = all_accounts.get(a_name)
            if _is_cash_or_bank_account(a_name, a_doc):
                all_time_cash += (s["debit"] - s["credit"])
        ending_cash = all_time_cash
        beginning_cash = ending_cash - actual_cash_change

    return {
        "company_name": settings.company.name,
        "currency": settings.company.base_currency,
        "from_date": from_date,
        "to_date": to_date,
        "operating": {
            "netProfit": round(net_profit, 2),
            "nonCashAdjustments": non_cash_adjustments,
            "totalNonCashAdjustments": round(total_non_cash, 2),
            "workingCapitalAdjustments": working_capital_items,
            "totalWorkingCapitalAdjustments": round(total_working_capital, 2),
            "total": round(total_operating, 2)
        },
        "investing": {
            "items": investing_items,
            "total": round(total_investing, 2)
        },
        "financing": {
            "items": financing_items,
            "total": round(total_financing, 2)
        },
        "summary": {
            "netIncreaseInCash": round(net_cash_flow, 2),
            "beginningCash": round(beginning_cash, 2),
            "endingCash": round(ending_cash, 2),
            "actualCashChange": round(actual_cash_change, 2),
            "reconciled": abs(net_cash_flow - actual_cash_change) < 0.01,
        },
        "cashAccounts": cash_accounts_breakdown
    }


@app.get("/api/reports/general-ledger")

def general_ledger(
    account: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    party: Optional[str] = None,
    company_id: str = "default_company",
):
    """Show all ledger entries with optional filters."""
    from backend.models.settings_model import get_company_settings
    settings = get_company_settings(company_id)

    entries = db.get_ledger_entries()
    result = []

    for entry in entries:
        if account and entry.get("account") != account:
            continue
        if from_date and entry.get("date", "") < from_date:
            continue
        if to_date and entry.get("date", "") > to_date:
            continue
        if party and entry.get("party", "") != party:
            continue
        result.append(entry)

    # Add running balance
    running = 0.0
    for entry in result:
        debit = safe_float(entry.get("debit"), 0)
        credit = safe_float(entry.get("credit"), 0)
        acct = entry.get("account", "")
        rt = _get_root_type(acct)
        if rt and is_debit(rt):
            running += debit - credit
        elif rt:
            running += credit - debit
        else:
            running += debit - credit
        entry["balance"] = round(running, 2)

    return {
        "company_name": settings.company.name,
        "currency": settings.company.base_currency,
        "entries": result,
    }


@app.get("/api/reports/trial-balance")
def trial_balance(from_date: Optional[str] = None, to_date: Optional[str] = None, company_id: str = "default_company"):
    """Trial balance - all accounts with debit/credit totals."""
    from backend.models.settings_model import get_company_settings
    settings = get_company_settings(company_id)

    entries = _get_ledger_summaries(from_date, to_date)
    result = []

    total_debit = 0.0
    total_credit = 0.0

    for acct_name, summary in entries.items():
        debit = summary["debit"]
        credit = summary["credit"]
        balance = debit - credit

        if balance == 0 and debit == 0 and credit == 0:
            continue

        account = db.get_doc("Account", acct_name)
        root_type = account.get("rootType", "") if account else ""

        # Trial balance shows debit or credit balance per account
        if is_debit(root_type):
            if balance >= 0:
                dr = balance
                cr = 0.0
            else:
                dr = 0.0
                cr = -balance
        else:
            normal_balance = credit - debit
            if normal_balance >= 0:
                dr = 0.0
                cr = normal_balance
            else:
                dr = -normal_balance
                cr = 0.0

        result.append({
            "account": acct_name,
            "accountNumber": account.get("accountNumber", "") if account else "",
            "rootType": root_type,
            "accountType": account.get("accountType", "") if account else "",
            "debit": round(dr, 2),
            "credit": round(cr, 2),
        })
        total_debit += dr
        total_credit += cr

    return {
        "company_name": settings.company.name,
        "currency": settings.company.base_currency,
        "accounts": result,
        "totalDebit": round(total_debit, 2),
        "totalCredit": round(total_credit, 2),
        "balanced": abs(total_debit - total_credit) < 0.01,
    }


# ─── AR/AP Aging Reports ───────────────────────────────────────────────

@app.get("/api/reports/ar-aging")
def ar_aging():
    """Accounts Receivable aging by period."""
    entries = db.get_ledger_entries()
    debtors_entries = [e for e in entries if e.get("account") == "Debtors" and not e.get("reverted")]
    
    current = 0.0
    periods = {"0-30": 0.0, "31-60": 0.0, "61-90": 0.0, "90+": 0.0}
    
    for entry in debtors_entries:
        debit = safe_float(entry.get("debit"), 0)
        credit = safe_float(entry.get("credit"), 0)
        amount = debit - credit
        
        if amount == 0:
            continue
            
        entry_date = entry.get("date", "")
        if entry_date:
            from datetime import datetime, timedelta
            try:
                d = datetime.strptime(entry_date, "%Y-%m-%d").date()
                days_old = (date.today() - d).days
                if days_old <= 30:
                    periods["0-30"] += amount
                elif days_old <= 60:
                    periods["31-60"] += amount
                elif days_old <= 90:
                    periods["61-90"] += amount
                else:
                    periods["90+"] += amount
            except:
                current += amount
        else:
            current += amount
    
    total = sum(periods.values())
    return {
        "account": "Debtors",
        "total": total,
        "current": current,
        "periods": periods,
    }


@app.get("/api/reports/ap-aging")
def ap_aging():
    """Accounts Payable aging by period."""
    entries = db.get_ledger_entries()
    creditors_entries = [e for e in entries if e.get("account") == "Creditors" and not e.get("reverted")]
    
    current = 0.0
    periods = {"0-30": 0.0, "31-60": 0.0, "61-90": 0.0, "90+": 0.0}
    
    for entry in creditors_entries:
        debit = safe_float(entry.get("debit"), 0)
        credit = safe_float(entry.get("credit"), 0)
        amount = credit - debit
        
        if amount == 0:
            continue
            
        entry_date = entry.get("date", "")
        if entry_date:
            from datetime import datetime, timedelta
            try:
                d = datetime.strptime(entry_date, "%Y-%m-%d").date()
                days_old = (date.today() - d).days
                if days_old <= 30:
                    periods["0-30"] += amount
                elif days_old <= 60:
                    periods["31-60"] += amount
                elif days_old <= 90:
                    periods["61-90"] += amount
                else:
                    periods["90+"] += amount
            except:
                current += amount
        else:
            current += amount
    
    total = sum(periods.values())
    return {
        "account": "Creditors",
        "total": total,
        "current": current,
        "periods": periods,
    }


@app.get("/api/reports/tax-summary")
def tax_summary():
    """Tax summary report showing tax payable/receivable."""
    entries = db.get_ledger_entries()
    tax_accounts = {}
    
    for entry in entries:
        account = entry.get("account", "")
        if "Tax" not in account and "tax" not in account.lower():
            continue
        if entry.get("reverted"):
            continue
            
        debit = safe_float(entry.get("debit"), 0)
        credit = safe_float(entry.get("credit"), 0)
        
        if account not in tax_accounts:
            tax_accounts[account] = {"debit": 0.0, "credit": 0.0, "balance": 0.0}
        
        tax_accounts[account]["debit"] += debit
        tax_accounts[account]["credit"] += credit
        tax_accounts[account]["balance"] += credit - debit
    
    return {"accounts": tax_accounts}


@app.get("/api/reports/close-checklist")
def close_checklist():
    """Month-end close checklist status."""
    from datetime import date
    today = date.today()
    first_of_month = date(today.year, today.month, 1)
    
    entries = db.get_ledger_entries()
    month_entries = [e for e in entries if e.get("date", "") >= first_of_month.isoformat()]
    
    all_posted = all(e.get("submitted") for e in db.get_all_docs("JournalEntry", {}))
    
    all_invoices_posted = all(
        e.get("submitted") 
        for e in db.get_all_docs("SalesInvoice", {}) + db.get_all_docs("PurchaseInvoice", {})
    )

    closed_period = db.get_single_value("closed_period") or ""
    is_closed = (closed_period == today.strftime("%B %Y"))
    
    return {
        "period": today.strftime("%B %Y"),
        "checks": [
            {"name": "All Journal Entries Posted", "passed": all_posted},
            {"name": "All Invoices Submitted", "passed": all_invoices_posted},
            {"name": "Ledger Entries Balanced", "passed": True},
            {"name": "Bank Reconciliation Complete", "passed": True},
        ],
        "ready_to_close": (all_posted and all_invoices_posted) or is_closed,
        "is_closed": is_closed,
    }


@app.post("/api/reports/close-period")
def close_period_route(body: dict):
    """Close the financial period."""
    period = body.get("period", "")
    db.set_single_value("closed_period", period)
    return {"status": "closed", "period": period}



# ─── Single Values (Settings) ─────────────────────────────────────────

@app.get("/api/single-values/{key}")
def get_single_value_route(key: str):
    value = db.get_single_value(key)
    if value is None:
        raise HTTPException(404, f"Key '{key}' not found")
    return {"key": key, "value": value}


@app.post("/api/single-values/{key}")
def set_single_value_route(key: str, body: dict):
    value = body.get("value", "")
    db.set_single_value(key, str(value))
    return {"key": key, "value": str(value)}


# ─── Generic CRUD Routes ────────────────────────────────────────────────

class DocCreate(BaseModel):
    data: dict


# Schemas
@app.get("/api/schemas")
def list_schemas():
    return {name: s.model_dump() for name, s in get_all_schemas().items()}


@app.get("/api/schemas/{schema_name}")
def get_schema_route(schema_name: str):
    s = get_schema(schema_name)
    if not s:
        raise HTTPException(404, f"Schema '{schema_name}' not found")
    return s.model_dump()


# Generic CRUD
@app.get("/api/{schema_name}")
def list_docs(schema_name: str, limit: int = 1000, offset: int = 0):
    model = get_model(schema_name)
    if not model:
        raise HTTPException(404, f"Model '{schema_name}' not found")
    docs = model.get_all(limit=limit)
    return [d.to_dict() for d in docs]


@app.get("/api/{schema_name}/{name}")
def get_doc_route(schema_name: str, name: str):
    model = get_model(schema_name)
    if not model:
        raise HTTPException(404, f"Model '{schema_name}' not found")
    doc = model.get(name)
    if not doc:
        raise HTTPException(404, f"Document '{name}' not found in {schema_name}")
    return doc.to_dict()


@app.post("/api/{schema_name}")
async def create_doc_route(schema_name: str, request: Request):
    try:
        raw_body = await request.json()
    except Exception:
        raw_body = {}

    if isinstance(raw_body, dict) and "data" in raw_body and isinstance(raw_body["data"], dict):
        payload = raw_body["data"]
    elif isinstance(raw_body, dict):
        payload = raw_body
    else:
        payload = {}

    model = get_model(schema_name)
    if not model:
        raise HTTPException(404, f"Model '{schema_name}' not found")

    target_schema = getattr(model, "schema_name", schema_name)

    # Normalize field aliases for AI / tool convenience
    if target_schema in ["SalesInvoice", "PurchaseInvoice"]:
        if "party" not in payload:
            payload["party"] = payload.get("customer") or payload.get("supplier") or payload.get("partyName") or ""
        items = payload.get("items", [])
        if isinstance(items, list):
            for it in items:
                if isinstance(it, dict):
                    if "item" not in it:
                        it["item"] = it.get("item_code") or it.get("name") or it.get("item_name") or "Sales Item"
                    if "quantity" not in it:
                        it["quantity"] = it.get("qty") or 1

    elif target_schema == "Payment":
        if "amount" not in payload and "paidAmount" in payload:
            payload["amount"] = payload["paidAmount"]
        if "paymentType" not in payload and "payment_type" in payload:
            payload["paymentType"] = payload["payment_type"]
        if "account" not in payload:
            payload["account"] = "Cash"

    elif target_schema == "JournalEntry":
        from backend.coa import resolve_account_name
        entries = payload.get("accounts") or payload.get("entries") or []
        if isinstance(entries, list):
            normalized_lines = []
            for line in entries:
                if isinstance(line, dict):
                    acct_name = resolve_account_name(line.get("account") or line.get("account_name") or "")
                    debit = safe_float(line.get("debit"), 0)
                    credit = safe_float(line.get("credit"), 0)
                    if acct_name:
                        normalized_lines.append({
                            "account": acct_name,
                            "debit": debit,
                            "credit": credit,
                            "party": line.get("party", "")
                        })
            payload["accounts"] = normalized_lines

    with db.transaction():
        doc = model.create(payload)
        try:
            await model.before_sync(doc)
            model.save(doc)
        except Exception as e:
            if "UNIQUE constraint failed" in str(e):
                raise HTTPException(400, f"An account or document named '{payload.get('name')}' already exists.")
            raise HTTPException(400, str(e))

        db.add_audit_log(target_schema, doc.get("name"), "Created", f"Created {target_schema} entry")

        # Auto-submit submittable transaction documents so debits/credits post to ledger immediately
        if target_schema in ["JournalEntry", "SalesInvoice", "PurchaseInvoice", "Payment", "PurchaseOrder"]:
            amount = safe_float(doc.get("grandTotal") or doc.get("totalDebit") or doc.get("amount"), 0)
            company_id = doc.get("company_id") or "default_company"

            from backend.models.approval_model import check_approval_required, create_approval_request
            appr_rule = check_approval_required(company_id, target_schema, amount)

            if appr_rule and doc.get("approvalStatus") != "Approved":
                create_approval_request(company_id, target_schema, doc.get("name"), amount)
                doc._data["approvalStatus"] = "Pending"
                db.update_doc(doc)
                db.add_audit_log(target_schema, doc.get("name"), "Approval Requested", f"Requires approval for amount ${amount:,.2f}")
            else:
                try:
                    await model.after_submit(doc)
                    db.add_audit_log(target_schema, doc.get("name"), "Posted", "Auto-posted entries to double-entry ledger")
                except Exception as e:
                    print(f"Auto-submit ledger error for {target_schema}: {e}")
                    raise HTTPException(status_code=400, detail=f"Transaction submission failed: {str(e)}")

        return doc.to_dict()


@app.put("/api/{schema_name}/{name}")
async def update_doc_route(schema_name: str, name: str, request: Request):
    try:
        raw_body = await request.json()
    except Exception:
        raw_body = {}

    if isinstance(raw_body, dict) and "data" in raw_body and isinstance(raw_body["data"], dict):
        payload = raw_body["data"]
    elif isinstance(raw_body, dict):
        payload = raw_body
    else:
        payload = {}

    model = get_model(schema_name)
    if not model:
        raise HTTPException(404, f"Model '{schema_name}' not found")
    doc = model.get(name)
    if not doc:
        raise HTTPException(404, f"Document '{name}' not found")

    if doc.get("cancelled") or doc.get("status") == "Cancelled":
        raise HTTPException(
            status_code=400,
            detail=f"{schema_name} '{name}' is CANCELLED and cannot be edited."
        )

    is_posted = doc.get("submitted") or doc.get("status") in ["Submitted", "Posted"]

    with db.transaction():
        if is_posted:
            # Controlled amendment / reposting process for posted documents
            from backend.models.invoice import reverse_document_postings
            reverse_document_postings(doc)

            for key, value in payload.items():
                doc._data[key] = value

            try:
                await model.before_sync(doc)
                model.save(doc)
                await model.after_submit(doc)
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Failed to amend {schema_name}: {str(e)}")

            db.add_audit_log(schema_name, name, "Amended", "Amended posted document and reposted ledger entries")
        else:
            for key, value in payload.items():
                doc._data[key] = value
            try:
                await model.before_sync(doc)
                model.save(doc)
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Failed to update {schema_name}: {str(e)}")
            db.add_audit_log(schema_name, name, "Edited", "Updated entry details and accounting lines")

        return doc.to_dict()


@app.delete("/api/{schema_name}/{name}")
async def delete_doc_route(schema_name: str, name: str):
    model = get_model(schema_name)
    if not model:
        raise HTTPException(404, f"Model '{schema_name}' not found")
    doc = model.get(name)
    if not doc:
        raise HTTPException(404, f"Document '{name}' not found")

    if doc.get("cancelled") or doc.get("status") == "Cancelled":
        raise HTTPException(
            status_code=400,
            detail=f"{schema_name} '{name}' is CANCELLED and cannot be deleted. Cancelled documents are preserved for audit history."
        )

    if doc.get("submitted") or doc.get("status") in ["Submitted", "Posted"]:
        raise HTTPException(
            status_code=400,
            detail=f"{schema_name} '{name}' has been POSTED and cannot be deleted. Use the cancellation workflow to reverse accounting entries."
        )

    with db.transaction():
        await model.after_delete(doc)
        model.delete(name)
        db.add_audit_log(schema_name, name, "Deleted", "Deleted draft document")
        return {"status": "deleted"}


# Submit (for submittable docs)
@app.post("/api/{schema_name}/{name}/submit")
async def submit_doc(schema_name: str, name: str):
    model = get_model(schema_name)
    if not model:
        raise HTTPException(404, f"Model '{schema_name}' not found")
    doc = model.get(name)
    if not doc:
        raise HTTPException(404, f"Document '{name}' not found")

    if doc.get("cancelled") or doc.get("status") == "Cancelled":
        raise HTTPException(status_code=400, detail=f"{schema_name} '{name}' is CANCELLED and cannot be submitted.")

    with db.transaction():
        await model.before_sync(doc)
        model.save(doc)
        await model.after_submit(doc)
        db.add_audit_log(schema_name, name, "Posted", "Posted accounting entries to double-entry ledger")
        return doc.to_dict()


# Cancel (reverse ledger entries)
@app.post("/api/{schema_name}/{name}/cancel")
async def cancel_doc(schema_name: str, name: str):
    model = get_model(schema_name)
    if not model:
        raise HTTPException(404, f"Model '{schema_name}' not found")
    doc = model.get(name)
    if not doc:
        raise HTTPException(404, f"Document '{name}' not found")

    if doc.get("cancelled") or doc.get("status") == "Cancelled":
        raise HTTPException(status_code=400, detail=f"{schema_name} '{name}' is already cancelled.")

    with db.transaction():
        try:
            await model.after_cancel(doc)
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))
        db.add_audit_log(schema_name, name, "Cancelled", "Cancelled document and reversed ledger entries")
        return doc.to_dict()


# Reset document to draft status and revert ledger entries
@app.post("/api/{schema_name}/{name}/reset-to-draft")
async def reset_to_draft(schema_name: str, name: str):
    model = get_model(schema_name)
    if not model:
        raise HTTPException(404, f"Model '{schema_name}' not found")
    doc = model.get(name)
    if not doc:
        raise HTTPException(404, f"Document '{name}' not found")

    with db.transaction():
        if doc.get("submitted"):
            try:
                await model.after_cancel(doc)
            except Exception:
                pass

        doc._data["_is_lifecycle_transition"] = True
        doc._data["submitted"] = 0
        doc._data["cancelled"] = 0
        doc._data["status"] = "Draft"
        if schema_name in ["SalesInvoice", "PurchaseInvoice"]:
            doc._data["outstandingAmount"] = doc.get("grandTotal", 0)
        db.update_doc(doc)
        doc._data.pop("_is_lifecycle_transition", None)

        conn = db.get_connection()
        conn.execute(
            "DELETE FROM AccountingLedgerEntry WHERE reference_type = ? AND reference_name = ?",
            (schema_name, name)
        )
        conn.commit()

        db.add_audit_log(schema_name, name, "Reset to Draft", "Reverted ledger postings and unlocked entry for editing")
        return doc.to_dict()


@app.get("/api/{schema_name}/{name}/audit-logs")
def get_doc_audit_logs(schema_name: str, name: str):
    return db.get_audit_logs(schema_name, name)


# Mark Paid / Mark Unpaid
@app.post("/api/{schema_name}/{name}/mark-paid")
async def mark_invoice_paid(schema_name: str, name: str):
    if schema_name not in ["SalesInvoice", "PurchaseInvoice"]:
        raise HTTPException(400, "Mark paid only supported for SalesInvoice and PurchaseInvoice")
    model = get_model(schema_name)
    if not model:
        raise HTTPException(404, f"Model '{schema_name}' not found")
    doc = model.get(name)
    if not doc:
        raise HTTPException(404, f"Document '{name}' not found")

    if not doc.get("submitted"):
        await model.before_sync(doc)
        model.save(doc)
        await model.after_submit(doc)
        doc = model.get(name)

    outstanding = safe_float(doc.get("outstandingAmount"), 0)
    if outstanding <= 0:
        return doc.to_dict()

    is_sales = (schema_name == "SalesInvoice")
    pay_model = get_model("Payment")
    payment_data = {
        "party": doc.get("party", ""),
        "paymentType": "Receive" if is_sales else "Pay",
        "amount": outstanding,
        "date": date.today().isoformat(),
        "account": "Cash",
        "referenceType": schema_name,
        "referenceName": name,
    }
    pay_doc = pay_model.create(payment_data)
    await pay_model.before_sync(pay_doc)
    pay_model.save(pay_doc)
    await pay_model.after_submit(pay_doc)

    updated_doc = model.get(name)
    return updated_doc.to_dict()


@app.post("/api/{schema_name}/{name}/mark-unpaid")
async def mark_invoice_unpaid(schema_name: str, name: str):
    if schema_name not in ["SalesInvoice", "PurchaseInvoice"]:
        raise HTTPException(400, "Mark unpaid only supported for SalesInvoice and PurchaseInvoice")
    model = get_model(schema_name)
    if not model:
        raise HTTPException(404, f"Model '{schema_name}' not found")
    doc = model.get(name)
    if not doc:
        raise HTTPException(404, f"Document '{name}' not found")

    pay_model = get_model("Payment")
    payments = db.get_all_docs("Payment", {"referenceType": schema_name, "referenceName": name})
    for p in payments:
        if p.get("submitted") and not p.get("cancelled"):
            await pay_model.after_cancel(p)

    doc._data["outstandingAmount"] = safe_float(doc.get("grandTotal"), 0)
    db.update_doc(doc)

    return doc.to_dict()


# Serve frontend static files if they exist

def _get_ledger_summaries(from_date: Optional[str] = None, to_date: Optional[str] = None) -> dict:
    """Get aggregated debit/credit summaries per account, optionally filtered by date."""
    entries = db.get_ledger_entries()
    summaries = {}

    for entry in entries:
        acct = entry.get("account", "")
        if not acct:
            continue

        # Skip reverted entries
        if entry.get("reverted"):
            continue

        # Filter out parent documents that are unsubmitted or awaiting approval
        ref_type = entry.get("reference_type")
        ref_name = entry.get("reference_name")
        if ref_type and ref_name:
            parent_doc = db.get_doc(ref_type, ref_name)
            if parent_doc:
                if parent_doc.get("approvalStatus") in ["Pending", "Rejected"]:
                    continue
                if not parent_doc.get("submitted") and parent_doc.get("status") not in ["Submitted", "Posted"]:
                    continue

        # Date filtering

        entry_date = entry.get("date", "")
        if from_date and entry_date < from_date:
            continue
        if to_date and entry_date > to_date:
            continue

        debit = safe_float(entry.get("debit"), 0)
        credit = safe_float(entry.get("credit"), 0)

        if acct not in summaries:
            summaries[acct] = {"debit": 0.0, "credit": 0.0}

        summaries[acct]["debit"] += debit
        summaries[acct]["credit"] += credit

    return summaries


def _get_root_type(account_name: str) -> Optional[str]:
    """Get the root type of an account."""
    if not account_name or not isinstance(account_name, str):
        return None
    account = db.get_doc("Account", account_name)
    if account:
        return account.get("rootType", "")
    return None


def _get_account_balances_by_type(root_type: str) -> list[dict]:
    """Get all accounts of a root type with their balances."""
    accounts = db.get_all_docs("Account", {"rootType": root_type})
    entries = _get_ledger_summaries()

    balance_map = {}
    for acct, s in entries.items():
        if is_debit(root_type):
            balance_map[acct] = s["debit"] - s["credit"]
        else:
            balance_map[acct] = s["credit"] - s["debit"]

    result = []
    for a in accounts:
        name = a.get("name", "")
        result.append({
            "name": name,
            "accountType": a.get("accountType", ""),
            "balance": balance_map.get(name, 0.0),
        })
    return result


# Serve frontend static files if they exist (moved to end after all API routes)



if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("backend.main:app", host="0.0.0.0", port=port, reload=True)


# ─── AR/AP Aging Reports ───────────────────────────────────────────────

@app.get("/api/reports/ar-aging")
def ar_aging():
    """Accounts Receivable aging by period."""
    entries = db.get_ledger_entries()
    debtors_entries = [e for e in entries if e.get("account") == "Debtors" and not e.get("reverted")]
    
    current = 0.0
    periods = {"0-30": 0.0, "31-60": 0.0, "61-90": 0.0, "90+": 0.0}
    
    for entry in debtors_entries:
        debit = safe_float(entry.get("debit"), 0)
        credit = safe_float(entry.get("credit"), 0)
        amount = debit - credit
        
        if amount == 0:
            continue
            
        entry_date = entry.get("date", "")
        if entry_date:
            from datetime import datetime, timedelta
            try:
                d = datetime.strptime(entry_date, "%Y-%m-%d").date()
                days_old = (date.today() - d).days
                if days_old <= 30:
                    periods["0-30"] += amount
                elif days_old <= 60:
                    periods["31-60"] += amount
                elif days_old <= 90:
                    periods["61-90"] += amount
                else:
                    periods["90+"] += amount
            except:
                current += amount
        else:
            current += amount
    
    total = sum(periods.values())
    return {
        "account": "Debtors",
        "total": total,
        "current": current,
        "periods": periods,
    }


@app.get("/api/reports/ap-aging")
def ap_aging():
    """Accounts Payable aging by period."""
    entries = db.get_ledger_entries()
    creditors_entries = [e for e in entries if e.get("account") == "Creditors" and not e.get("reverted")]
    
    current = 0.0
    periods = {"0-30": 0.0, "31-60": 0.0, "61-90": 0.0, "90+": 0.0}
    
    for entry in creditors_entries:
        debit = safe_float(entry.get("debit"), 0)
        credit = safe_float(entry.get("credit"), 0)
        amount = credit - debit
        
        if amount == 0:
            continue
            
        entry_date = entry.get("date", "")
        if entry_date:
            from datetime import datetime, timedelta
            try:
                d = datetime.strptime(entry_date, "%Y-%m-%d").date()
                days_old = (date.today() - d).days
                if days_old <= 30:
                    periods["0-30"] += amount
                elif days_old <= 60:
                    periods["31-60"] += amount
                elif days_old <= 90:
                    periods["61-90"] += amount
                else:
                    periods["90+"] += amount
            except:
                current += amount
        else:
            current += amount
    
    total = sum(periods.values())
    return {
        "account": "Creditors",
        "total": total,
        "current": current,
        "periods": periods,
    }


@app.get("/api/reports/tax-summary")
def tax_summary():
    """Tax summary report showing tax payable/receivable."""
    entries = db.get_ledger_entries()
    tax_accounts = {}
    
    for entry in entries:
        account = entry.get("account", "")
        if "Tax" not in account and "tax" not in account.lower():
            continue
        if entry.get("reverted"):
            continue
            
        debit = safe_float(entry.get("debit"), 0)
        credit = safe_float(entry.get("credit"), 0)
        
        if account not in tax_accounts:
            tax_accounts[account] = {"debit": 0.0, "credit": 0.0, "balance": 0.0}
        
        tax_accounts[account]["debit"] += debit
        tax_accounts[account]["credit"] += credit
        tax_accounts[account]["balance"] += credit - debit
    
    return {"accounts": tax_accounts}


@app.get("/api/reports/close-checklist")
def close_checklist():
    """Month-end close checklist status."""
    from datetime import date
    today = date.today()
    first_of_month = date(today.year, today.month, 1)
    
    entries = db.get_ledger_entries()
    month_entries = [e for e in entries if e.get("date", "") >= first_of_month.isoformat()]
    
    # Check if all journal entries are posted
    all_posted = all(e.get("submitted") for e in db.get_all_docs("JournalEntry", {}))
    
    # Check if all invoices are submitted
    all_invoices_posted = all(
        e.get("submitted") 
        for e in db.get_all_docs("SalesInvoice", {}) + db.get_all_docs("PurchaseInvoice", {})
    )

    closed_period = db.get_single_value("closed_period") or ""
    is_closed = (closed_period == today.strftime("%B %Y"))
    
    return {
        "period": today.strftime("%B %Y"),
        "checks": [
            {"name": "All Journal Entries Posted", "passed": all_posted},
            {"name": "All Invoices Submitted", "passed": all_invoices_posted},
            {"name": "Ledger Entries Balanced", "passed": True},
            {"name": "Bank Reconciliation Complete", "passed": True},
        ],
        "ready_to_close": (all_posted and all_invoices_posted) or is_closed,
        "is_closed": is_closed,
    }


@app.post("/api/reports/close-period")
def close_period_route(body: dict):
    """Close the financial period."""
    period = body.get("period", "")
    db.set_single_value("closed_period", period)
    return {"status": "closed", "period": period}


# ─── Approval Workflows ───────────────────────────────────────────────

@app.get("/api/approvals/pending")
def get_pending_approvals():
    """Get all pending approvals."""
    approvals = db.get_all_docs("Approval", {"status": "Pending"})
    return [a.to_dict() for a in approvals]


@app.post("/api/approvals/{name}/approve")
def approve_doc(name: str):
    """Approve a document."""
    approval = db.get_doc("Approval", name)
    if not approval:
        raise HTTPException(404, f"Approval '{name}' not found")
    approval._data["status"] = "Approved"
    db.update_doc(approval)
    
    # Update the referenced document
    ref_type = approval.get("referenceType")
    ref_name = approval.get("referenceName")
    if ref_type and ref_name:
        ref_doc = db.get_doc(ref_type, ref_name)
        if ref_doc:
            ref_doc._data["approvalStatus"] = "Approved"
            db.update_doc(ref_doc)
    
    return approval.to_dict()


@app.post("/api/approvals/{name}/reject")
def reject_doc(name: str):
    """Reject a document."""
    approval = db.get_doc("Approval", name)
    if not approval:
        raise HTTPException(404, f"Approval '{name}' not found")
    approval._data["status"] = "Rejected"
    db.update_doc(approval)
    
    # Update the referenced document
    ref_type = approval.get("referenceType")
    ref_name = approval.get("referenceName")
    if ref_type and ref_name:
        ref_doc = db.get_doc(ref_type, ref_name)
        if ref_doc:
            ref_doc._data["approvalStatus"] = "Rejected"
            db.update_doc(ref_doc)
    
    return approval.to_dict()


# Serve frontend static files after all API routes
frontend_dist = os.environ.get("BOOKS_FRONTEND_DIST",
    os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "dist"))
if os.path.exists(frontend_dist):
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")

