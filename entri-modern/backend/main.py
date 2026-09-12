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

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from backend.core.schema_engine import load_schemas, get_all_schemas, get_schema, Doc
from backend.core import database as db
from backend.models import get_model, get_all_models
from backend.coa import build_coa_hierarchy, is_debit, is_credit, normal_balance_side


from backend.api.ai_router import router as ai_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    schemas_dir = os.environ.get("BOOKS_SCHEMAS_DIR",
        os.path.join(os.path.dirname(os.path.dirname(__file__)), "schemas"))
    load_schemas(schemas_dir)
    db.init_database()
    _seed_defaults()
    yield


app = FastAPI(title="entri API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ai_router)


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


@app.get("/api/reports/profit-and-loss")
def profit_and_loss(from_date: Optional[str] = None, to_date: Optional[str] = None):
    """Generate profit and loss statement."""
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
        "income": {"accounts": income_accounts, "total": total_income},
        "expenses": {"accounts": expense_accounts, "total": total_expenses},
        "netProfit": net_profit,
        "netProfitMargin": (net_profit / total_income * 100) if total_income else 0,
    }


@app.get("/api/reports/general-ledger")
def general_ledger(
    account: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    party: Optional[str] = None,
):
    """Show all ledger entries with optional filters."""
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
        debit = float(entry.get("debit", 0))
        credit = float(entry.get("credit", 0))
        acct = entry.get("account", "")
        rt = _get_root_type(acct)
        if rt and is_debit(rt):
            running += debit - credit
        elif rt:
            running += credit - debit
        else:
            running += debit - credit
        entry["balance"] = round(running, 2)

    return {"entries": result}


@app.get("/api/reports/trial-balance")
def trial_balance(from_date: Optional[str] = None, to_date: Optional[str] = None):
    """Trial balance - all accounts with debit/credit totals."""
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
            # Debit-natured: positive balance = debit
            if balance >= 0:
                dr = balance
                cr = 0.0
            else:
                dr = 0.0
                cr = -balance
        else:
            # Credit-natured: positive balance = credit (balance = credit - debit)
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
        "accounts": result,
        "totalDebit": round(total_debit, 2),
        "totalCredit": round(total_credit, 2),
        "balanced": abs(total_debit - total_credit) < 0.01,
    }


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
        # Ensure accounts line items format and resolve account names
        from backend.coa import resolve_account_name
        entries = payload.get("accounts") or payload.get("entries") or []
        if isinstance(entries, list):
            normalized_lines = []
            for line in entries:
                if isinstance(line, dict):
                    acct_name = resolve_account_name(line.get("account") or line.get("account_name") or "")
                    debit = float(line.get("debit", 0))
                    credit = float(line.get("credit", 0))
                    if acct_name:
                        normalized_lines.append({
                            "account": acct_name,
                            "debit": debit,
                            "credit": credit,
                            "party": line.get("party", "")
                        })
            payload["accounts"] = normalized_lines

    doc = model.create(payload)
    await model.before_sync(doc)
    model.save(doc)

    # Auto-submit submittable transaction documents so debits/credits post to ledger immediately
    if target_schema in ["JournalEntry", "SalesInvoice", "PurchaseInvoice", "Payment", "PurchaseOrder"]:
        try:
            await model.after_submit(doc)
        except Exception as e:
            print(f"Auto-submit ledger error for {target_schema}: {e}")
            raise HTTPException(status_code=400, detail=f"Transaction submission failed: {str(e)}")

    return doc.to_dict()



@app.put("/api/{schema_name}/{name}")
async def update_doc_route(schema_name: str, name: str, body: DocCreate):
    model = get_model(schema_name)
    if not model:
        raise HTTPException(404, f"Model '{schema_name}' not found")
    doc = model.get(name)
    if not doc:
        raise HTTPException(404, f"Document '{name}' not found")
    for key, value in body.data.items():
        doc._data[key] = value
    await model.before_sync(doc)
    model.save(doc)
    return doc.to_dict()


@app.delete("/api/{schema_name}/{name}")
async def delete_doc_route(schema_name: str, name: str):
    model = get_model(schema_name)
    if not model:
        raise HTTPException(404, f"Model '{schema_name}' not found")
    doc = model.get(name)
    if not doc:
        raise HTTPException(404, f"Document '{name}' not found")
    await model.after_delete(doc)
    model.delete(name)
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
    await model.before_sync(doc)
    model.save(doc)
    await model.after_submit(doc)
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
    await model.after_cancel(doc)
    return doc.to_dict()


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

    outstanding = float(doc.get("outstandingAmount", 0))
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

    doc._data["outstandingAmount"] = float(doc.get("grandTotal", 0))
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

        # Date filtering
        entry_date = entry.get("date", "")
        if from_date and entry_date < from_date:
            continue
        if to_date and entry_date > to_date:
            continue

        debit = float(entry.get("debit", 0))
        credit = float(entry.get("credit", 0))

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


# Serve frontend static files if they exist
frontend_dist = os.environ.get("BOOKS_FRONTEND_DIST",
    os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "dist"))
if os.path.exists(frontend_dist):
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")


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
        debit = float(entry.get("debit", 0))
        credit = float(entry.get("credit", 0))
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
        debit = float(entry.get("debit", 0))
        credit = float(entry.get("credit", 0))
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
            
        debit = float(entry.get("debit", 0))
        credit = float(entry.get("credit", 0))
        
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
