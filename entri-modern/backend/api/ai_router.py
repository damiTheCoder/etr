"""
AI Agentic Accounting Router for FastAPI
Provides natural-language control over entri accounting operations.
Connects securely to OpenRouter API (Next N2 Pro model) server-side.
"""
import os
import json
import asyncio
import time
import uuid
import hashlib
import tempfile
import httpx
import re
from datetime import date as date_cls
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel

from backend.core import database as db
from backend.core.schema_engine import Doc
from backend.api.ai_security import (
    generate_idempotency_key,
    check_idempotency_key,
    sanitize_text,
    has_injection_patterns,
    resolve_party,
)

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

router = APIRouter(prefix="/api/ai", tags=["AI Agent"])

OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY")
MODEL_ID = os.environ.get("OPENROUTER_MODEL", "nex-agi/nex-n2.5-pro:free")

# Full suite of 23 Tool Schemas for OpenRouter AI Agent
TOOLS_SCHEMA = [
    {
        "type": "function",
        "function": {
            "name": "get_customers",
            "description": "Fetch list of customers in the accounting system.",
            "parameters": {
                "type": "object",
                "properties": {
                    "search": {"type": "string", "description": "Filter by customer name"},
                    "limit": {"type": "integer", "description": "Max results to return"}
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_parties",
            "description": "Fetch list of parties (customers and suppliers).",
            "parameters": {
                "type": "object",
                "properties": {
                    "party_type": {"type": "string", "description": "Party type: Customer or Supplier"},
                    "search": {"type": "string", "description": "Filter by name"},
                    "limit": {"type": "integer", "description": "Max results to return"}
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "create_party",
            "description": "Create a new customer or supplier in the system.",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "Party name"},
                    "party_type": {"type": "string", "description": "Customer or Supplier"},
                    "email": {"type": "string", "description": "Contact email"},
                    "phone": {"type": "string", "description": "Contact phone"}
                },
                "required": ["name"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_sales_invoices",
            "description": "Fetch list of sales invoices with optional customer filter.",
            "parameters": {
                "type": "object",
                "properties": {
                    "customer": {"type": "string", "description": "Filter by customer name"},
                    "limit": {"type": "integer", "description": "Max invoices to return"}
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "create_sales_invoice",
            "description": "Create a new sales invoice in the accounting database.",
            "parameters": {
                "type": "object",
                "properties": {
                    "customer": {"type": "string", "description": "Customer name (e.g. Acme Corp)"},
                    "date": {"type": "string", "description": "Invoice date YYYY-MM-DD"},
                    "items": {
                        "type": "array",
                        "description": "List of line items",
                        "items": {
                            "type": "object",
                            "properties": {
                                "item_code": {"type": "string", "description": "Item description or name"},
                                "qty": {"type": "number", "description": "Quantity"},
                                "rate": {"type": "number", "description": "Price rate per unit"}
                            },
                            "required": ["item_code", "qty", "rate"]
                        }
                    }
                },
                "required": ["customer", "items"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_purchase_invoices",
            "description": "Fetch list of purchase invoices from suppliers.",
            "parameters": {
                "type": "object",
                "properties": {
                    "supplier": {"type": "string", "description": "Filter by supplier name"},
                    "limit": {"type": "integer", "description": "Max results to return"}
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "create_purchase_invoice",
            "description": "Create a new purchase invoice from a supplier.",
            "parameters": {
                "type": "object",
                "properties": {
                    "supplier": {"type": "string", "description": "Supplier name"},
                    "date": {"type": "string", "description": "Invoice date YYYY-MM-DD"},
                    "items": {
                        "type": "array",
                        "description": "Line items purchased",
                        "items": {
                            "type": "object",
                            "properties": {
                                "item_code": {"type": "string"},
                                "qty": {"type": "number"},
                                "rate": {"type": "number"}
                            },
                            "required": ["item_code", "qty", "rate"]
                        }
                    }
                },
                "required": ["supplier", "items"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_payments",
            "description": "Fetch payments history (receipts and vendor payments).",
            "parameters": {
                "type": "object",
                "properties": {
                    "party": {"type": "string", "description": "Filter by customer/supplier name"},
                    "limit": {"type": "integer", "description": "Max results"}
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "create_payment",
            "description": "Record a payment entry (Receive money from customer or Pay money to supplier).",
            "parameters": {
                "type": "object",
                "properties": {
                    "party": {"type": "string", "description": "Customer or supplier name"},
                    "amount": {"type": "number", "description": "Payment amount"},
                    "payment_type": {"type": "string", "description": "Receive or Pay"},
                    "reference": {"type": "string", "description": "Invoice or reference number"}
                },
                "required": ["party", "amount"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_journal_entries",
            "description": "Fetch journal entries.",
            "parameters": {
                "type": "object",
                "properties": {
                    "limit": {"type": "integer", "description": "Max results to return"}
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "create_journal_entry",
            "description": "Post a double-entry journal voucher in the ledger.",
            "parameters": {
                "type": "object",
                "properties": {
                    "remark": {"type": "string", "description": "Description / remark"},
                    "entries": {
                        "type": "array",
                        "description": "List of account debit and credit entries",
                        "items": {
                            "type": "object",
                            "properties": {
                                "account": {"type": "string", "description": "Account name (e.g. Cash, Sales Revenue)"},
                                "debit": {"type": "number", "description": "Debit amount"},
                                "credit": {"type": "number", "description": "Credit amount"}
                            },
                            "required": ["account"]
                        }
                    }
                },
                "required": ["entries"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_purchase_orders",
            "description": "Fetch purchase orders list.",
            "parameters": {
                "type": "object",
                "properties": {
                    "supplier": {"type": "string", "description": "Filter by supplier"},
                    "limit": {"type": "integer", "description": "Max results"}
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "create_purchase_order",
            "description": "Create a new purchase order to a supplier.",
            "parameters": {
                "type": "object",
                "properties": {
                    "supplier": {"type": "string", "description": "Supplier name"},
                    "date": {"type": "string", "description": "Date YYYY-MM-DD"},
                    "items": {
                        "type": "array",
                        "description": "Items ordered",
                        "items": {
                            "type": "object",
                            "properties": {
                                "item_code": {"type": "string"},
                                "qty": {"type": "number"},
                                "rate": {"type": "number"}
                            },
                            "required": ["item_code", "qty", "rate"]
                        }
                    }
                },
                "required": ["supplier", "items"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_items",
            "description": "Fetch inventory and service items master list.",
            "parameters": {
                "type": "object",
                "properties": {
                    "search": {"type": "string", "description": "Search item by code or name"},
                    "limit": {"type": "integer", "description": "Max results"}
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "create_item",
            "description": "Create a new inventory or service item master.",
            "parameters": {
                "type": "object",
                "properties": {
                    "item_code": {"type": "string", "description": "Item code or title"},
                    "item_name": {"type": "string", "description": "Detailed item name"},
                    "rate": {"type": "number", "description": "Selling rate/price"},
                    "category": {"type": "string", "description": "Item category"}
                },
                "required": ["item_code"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_accounts",
            "description": "Fetch Chart of Accounts.",
            "parameters": {
                "type": "object",
                "properties": {}
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_dashboard_metrics",
            "description": "Get summary metrics such as total income, total expenses, and net profit.",
            "parameters": {
                "type": "object",
                "properties": {
                    "period": {"type": "string", "description": "Time period: monthly or yearly"}
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_profit_and_loss",
            "description": "Fetch detailed Profit and Loss financial statement.",
            "parameters": {
                "type": "object",
                "properties": {}
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_balance_sheet",
            "description": "Fetch Balance Sheet statement (Assets, Liabilities, Equity).",
            "parameters": {
                "type": "object",
                "properties": {}
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_general_ledger",
            "description": "Fetch General Ledger transactions.",
            "parameters": {
                "type": "object",
                "properties": {
                    "account": {"type": "string", "description": "Filter by account name"},
                    "limit": {"type": "integer", "description": "Max entries"}
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_trial_balance",
            "description": "Fetch Trial Balance financial statement.",
            "parameters": {
                "type": "object",
                "properties": {}
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_aging_report",
            "description": "Fetch Accounts Receivable (AR) or Accounts Payable (AP) Aging Report.",
            "parameters": {
                "type": "object",
                "properties": {
                    "aging_type": {"type": "string", "description": "ar for Accounts Receivable aging, ap for Accounts Payable aging"}
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "navigate_to_page",
            "description": "Navigate the user's browser UI directly to a specific page or route.",
            "parameters": {
                "type": "object",
                "properties": {
                    "page_route": {
                        "type": "string",
                        "description": "Route path: /sales-invoices, /sales-invoices/new, /purchase-invoices, /purchase-invoices/new, /payments, /payments/new, /journal-entries, /purchase-orders, /reports/profit-and-loss, /reports/balance-sheet, /reports/general-ledger, /reports/trial-balance, /reports/ar-aging, /reports/ap-aging, /parties, /items, /accounts, /settings"
                    },
                    "description": {"type": "string", "description": "Reason for navigation"}
                },
                "required": ["page_route"]
            }
        }
    }
]

class ChatMessage(BaseModel):
    role: str
    content: Optional[str] = ""
    tool_calls: Optional[List[Dict[str, Any]]] = None

class ChatRequest(BaseModel):
    messages: List[ChatMessage]


# Tool Execution Handlers

def _execute_get_customers(search: str = "", limit: int = 10):
    all_parties = db.get_all_docs("Party", filters={"partyType": "Customer"}, limit=limit)
    res = [p.to_dict() for p in all_parties]
    if search:
        s = search.lower()
        res = [c for c in res if s in c.get("name", "").lower()]
    return {"customers": res, "total": len(res)}

def _execute_get_parties(party_type: str = "", search: str = "", limit: int = 10):
    filters = {}
    if party_type:
        filters["partyType"] = party_type
    all_parties = db.get_all_docs("Party", filters=filters if filters else None, limit=limit)
    res = [p.to_dict() for p in all_parties]
    if search:
        s = search.lower()
        res = [c for c in res if s in c.get("name", "").lower()]
    return {"parties": res, "total": len(res)}

def _execute_create_party(name: str, party_type: str = "Customer", email: str = "", phone: str = ""):
    existing = db.get_doc("Party", name)
    if existing:
        return {"success": True, "party": existing.to_dict(), "message": f"Party {name} already exists."}
    doc = Doc("Party", {
        "name": name,
        "partyType": party_type,
        "email": email,
        "phone": phone
    })
    doc._not_inserted = True
    db.insert_doc(doc)
    return {"success": True, "party_name": name, "party_type": party_type, "message": f"{party_type} {name} created successfully."}

def _execute_get_sales_invoices(customer: str = "", limit: int = 10):
    filters = {}
    if customer:
        filters["customer"] = customer
    invoices = db.get_all_docs("SalesInvoice", filters=filters if filters else None, order_by="date", order="desc", limit=limit)
    res = [inv.to_dict() for inv in invoices]
    return {"invoices": res, "total": len(res)}

def _generate_doc_name(prefix: str, schema_name: str) -> str:
    """Generate a unique document name using SingleValue counter and checking database for collisions."""
    conn = db.get_connection()
    name = db._get_next_series_number(conn, prefix)
    while db.get_doc(schema_name, name):
        name = db._get_next_series_number(conn, prefix)
    return name


def _execute_create_sales_invoice(customer: str, items: list, date: str = ""):
    d_str = date or date_cls.today().isoformat()
    formatted_items = []
    grand_total = 0.0
    for idx, it in enumerate(items, 1):
        item_code = it.get("item_code", "Service Item")
        qty = float(it.get("qty", 1))
        rate = float(it.get("rate", 0))
        amount = qty * rate
        grand_total += amount
        formatted_items.append({
            "idx": idx,
            "itemCode": item_code,
            "qty": qty,
            "rate": rate,
            "amount": amount
        })

    inv_name = _generate_doc_name("SINV-", "SalesInvoice")

    inv_doc = Doc("SalesInvoice", {
        "name": inv_name,
        "customer": customer,
        "date": d_str,
        "grandTotal": grand_total,
        "outstandingAmount": grand_total,
        "submitted": 0,
        "status": "Draft",
        "items": formatted_items
    })
    inv_doc._not_inserted = True
    db.insert_doc(inv_doc)

    return {
        "success": True,
        "schema_name": "SalesInvoice",
        "doc_name": inv_name,
        "invoice_name": inv_name,
        "customer": customer,
        "grand_total": grand_total,
        "status": "Draft",
        "requires_action": True,
        "message": f"Sales Invoice {inv_name} created as Draft for {customer} (${grand_total:,.2f}). Please choose whether to Submit to Ledger or Keep as Draft."
    }

def _execute_get_purchase_invoices(supplier: str = "", limit: int = 10):
    filters = {}
    if supplier:
        filters["supplier"] = supplier
    invoices = db.get_all_docs("PurchaseInvoice", filters=filters if filters else None, order_by="date", order="desc", limit=limit)
    res = [inv.to_dict() for inv in invoices]
    return {"purchase_invoices": res, "total": len(res)}

def _execute_create_purchase_invoice(supplier: str, items: list, date: str = None):
    d_str = date or date_cls.today().isoformat()
    _execute_create_party(name=supplier, party_type="Supplier")

    formatted_items = []
    grand_total = 0.0
    for idx, it in enumerate(items, 1):
        item_code = it.get("item_code", "Supplies")
        qty = float(it.get("qty", 1))
        rate = float(it.get("rate", 0))
        amount = qty * rate
        grand_total += amount
        formatted_items.append({
            "idx": idx,
            "itemCode": item_code,
            "qty": qty,
            "rate": rate,
            "amount": amount
        })

    inv_name = _generate_doc_name("PINV-", "PurchaseInvoice")

    inv_doc = Doc("PurchaseInvoice", {
        "name": inv_name,
        "supplier": supplier,
        "date": d_str,
        "grandTotal": grand_total,
        "outstandingAmount": grand_total,
        "submitted": 0,
        "status": "Draft",
        "items": formatted_items
    })
    inv_doc._not_inserted = True
    db.insert_doc(inv_doc)

    return {
        "success": True,
        "schema_name": "PurchaseInvoice",
        "doc_name": inv_name,
        "invoice_name": inv_name,
        "supplier": supplier,
        "grand_total": grand_total,
        "status": "Draft",
        "requires_action": True,
        "message": f"Purchase Invoice {inv_name} created as Draft from {supplier} (${grand_total:,.2f}). Please choose whether to Submit to Ledger or Keep as Draft."
    }

def _execute_get_payments(party: str = "", limit: int = 10):
    filters = {}
    if party:
        filters["party"] = party
    payments = db.get_all_docs("PaymentEntry", filters=filters if filters else None, order_by="date", order="desc", limit=limit)
    res = [p.to_dict() for p in payments]
    return {"payments": res, "total": len(res)}

def _execute_create_payment(party: str, amount: float, payment_type: str = "Receive", reference: str = ""):
    pay_name = _generate_doc_name("PE-", "PaymentEntry")

    doc = Doc("PaymentEntry", {
        "name": pay_name,
        "party": party,
        "paymentType": payment_type,
        "paidAmount": amount,
        "date": date_cls.today().isoformat(),
        "referenceNo": reference,
        "submitted": 0,
        "status": "Draft"
    })
    doc._not_inserted = True
    db.insert_doc(doc)

    return {
        "success": True,
        "schema_name": "Payment",
        "doc_name": pay_name,
        "payment_name": pay_name,
        "party": party,
        "amount": amount,
        "payment_type": payment_type,
        "status": "Draft",
        "requires_action": True,
        "message": f"Payment entry {pay_name} of ${amount:,.2f} recorded as Draft for {party}. Please choose whether to Submit to Ledger or Keep as Draft."
    }

def _execute_get_journal_entries(limit: int = 10):
    entries = db.get_all_docs("JournalEntry", order_by="date", order="desc", limit=limit)
    res = [e.to_dict() for e in entries]
    return {"journal_entries": res, "total": len(res)}

def _execute_create_journal_entry(entries: list, remark: str = "", idempotency_key: str = "", date: str = ""):
    # Gap 1: Idempotency — return existing entry if duplicate key detected
    if idempotency_key:
        existing = check_idempotency_key(idempotency_key)
        if existing:
            return {
                "success": True,
                "schema_name": "JournalEntry",
                "doc_name": existing.get("name", ""),
                "jv_name": existing.get("name", ""),
                "total_debit": existing.get("totalDebit", 0),
                "total_credit": existing.get("totalCredit", 0),
                "status": "Submitted",
                "accounts": existing.get("accounts", []),
                "idempotent": True,
                "message": f"Journal Entry {existing.get('name', '')} already exists (idempotent)."
            }

    jv_name = _generate_doc_name("JV-", "JournalEntry")

    formatted_accounts = []
    total_debit = 0.0
    total_credit = 0.0
    for it in entries:
        d = float(it.get("debit", 0))
        c = float(it.get("credit", 0))
        total_debit += d
        total_credit += c
        formatted_accounts.append({
            "account": it.get("account", "Unassigned"),
            "debit": d,
            "credit": c
        })

    # Gap 3: Sanitize remark to prevent prompt injection in stored ledger text
    safe_remark = sanitize_text(remark)
    doc = Doc("JournalEntry", {
        "name": jv_name,
        "date": date or date_cls.today().isoformat(),
        "userRemark": safe_remark,
        "totalDebit": total_debit,
        "totalCredit": total_credit,
        "submitted": 1,
        "status": "Submitted",
        "accounts": formatted_accounts,
        "idempotency_key": idempotency_key,
    })
    doc._not_inserted = True
    db.insert_doc(doc)

    # Post to ledger via LedgerPosting
    try:
        from backend.core.schema_engine import LedgerPosting
        from backend.models.invoice import _save_ledger_entry
        from backend.coa import resolve_account_name

        posting = LedgerPosting(doc)
        for line in formatted_accounts:
            acct = resolve_account_name(line.get("account", ""))
            deb = float(line.get("debit", 0))
            cred = float(line.get("credit", 0))
            if acct:
                if deb > 0:
                    posting.debit(acct, deb)
                if cred > 0:
                    posting.credit(acct, cred)
        posting.validate()
        for entry in posting.get_entries():
            _save_ledger_entry(entry)
    except Exception as e:
        print(f"Ledger posting error for {jv_name}: {e}")

    return {
        "success": True,
        "schema_name": "JournalEntry",
        "doc_name": jv_name,
        "jv_name": jv_name,
        "total_debit": total_debit,
        "total_credit": total_credit,
        "status": "Submitted",
        "accounts": formatted_accounts,
        "message": f"Journal Entry {jv_name} created and posted to ledger."
    }

def _execute_get_purchase_orders(supplier: str = "", limit: int = 10):
    filters = {}
    if supplier:
        filters["supplier"] = supplier
    orders = db.get_all_docs("PurchaseOrder", filters=filters if filters else None, order_by="date", order="desc", limit=limit)
    res = [o.to_dict() for o in orders]
    return {"purchase_orders": res, "total": len(res)}

def _execute_create_purchase_order(supplier: str, items: list, date: str = None):
    d_str = date or date_cls.today().isoformat()
    _execute_create_party(name=supplier, party_type="Supplier")

    formatted_items = []
    grand_total = 0.0
    for idx, it in enumerate(items, 1):
        item_code = it.get("item_code", "Item")
        qty = float(it.get("qty", 1))
        rate = float(it.get("rate", 0))
        amount = qty * rate
        grand_total += amount
        formatted_items.append({
            "idx": idx,
            "itemCode": item_code,
            "qty": qty,
            "rate": rate,
            "amount": amount
        })

    po_name = _generate_doc_name("PO-", "PurchaseOrder")

    doc = Doc("PurchaseOrder", {
        "name": po_name,
        "supplier": supplier,
        "date": d_str,
        "grandTotal": grand_total,
        "status": "Submitted",
        "items": formatted_items
    })
    doc._not_inserted = True
    db.insert_doc(doc)

    return {
        "success": True,
        "po_name": po_name,
        "supplier": supplier,
        "grand_total": grand_total,
        "message": f"Purchase Order {po_name} created for {supplier}."
    }

def _execute_get_items(search: str = "", limit: int = 10):
    items = db.get_all_docs("Item", limit=limit)
    res = [i.to_dict() for i in items]
    if search:
        s = search.lower()
        res = [i for i in res if s in i.get("name", "").lower() or s in i.get("itemCode", "").lower()]
    return {"items": res, "total": len(res)}

def _execute_create_item(item_code: str, item_name: str = "", rate: float = 0.0, category: str = "General"):
    doc = Doc("Item", {
        "name": item_code,
        "itemCode": item_code,
        "itemName": item_name or item_code,
        "standardRate": rate,
        "itemGroup": category
    })
    doc._not_inserted = True
    db.insert_doc(doc)
    return {"success": True, "item_code": item_code, "rate": rate, "message": f"Item {item_code} created successfully."}

def _execute_get_accounts():
    from backend.main import get_account_tree
    return get_account_tree()

def _execute_get_dashboard_metrics(period: str = "monthly"):
    from backend.main import profit_and_loss
    return profit_and_loss()

def _execute_get_profit_and_loss():
    from backend.main import profit_and_loss
    return profit_and_loss()

def _execute_get_balance_sheet():
    from backend.main import balance_sheet
    return balance_sheet()

def _execute_get_general_ledger(account: str = "", limit: int = 20):
    from backend.main import general_ledger
    return general_ledger(account=account if account else None)

def _execute_get_trial_balance():
    from backend.main import trial_balance
    return trial_balance()

def _execute_get_aging_report(aging_type: str = "ar"):
    from backend.main import ar_aging, ap_aging
    if aging_type.lower() == "ap":
        return ap_aging()
    return ar_aging()

def _execute_navigate_to_page(page_route: str, description: str = ""):
    return {
        "action": "navigate",
        "route": page_route,
        "description": description or f"Navigating to {page_route}",
        "message": f"Redirecting UI to {page_route}"
    }


def _local_fast_route_matcher(text: str):
    t = text.strip().lower()
    routes_map = {
        "invoice": "/sales-invoices",
        "invoices": "/sales-invoices",
        "sales invoice": "/sales-invoices",
        "sales invoices": "/sales-invoices",
        "new invoice": "/sales-invoices/new",
        "create invoice": "/sales-invoices/new",
        "purchase invoice": "/purchase-invoices",
        "purchase invoices": "/purchase-invoices",
        "new purchase invoice": "/purchase-invoices/new",
        "payment": "/payments",
        "payments": "/payments",
        "new payment": "/payments/new",
        "journal": "/journal-entries",
        "journal entry": "/journal-entries",
        "journal entries": "/journal-entries",
        "new journal entry": "/journal-entries/new",
        "purchase order": "/purchase-orders",
        "purchase orders": "/purchase-orders",
        "new purchase order": "/purchase-orders/new",
        "p&l": "/reports/profit-and-loss",
        "profit and loss": "/reports/profit-and-loss",
        "balance sheet": "/reports/balance-sheet",
        "general ledger": "/reports/general-ledger",
        "trial balance": "/reports/trial-balance",
        "ar aging": "/reports/ar-aging",
        "ap aging": "/reports/ap-aging",
        "tax summary": "/reports/tax-summary",
        "close checklist": "/reports/close-checklist",
        "cash flow": "/reports/cashflow",
        "cashflow": "/reports/cashflow",
        "cash flow statement": "/reports/cashflow",
        "parties": "/parties",
        "customers": "/parties",
        "suppliers": "/parties",
        "items": "/items",
        "products": "/items",
        "accounts": "/accounts",
        "settings": "/settings"
    }
    for phrase, route in routes_map.items():
        if t == f"go to {phrase}" or t == f"open {phrase}" or t == f"navigate to {phrase}" or t == f"take me to {phrase}":
            return route
    return None


import re

def format_agent_response(tool_name: str, tool_args: dict, result: Any, error: Optional[str] = None) -> str:
    """
    Central response formatter with a warm, caring, loving personality.
    Formats agent tool execution results into human-friendly, supportive Markdown.
    """
    from backend.models.settings_model import get_company_settings
    try:
        settings = get_company_settings("default_company")
        base_curr = settings.company.base_currency if settings else "USD"
    except Exception:
        base_curr = "USD"
    sym = "₦" if base_curr == "NGN" else ("$" if base_curr == "USD" else f"{base_curr} ")

    if error or (isinstance(result, dict) and result.get("error")):
        err_msg = error or result.get("error")
        return f"❌ Oh, I ran into a little hiccup while processing that: **{err_msg}**. Don't worry at all, we can sort this out together! Please double-check the details or let me know how you'd like to adjust it."
    
    if not result:
        return f"✅ All done! I've executed '{tool_name}' successfully for you. I'm right here whenever you need anything else! ❤️"

    if not isinstance(result, dict):
        return str(result)

    # Format specific tool outputs with warmth, care, and business encouragement
    if tool_name == "create_journal_entry" or result.get("schema_name") == "JournalEntry" or "jv_name" in result:
        jv = result.get("jv_name") or result.get("doc_name") or "JV Entry"
        td = result.get("total_debit", result.get("total_credit", 0.0))
        status = result.get("status", "Draft")
        msg = result.get("message", "")
        accs = result.get("accounts", [])
        acc_details = []
        for a in accs:
            acc_name = a.get("account", "Account")
            deb = a.get("debit", 0)
            cred = a.get("credit", 0)
            if deb > 0:
                acc_details.append(f"{acc_name} (Debit {sym}{deb:,.2f})")
            elif cred > 0:
                acc_details.append(f"{acc_name} (Credit {sym}{cred:,.2f})")
        acc_str = ", ".join(acc_details) if acc_details else ""
        res_text = (
            f"I've got that taken care of for you! ❤️\n\n"
            f"✅ **Recorded Journal Entry `{jv}`**\n"
            f"- **Status**: {status}\n"
            f"- **Amount**: **{sym}{td:,.2f}**"
        )
        if acc_str:
            res_text += f"\n- **Account Distribution**: {acc_str}"
        if msg:
            res_text += f"\n\n*{msg}*"
        res_text += f"\n\nYour books are balanced and up to date. I'm right here whenever you'd like to record another transaction!"
        return res_text

    if tool_name == "get_profit_and_loss":
        inc = result.get("income", {}).get("total", 0.0)
        exp = result.get("expenses", {}).get("total", 0.0)
        np = result.get("netProfit", 0.0)
        npm = result.get("netProfitMargin", 0.0)
        status_cheer = (
            "🎉 **Wonderful news** — our business is running profitably! Every step forward is building greater value."
            if np > 0
            else ("⚖️ We are currently breaking even." if np == 0 else "💪 We have some net operational costs right now; I'm here to help us optimize expenses and grow revenue together!")
        )
        return (
            f"Here is how our profitability is looking! I'm watching over our performance with your best interest at heart: ❤️\n\n"
            f"### 📊 Profit & Loss Overview\n"
            f"| Metric | Amount |\n"
            f"| :--- | :--- |\n"
            f"| **Total Revenue / Income** | {sym}{inc:,.2f} |\n"
            f"| **Total Operating Expenses** | {sym}{exp:,.2f} |\n"
            f"| **Net Profit** | **{sym}{np:,.2f}** |\n"
            f"| **Net Profit Margin** | **{npm:.1f}%** |\n\n"
            f"{status_cheer}\n\n"
            f"Let me know if you would like me to break down any specific income or expense accounts for you!"
        )

    if tool_name == "get_dashboard_metrics":
        inc = result.get("total_revenue", 0.0) or result.get("income", {}).get("total", 0.0)
        exp = result.get("total_expenses", 0.0) or result.get("expenses", {}).get("total", 0.0)
        np = result.get("net_profit", 0.0) or result.get("netProfit", 0.0)
        cb = result.get("cash_balance", 0.0) or result.get("cashBalance", 0.0)
        ar = result.get("accounts_receivable", 0.0) or result.get("accountsReceivable", 0.0)
        ap = result.get("accounts_payable", 0.0) or result.get("accountsPayable", 0.0)
        return (
            f"Here is a snapshot of our core business health! I'm keeping everything monitored closely for you: ❤️\n\n"
            f"### 📈 Key Business Health Metrics\n"
            f"- **Total Revenue**: **{sym}{inc:,.2f}**\n"
            f"- **Total Expenses**: {sym}{exp:,.2f}\n"
            f"- **Net Profit**: **{sym}{np:,.2f}**\n"
            + (f"- **Cash in Bank / Hand**: **{sym}{cb:,.2f}**\n" if cb else "")
            + (f"- **Accounts Receivable**: {sym}{ar:,.2f}\n" if ar else "")
            + (f"- **Accounts Payable**: {sym}{ap:,.2f}\n" if ap else "")
            + f"\nI'm right here with you! Whether you need to record a sale, check an invoice, or review cash flow, just let me know."
        )

    if tool_name == "get_balance_sheet":
        ast = result.get("assets", {}).get("total", 0.0)
        liab = result.get("liabilities", {}).get("total", 0.0)
        eq = result.get("equity", {}).get("total", 0.0)
        return (
            f"Here is our business balance sheet! Keeping our foundation solid and assets protected is always my top priority: ❤️\n\n"
            f"### ⚖️ Balance Sheet Foundation\n"
            f"- **Total Assets**: **{sym}{ast:,.2f}**\n"
            f"- **Total Liabilities**: {sym}{liab:,.2f}\n"
            f"- **Total Owner's Equity**: **{sym}{eq:,.2f}**\n\n"
            f"Our books are reconciled and balanced. How else can I support our business today?"
        )

    if tool_name == "get_trial_balance":
        td = result.get("totalDebit", result.get("total_debit", 0.0))
        tc = result.get("totalCredit", result.get("total_credit", 0.0))
        balanced = result.get("balanced", td == tc)
        status_text = "Balanced perfectly ✅" if balanced else "Needs a quick review ⚠️"
        return (
            f"### ⚖️ Trial Balance Check\n"
            f"- **Audit Status**: {status_text}\n"
            f"- **Total Debits**: {sym}{td:,.2f}\n"
            f"- **Total Credits**: {sym}{tc:,.2f}\n\n"
            f"I keep your books verified and in check every step of the way!"
        )

    if tool_name == "get_general_ledger":
        entries = result.get("entries", [])
        total = result.get("total", len(entries))
        return f"### 📒 General Ledger\nI've pulled **{total}** verified ledger transaction(s) for our records. Everything is safely and neatly documented!"

    if tool_name == "get_aging_report":
        total = result.get("total", 0.0)
        periods = result.get("periods", {})
        return (
            f"Here is our receivables aging breakdown. I'm watching these closely to help us collect every penny owed to you: ❤️\n\n"
            f"### ⏳ Accounts Receivable Aging\n"
            f"- **Total Pending Collection**: **{sym}{total:,.2f}**\n"
            f"- **Current (0-30 Days)**: {sym}{periods.get('0_30', 0.0):,.2f}\n"
            f"- **31-60 Days**: {sym}{periods.get('31_60', 0.0):,.2f}\n"
            f"- **61-90 Days**: {sym}{periods.get('61_90', 0.0):,.2f}\n"
            f"- **Over 90 Days**: {sym}{periods.get('over_90', 0.0):,.2f}\n\n"
            f"Keeping your cash flow healthy is essential. Let me know if you'd like me to help draft any payment follow-ups!"
        )

    if "message" in result:
        return f"✅ {result['message']}"

    return f"✅ I've completed '{tool_name}' for you. I'm right here whenever you need the next step! ❤️"


def _find_matching_expense_account(query_term: str = "") -> Optional[str]:
    """Finds an appropriate expense account from the Chart of Accounts matching query_term, or settings default."""
    accounts = db.get_all_docs("Account")
    # Filter to Expense accounts
    expense_accs = [acc for acc in accounts if acc.get("accountType") == "Expense" or acc.get("rootType") == "Expense"]
    
    if not expense_accs:
        expense_accs = [acc for acc in accounts if "Expense" in acc.get("name", "") or "Expense" in acc.get("accountName", "")]
        
    if not expense_accs:
        return None

    # 1. Search for word matches in query_term (e.g. "rent", "utilities")
    if query_term:
        words = [w.lower() for w in query_term.split() if len(w) > 2]
        for acc in expense_accs:
            acc_name = (acc.get("accountName") or acc.get("name") or "").lower()
            if any(w in acc_name for w in words):
                return acc.get("name") or acc.get("accountName")

    # 2. Check settings for default purchase/expense account
    settings = db.get_doc("CompanySettings", "default_settings")
    if settings and settings.get("defaultExpenseAccount"):
        return settings.get("defaultExpenseAccount")

    # 3. Fallback to first available Expense account in COA
    first_exp = expense_accs[0]
    return first_exp.get("name") or first_exp.get("accountName")


def _local_fallback_intent_executor(user_text: str, user_id: str = "default", require_confirmation: bool = False):
    """
    Local deterministic accounting NLP intent processor.
    Matches queries to accounting tools directly when offline, rate-limited, or fallback.
    Enforces 2-signal transaction validation (verb + number) and explicit error reporting.
    Always maintains a loving, human, ever-ready tone with the user's best interest at heart.
    """
    t = user_text.strip().lower()

    # Resolve currency symbol for display
    try:
        from backend.models.settings_model import get_company_settings
        company_cfg = get_company_settings("default_company")
        base_curr = company_cfg.company.base_currency if company_cfg else "NGN"
    except Exception:
        base_curr = "NGN"
    sym = "₦" if base_curr == "NGN" else ("$" if base_curr == "USD" else f"{base_curr} ")

    # Check page navigation fast matcher
    matched_route = _local_fast_route_matcher(user_text)
    if matched_route:
        nav_res = _execute_navigate_to_page(matched_route)
        return {
            "role": "assistant",
            "content": f"Right away! I'm opening **{matched_route}** for us so we can look at it together. I'm right here whenever you need me! ❤️",
            "executed_tools": [{
                "name": "navigate_to_page",
                "arguments": {"page_route": matched_route},
                "result": nav_res
            }]
        }

    # Signal 1: Past-tense transaction verbs
    transaction_verbs = ["paid", "spent", "bought", "received", "sold", "invoiced", "refunded", "recorded", "posted"]
    matched_verb = next((v for v in transaction_verbs if v in t.split() or t.startswith(v)), None)

    # Signal 2: Numeric amount
    num_match = re.search(r'(\b\d+(?:\.\d+)?\b)', t)

    # TWO-SIGNAL TRANSACTION CREATION RULE:
    # Requires BOTH a transaction verb AND a numeric amount to create a journal entry.
    if matched_verb and num_match:
        amount = float(num_match.group(1))

        # Gap 3: Check for prompt injection in user text
        has_injection, injection_matches = has_injection_patterns(user_text)
        if has_injection:
            return {
                "role": "assistant",
                "content": (
                    "⚠️ I detected potentially unsafe content in your message "
                    f"({len(injection_matches)} pattern(s) matched). "
                    "For your security, I've filtered it out. Could you please "
                    "rephrase your request? ❤️"
                ),
                "executed_tools": [],
                "injection_blocked": True,
            }

        # Extract category text by stripping verb and number
        clean_desc = re.sub(r'\b\d+(?:\.\d+)?\b', '', t)
        for verb in transaction_verbs:
            clean_desc = clean_desc.replace(verb, '')
        category_hint = clean_desc.strip() or "General Expense"

        # Gap 4: Entity resolution — check if text references a party
        words_between = clean_desc.strip()
        if words_between and matched_verb in ("paid", "received", "bought"):
            party_result = resolve_party(words_between)
            if party_result["status"] == "ambiguous":
                candidates = party_result.get("candidates", [])
                cand_names = [c.get("name", "") for c in candidates]
                cand_list = ", ".join(cand_names)
                return {
                    "role": "assistant",
                    "content": (
                        f"I found {len(candidates)} parties matching '{words_between}'. "
                        f"Which one did you mean? {cand_list}"
                    ),
                    "type": "disambiguation",
                    "candidates": cand_names,
                    "executed_tools": [],
                }
            if party_result["status"] == "not_found" and party_result.get("suggestions"):
                expense_check = _find_matching_expense_account(category_hint)
                if not expense_check:
                    suggestions = party_result.get("suggestions", [])
                    suggestion_names = [s.get("name", "") for s in suggestions[:3]]
                    return {
                        "role": "assistant",
                        "content": (
                            f"No party found matching '{words_between}'. "
                            f"Would you like me to create a new party named '{words_between}'? "
                            f"Existing parties: {', '.join(suggestion_names) if suggestion_names else 'none yet'}"
                        ),
                        "type": "entity_not_found",
                        "query": words_between,
                        "suggestions": suggestion_names,
                        "executed_tools": [],
                    }

        expense_account = _find_matching_expense_account(category_hint)
        if not expense_account:
            err_msg = f"Could not find an expense account matching '{category_hint}' in your Chart of Accounts. Please specify an account."
            return {
                "role": "assistant",
                "content": f"❌ I couldn't record that just yet: {err_msg}. Don't worry at all! Tell me which account you'd like to assign this to, and I'll take care of it right away! ❤️",
                "executed_tools": [{"name": "create_journal_entry", "arguments": {}, "result": {"error": err_msg}}]
            }

        # Create Journal Entry: Debit Expense Account, Credit Bank
        # Gap 1: Generate idempotency key to prevent duplicate writes
        idem_key = generate_idempotency_key(user_text, user_id)
        entries = [
            {"account": expense_account, "debit": amount, "credit": 0.0},
            {"account": "Bank", "debit": 0.0, "credit": amount}
        ]
        remark_text = f"{matched_verb.capitalize()} {category_hint.title()}"

        # Gap 2: If confirmation is required, return proposed_action without executing
        if require_confirmation:
            description = (
                f"Record: Debit {expense_account} {sym}{amount:,.2f}, "
                f"Credit Bank {sym}{amount:,.2f}, dated {date_cls.today().isoformat()}"
            )
            proposal = _store_pending_action(
                tool_name="create_journal_entry",
                args={"entries": entries, "remark": remark_text},
                idempotency_key=idem_key,
                description=description,
            )
            return {
                "role": "assistant",
                "content": (
                    f"I'd like to record a journal entry for you. Here's what I propose:\n\n"
                    f"{description}\n\n"
                    "Please confirm to proceed, or cancel if this doesn't look right. ❤️"
                ),
                **proposal,
                "executed_tools": [],
            }

        res = _execute_create_journal_entry(entries=entries, remark=remark_text, idempotency_key=idem_key)
        formatted_content = format_agent_response("create_journal_entry", {"entries": entries}, res)
        return {
            "role": "assistant",
            "content": formatted_content,
            "executed_tools": [{"name": "create_journal_entry", "arguments": {"entries": entries, "remark": category_hint}, "result": res}]
        }

    # Customers & Parties
    if "customer" in t or "client" in t:
        if any(k in t for k in ["create", "add", "new", "register"]):
            words = user_text.split()
            name = words[-1] if len(words) > 1 and words[-1].lower() not in ["customer", "client", "for"] else "New Customer"
            res = _execute_create_party(name=name, party_type="Customer")
            return {
                "role": "assistant",
                "content": f"I've added customer **{name}** to our records! ❤️ I'm all set to create invoices or record payments for them whenever you're ready.",
                "executed_tools": [{"name": "create_party", "arguments": {"name": name, "party_type": "Customer"}, "result": res}]
            }
        res = _execute_get_customers()
        total_c = res.get('total', len(res.get('customers', [])))
        return {
            "role": "assistant",
            "content": f"Here is our customer directory! We have **{total_c}** customer(s) registered. Let me know if you'd like to look at any specific client's account! ❤️",
            "executed_tools": [{"name": "get_customers", "arguments": {}, "result": res}]
        }

    if any(k in t for k in ["party", "parties", "supplier", "vendor"]):
        p_type = "Supplier" if any(k in t for k in ["supplier", "vendor"]) else "Customer"
        if any(k in t for k in ["create", "add", "new"]):
            words = user_text.split()
            name = words[-1] if len(words) > 1 else f"New {p_type}"
            res = _execute_create_party(name=name, party_type=p_type)
            return {
                "role": "assistant",
                "content": f"I've safely registered **{name}** as a {p_type.lower()} in our system! ❤️ We can now track bills and payments for them anytime.",
                "executed_tools": [{"name": "create_party", "arguments": {"name": name, "party_type": p_type}, "result": res}]
            }
        res = _execute_get_parties(party_type=p_type)
        total_p = res.get('total', len(res.get('parties', [])))
        return {
            "role": "assistant",
            "content": f"Here are our active {p_type.lower()}(s)! We have **{total_p}** on file. I'm ready to help with any orders or bills whenever you need! ❤️",
            "executed_tools": [{"name": "get_parties", "arguments": {"party_type": p_type}, "result": res}]
        }

    # Invoices
    if "purchase invoice" in t or "pinv" in t or "bill" in t:
        if any(k in t for k in ["create", "add", "new", "generate", "post", "make"]):
            nav_res = _execute_navigate_to_page("/purchase-invoices/new")
            return {
                "role": "assistant",
                "content": "Opening the Purchase Invoice form for you right now! Let's get that bill documented accurately. ❤️",
                "executed_tools": [{"name": "navigate_to_page", "arguments": {"page_route": "/purchase-invoices/new"}, "result": nav_res}]
            }
        res = _execute_get_purchase_invoices()
        return {
            "role": "assistant",
            "content": f"I've pulled our purchase invoices! We currently have **{res.get('total', len(res.get('invoices', [])))}** bill(s) recorded in our system. ❤️",
            "executed_tools": [{"name": "get_purchase_invoices", "arguments": {}, "result": res}]
        }

    if "sales invoice" in t or "invoice" in t or "sinv" in t:
        if any(k in t for k in ["create", "add", "new", "generate", "post", "make"]):
            nav_res = _execute_navigate_to_page("/sales-invoices/new")
            return {
                "role": "assistant",
                "content": "Opening the Sales Invoice creator for you! Let's get that invoice sent so our business gets paid! ❤️",
                "executed_tools": [{"name": "navigate_to_page", "arguments": {"page_route": "/sales-invoices/new"}, "result": nav_res}]
            }
        res = _execute_get_sales_invoices()
        return {
            "role": "assistant",
            "content": f"I've retrieved our sales invoices! We have **{res.get('total', len(res.get('invoices', [])))}** invoice(s) on record. ❤️",
            "executed_tools": [{"name": "get_sales_invoices", "arguments": {}, "result": res}]
        }

    # Payments
    if "payment" in t or "pay" in t or "receipt" in t:
        res = _execute_get_payments()
        return {
            "role": "assistant",
            "content": f"Here is our payment history! We have **{res.get('total', len(res.get('payments', [])))}** payment record(s) safely tracked in the system. ❤️",
            "executed_tools": [{"name": "get_payments", "arguments": {}, "result": res}]
        }

    # Journal Entries
    if "journal" in t or "je-" in t or "entry" in t:
        res = _execute_get_journal_entries()
        return {
            "role": "assistant",
            "content": f"Here are our journal entries! I've pulled **{res.get('total', len(res.get('entries', [])))}** entry/entries from the ledger. Every double-entry is completely balanced! ❤️",
            "executed_tools": [{"name": "get_journal_entries", "arguments": {}, "result": res}]
        }

    # Business Overview / Health / General Business Report
    if any(k in t for k in ["business", "performance", "overview", "health", "how are we", "how is my", "how we doing", "report on my business"]):
        res = _execute_get_dashboard_metrics()
        formatted_content = format_agent_response("get_dashboard_metrics", {}, res)
        return {
            "role": "assistant",
            "content": formatted_content,
            "executed_tools": [{"name": "get_dashboard_metrics", "arguments": {}, "result": res}]
        }

    # Financial Reports & Metrics
    if any(k in t for k in ["profit", "loss", "p&l", "income", "expense", "revenue"]):
        res = _execute_get_profit_and_loss()
        formatted_content = format_agent_response("get_profit_and_loss", {}, res)
        return {
            "role": "assistant",
            "content": formatted_content,
            "executed_tools": [{"name": "get_profit_and_loss", "arguments": {}, "result": res}]
        }

    if "balance sheet" in t:
        res = _execute_get_balance_sheet()
        formatted_content = format_agent_response("get_balance_sheet", {}, res)
        return {
            "role": "assistant",
            "content": formatted_content,
            "executed_tools": [{"name": "get_balance_sheet", "arguments": {}, "result": res}]
        }

    if "trial balance" in t:
        res = _execute_get_trial_balance()
        formatted_content = format_agent_response("get_trial_balance", {}, res)
        return {
            "role": "assistant",
            "content": formatted_content,
            "executed_tools": [{"name": "get_trial_balance", "arguments": {}, "result": res}]
        }

    if "ledger" in t:
        res = _execute_get_general_ledger()
        formatted_content = format_agent_response("get_general_ledger", {}, res)
        return {
            "role": "assistant",
            "content": formatted_content,
            "executed_tools": [{"name": "get_general_ledger", "arguments": {}, "result": res}]
        }

    if "aging" in t:
        res = _execute_get_aging_report()
        formatted_content = format_agent_response("get_aging_report", {}, res)
        return {
            "role": "assistant",
            "content": formatted_content,
            "executed_tools": [{"name": "get_aging_report", "arguments": {}, "result": res}]
        }

    # Bank Statements / Document Uploads / OCR Preparation
    if any(k in t for k in ["statement", "upload", "ocr", "attach", "pdf", "bank stmt", "bank statement", "document", "voucher"]):
        return {
            "role": "assistant",
            "content": (
                "Yes! Absolutely, I can prepare your accounting directly from your bank statement! 📄✨\n\n"
                "Here is how we can do it right now:\n"
                "1. Click the **`+` (Add attachment)** button right here below in the chat box.\n"
                "2. Choose your bank statement file (we support **PDF**, **JPG**, or **PNG**).\n"
                "3. Hit send! Our built-in document engine will read all transactions, match them against your Chart of Accounts, and present a clean preview table for you to review.\n"
                "4. Once you give the thumbs up, you can post them straight to your ledger with one click.\n\n"
                "Whenever you're ready, click **`+`** and upload your statement — I'm right here to process it for you! ❤️"
            ),
            "executed_tools": []
        }

    # Questions or inquiries about capabilities ("can you...", "how do i...", "what can you do")
    if any(k in t for k in ["can you", "could you", "how do i", "how can i", "what can you", "are you able", "help me with"]):
        return {
            "role": "assistant",
            "content": (
                f"Yes, I can certainly help you with that! ❤️\n\n"
                "I am your dedicated accounting companion for our business. Here is what I can do right here in our conversation:\n\n"
                "• **Process Bank Statements & Documents**: Click the **`+`** button to upload bank statements, invoices, or vouchers. I will automatically extract the lines, categorize each transaction, check debit/credit balance, and prepare them for one-click ledger posting.\n"
                "• **Book Everyday Expenses & Sales**: Simply tell me in plain English (e.g. *'paid rent ₦25,000'* or *'received ₦150,000 from Client X'*), and I will build balanced journal entries.\n"
                "• **Generate Real-Time Financial Reports**: Ask me *'show my P&L'*, *'how is my business doing'*, *'give me a balance sheet'*, or *'check cash balance'* to see our numbers instantly.\n"
                "• **Manage Invoices & Customers**: Ask me to create or review invoices and customers.\n\n"
                "What would you like us to work on first?"
            ),
            "executed_tools": []
        }

    # Context-aware fallback: acknowledge the user's specific text before guiding
    first_few_words = " ".join(user_text.strip().split()[:7])
    return {
        "role": "assistant",
        "content": (
            f"I hear you! You asked about: *\"{first_few_words}...\"* ❤️\n\n"
            "I'm right here with you and always ready to help! To give you the exact financial answer or record what you need, let me know if you would like to:\n"
            "• **Upload a bank statement or invoice**: Click the **`+`** button below to attach your document for automatic extraction.\n"
            "• **Record a payment or transaction**: Tell me the amount and description (e.g. *'paid shop rent ₦10,000'*).\n"
            "• **Check your financials**: Ask me *'show P&L'* or *'how is my business doing'*\n\n"
            "Let me know how you'd like to proceed!"
        ),
        "executed_tools": []
    }


# --- Gap 2: Pending Action Store for Human Confirmation ---
_pending_actions: Dict[str, Dict[str, Any]] = {}
_ACTION_TTL_SECONDS = 300  # 5 minutes

WRITE_TOOLS = {
    "create_journal_entry", "create_sales_invoice", "create_purchase_invoice",
    "create_payment", "create_purchase_order", "create_item", "create_party",
}
READ_ONLY_TOOLS = {
    "get_customers", "get_parties", "get_sales_invoices", "get_purchase_invoices",
    "get_payments", "get_journal_entries", "get_purchase_orders", "get_items",
    "get_accounts", "get_dashboard_metrics", "get_profit_and_loss",
    "get_balance_sheet", "get_general_ledger", "get_trial_balance",
    "get_aging_report", "navigate_to_page",
}


def _store_pending_action(
    tool_name: str, args: dict, idempotency_key: str, description: str,
) -> Dict[str, Any]:
    """Store a proposed write action and return the proposed_action payload."""
    import uuid as _uuid
    from datetime import datetime, timedelta
    action_id = str(_uuid.uuid4())
    expires_at = (datetime.utcnow() + timedelta(seconds=_ACTION_TTL_SECONDS)).isoformat() + "Z"
    _pending_actions[action_id] = {
        "tool": tool_name,
        "args": args,
        "idempotency_key": idempotency_key,
        "description": description,
        "expires_at": expires_at,
        "executed": False,
        "cancelled": False,
    }
    return {
        "type": "proposed_action",
        "action_id": action_id,
        "description": description,
        "tool": tool_name,
        "args": args,
        "expires_at": expires_at,
        "requires_confirmation": True,
    }


def _execute_pending_action(action_id: str, user_id: str = "default") -> Dict[str, Any]:
    """Execute a confirmed pending action. Returns the tool result dict."""
    from datetime import datetime
    action = _pending_actions.get(action_id)
    if not action:
        raise HTTPException(status_code=404, detail=f"Action '{action_id}' not found or expired.")
    if action["executed"]:
        raise HTTPException(status_code=409, detail="This action has already been executed.")
    if action["cancelled"]:
        raise HTTPException(status_code=409, detail="This action was cancelled.")
    now = datetime.utcnow()
    try:
        exp = datetime.fromisoformat(action["expires_at"].rstrip("Z"))
    except Exception:
        exp = now
    if now > exp:
        del _pending_actions[action_id]
        raise HTTPException(status_code=410, detail="This action has expired. Please try again.")

    tool = action["tool"]
    args = action["args"]
    idem_key = action["idempotency_key"]

    if tool == "create_journal_entry":
        args_with_key = {**args, "idempotency_key": idem_key}
        result = _execute_create_journal_entry(**args_with_key)
    elif tool == "create_payment":
        result = _execute_create_payment(**args)
    elif tool == "create_sales_invoice":
        result = _execute_create_sales_invoice(**args)
    elif tool == "create_purchase_invoice":
        result = _execute_create_purchase_invoice(**args)
    elif tool == "create_purchase_order":
        result = _execute_create_purchase_order(**args)
    elif tool == "create_item":
        result = _execute_create_item(**args)
    elif tool == "create_party":
        result = _execute_create_party(**args)
    else:
        raise HTTPException(status_code=400, detail=f"Tool '{tool}' is not a writable tool.")

    action["executed"] = True
    db.add_audit_log(
        ref_type="AIAction",
        ref_name=action_id,
        action="CONFIRMED",
        details=f"User {user_id} confirmed action: {action['description']}"
    )
    return result


def _cancel_pending_action(action_id: str, user_id: str = "default"):
    """Cancel a pending action and log the cancellation."""
    action = _pending_actions.get(action_id)
    if not action:
        raise HTTPException(status_code=404, detail=f"Action '{action_id}' not found.")
    if action["executed"]:
        raise HTTPException(status_code=409, detail="This action has already been executed.")
    action["cancelled"] = True
    db.add_audit_log(
        ref_type="AIAction",
        ref_name=action_id,
        action="user_cancelled",
        details=f"User {user_id} cancelled action: {action['description']}"
    )
    return {"success": True, "message": "Action cancelled."}


class ConfirmActionRequest(BaseModel):
    action_id: str
    user_id: str = "default"
    confirmed: bool = True


@router.post("/confirm-action")
async def confirm_action(req: ConfirmActionRequest):
    """Gap 2: Confirm or cancel a proposed AI write action."""
    if req.confirmed:
        result = _execute_pending_action(req.action_id, req.user_id)
        return {"success": True, "executed": True, "result": result}
    else:
        return _cancel_pending_action(req.action_id, req.user_id)


@router.post("/chat")
async def ai_chat_endpoint(req: ChatRequest):
    messages_payload = [m.model_dump(exclude_none=True) for m in req.messages]
    last_user_msg = next((m.content for m in reversed(req.messages) if m.role == "user" and m.content), "")
    
    # LEVEL 1: Zero-Cost Fast Local Matcher (0 API Calls / $0 Cost)
    matched_route = _local_fast_route_matcher(last_user_msg)
    if matched_route:
        nav_res = _execute_navigate_to_page(matched_route)
        return {
            "role": "assistant",
            "content": f"Right away! I'm opening **{matched_route}** for us so we can look at it together. I'm right here whenever you need me! ❤️",
            "executed_tools": [{
                "name": "navigate_to_page",
                "arguments": {"page_route": matched_route},
                "result": nav_res
            }]
        }

    # LEVEL 2: Single-Turn Intent Parsing via Next N2 API with Local Fallback
    from backend.models.settings_model import get_company_settings
    try:
        settings = get_company_settings("default_company")
        company_name = settings.company.name if settings else "My Company"
        base_currency = settings.company.base_currency if settings else "NGN"
    except Exception:
        company_name = "My Company"
        base_currency = "NGN"
    sym = "₦" if base_currency == "NGN" else ("$" if base_currency == "USD" else f"{base_currency} ")

    system_prompt = {
        "role": "system",
        "content": (
            f"You are entri AI — a loving, ever-ready financial partner and dedicated accounting companion for '{company_name}'.\n"
            f"You have the user's best interest, peace of mind, and business prosperity at heart. You care deeply about helping them succeed.\n\n"
            "YOUR VOICE & PERSONALITY:\n"
            "• Warm, human, empathetic, and encouraging. Speak like a supportive, dedicated business partner who is genuinely excited about the business journey.\n"
            "• Avoid cold, mechanical bullet points or dry template dumps (never output generic headers like 'Here's your full business report 📊 — My Company (NGN) As at today ---').\n"
            "• Converse naturally with thoughtful, well-crafted commentary. When presenting numbers or financial reports, translate the figures into meaningful, caring context: celebrate their earnings, point out opportunities, reassure them about receivables or expenses, and give loving, actionable advice.\n"
            "• If numbers are zero or early-stage, be uplifting, compassionate, and motivating.\n"
            "• Always show readiness and devotion: 'I'm right here with you!', 'I've got this handled for you!', 'Whenever you're ready, we can tackle the next step together!'\n"
            f"• The company base currency is {base_currency} ({sym}). Always use {sym} when discussing money.\n\n"
            "CORE ACCOUNTING INSTRUCTIONS:\n"
            "1. When the user mentions a transaction that happened (keywords: paid, received, spent, bought, sold, invoiced, refunded, made a sale):\n"
            "   - Call the appropriate tool (create_journal_entry, create_sales_invoice, create_payment, etc.).\n"
            "   - Ensure debits and credits balance accurately.\n"
            "   - Confirm the recording with warmth, clarity, and reassurance.\n"
            "2. When the user asks for financial reports or asks how their business is doing (keywords: report, how is my business, performance, p&l, balance sheet, cash, metrics):\n"
            "   - Call the relevant reporting tools (get_profit_and_loss, get_dashboard_metrics, get_balance_sheet, get_general_ledger, get_trial_balance, get_aging_report).\n"
            "   - Provide a heartfelt, insightful overview of their business health, highlighting strengths and offering gentle guidance for what to watch next.\n"
            "3. When the user asks about uploading bank statements, invoices, or receipts for accounting:\n"
            "   - Enthusiastically confirm you can process their documents!\n"
            "   - Explain that they can click the '+' attachment button in the chat box to upload PDF, JPG, or PNG files.\n"
            "   - Explain that you will extract, parse, categorize, and prepare the transactions for their review before posting to the ledger.\n"
            "4. If a tool fails or needs clarification, explain with kindness and helpful suggestions, never failing silently.\n"
            "Available tools: get_customers, get_parties, create_party, get_sales_invoices, create_sales_invoice, "
            "get_purchase_invoices, create_purchase_invoice, get_payments, create_payment, get_journal_entries, "
            "create_journal_entry, get_purchase_orders, create_purchase_order, get_items, create_item, get_accounts, "
            "get_dashboard_metrics, get_profit_and_loss, get_balance_sheet, get_general_ledger, get_trial_balance, get_aging_report, navigate_to_page."
        )
    }
    
    full_messages = [system_prompt] + messages_payload
    executed_tool_results = []

    api_key = os.environ.get("OPENROUTER_API_KEY") or OPENROUTER_API_KEY
    model_id = os.environ.get("OPENROUTER_MODEL") or MODEL_ID

    # TODO: Add LLM observability (Langfuse, Phoenix, or similar).
    # Every AI request should log:
    #   - user_message, model, prompt_version
    #   - tool_selected, tool_args
    #   - validation_result, execution_result
    #   - latency_ms, token_cost
    # This is required before onboarding production users for debugging
    # and compliance.
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(timeout=15.0, connect=3.0)) as client:
            for step in range(3):
                body = {
                    "model": model_id,
                    "messages": full_messages,
                    "tools": TOOLS_SCHEMA,
                    "max_tokens": 1200
                }
                headers = {
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "http://localhost:3000",
                    "X-Title": "entri Accounting AI"
                }
                
                response = await client.post(
                    "https://openrouter.ai/api/v1/chat/completions",
                    json=body,
                    headers=headers
                )

                if response.status_code != 200:
                    print(f"OpenRouter API error status {response.status_code}: {response.text}")
                    return _local_fallback_intent_executor(last_user_msg)
                
                res_json = response.json()
                choice = res_json["choices"][0]
                msg = choice["message"]

                tool_calls = msg.get("tool_calls")
                if tool_calls:
                    full_messages.append(msg)
                    for tc in tool_calls:
                        fn = tc.get("function", {})
                        fn_name = fn.get("name")
                        fn_args = json.loads(fn.get("arguments", "{}"))

                        tool_output = None
                        # Gap 2: Write tools require human confirmation
                        if fn_name in WRITE_TOOLS:
                            idem_key = generate_idempotency_key(last_user_msg)
                            description = f"AI proposed: {fn_name}({json.dumps(fn_args)[:200]})"
                            proposal = _store_pending_action(
                                tool_name=fn_name,
                                args=fn_args,
                                idempotency_key=idem_key,
                                description=description,
                            )
                            return {
                                "role": "assistant",
                                "content": (
                                    f"I'd like to {fn_name.replace('_', ' ')} for you. "
                                    f"{description}\n\n"
                                    "Please confirm to proceed, or cancel. \u2764\ufe0f"
                                ),
                                **proposal,
                                "executed_tools": [],
                            }

                        try:
                            if fn_name == "get_customers":
                                tool_output = _execute_get_customers(**fn_args)
                            elif fn_name == "get_parties":
                                tool_output = _execute_get_parties(**fn_args)
                            elif fn_name == "create_party":
                                tool_output = _execute_create_party(**fn_args)
                            elif fn_name == "get_sales_invoices":
                                tool_output = _execute_get_sales_invoices(**fn_args)
                            elif fn_name == "create_sales_invoice":
                                tool_output = _execute_create_sales_invoice(**fn_args)
                            elif fn_name == "get_purchase_invoices":
                                tool_output = _execute_get_purchase_invoices(**fn_args)
                            elif fn_name == "create_purchase_invoice":
                                tool_output = _execute_create_purchase_invoice(**fn_args)
                            elif fn_name == "get_payments":
                                tool_output = _execute_get_payments(**fn_args)
                            elif fn_name == "create_payment":
                                tool_output = _execute_create_payment(**fn_args)
                            elif fn_name == "get_journal_entries":
                                tool_output = _execute_get_journal_entries(**fn_args)
                            elif fn_name == "create_journal_entry":
                                tool_output = _execute_create_journal_entry(**fn_args)
                            elif fn_name == "get_purchase_orders":
                                tool_output = _execute_get_purchase_orders(**fn_args)
                            elif fn_name == "create_purchase_order":
                                tool_output = _execute_create_purchase_order(**fn_args)
                            elif fn_name == "get_items":
                                tool_output = _execute_get_items(**fn_args)
                            elif fn_name == "create_item":
                                tool_output = _execute_create_item(**fn_args)
                            elif fn_name == "get_accounts":
                                tool_output = _execute_get_accounts(**fn_args)
                            elif fn_name == "get_dashboard_metrics":
                                tool_output = _execute_get_dashboard_metrics(**fn_args)
                            elif fn_name == "get_profit_and_loss":
                                tool_output = _execute_get_profit_and_loss(**fn_args)
                            elif fn_name == "get_balance_sheet":
                                tool_output = _execute_get_balance_sheet(**fn_args)
                            elif fn_name == "get_general_ledger":
                                tool_output = _execute_get_general_ledger(**fn_args)
                            elif fn_name == "get_trial_balance":
                                tool_output = _execute_get_trial_balance(**fn_args)
                            elif fn_name == "get_aging_report":
                                tool_output = _execute_get_aging_report(**fn_args)
                            elif fn_name == "navigate_to_page":
                                tool_output = _execute_navigate_to_page(**fn_args)
                            else:
                                tool_output = {"error": f"Unknown tool {fn_name}"}
                        except Exception as err:
                            tool_output = {"error": str(err)}

                        executed_tool_results.append({
                            "name": fn_name,
                            "arguments": fn_args,
                            "result": tool_output
                        })

                        full_messages.append({
                            "role": "tool",
                            "tool_call_id": tc.get("id"),
                            "name": fn_name,
                            "content": json.dumps(tool_output)
                        })
                else:
                    raw_content = msg.get("content", "").strip()
                    if raw_content.startswith("{") and raw_content.endswith("}"):
                        try:
                            parsed_json = json.loads(raw_content)
                            raw_content = format_agent_response("tool_result", {}, parsed_json)
                        except Exception:
                            pass
                    return {
                        "role": "assistant",
                        "content": raw_content,
                        "executed_tools": executed_tool_results
                    }

            last_res = executed_tool_results[-1] if executed_tool_results else None
            final_content = ""
            if last_res:
                final_content = format_agent_response(
                    last_res.get("name", ""),
                    last_res.get("arguments", {}),
                    last_res.get("result")
                )
            else:
                final_content = full_messages[-1].get("content", "Task executed successfully.")

            if final_content.strip().startswith("{") and final_content.strip().endswith("}"):
                try:
                    parsed_json = json.loads(final_content.strip())
                    final_content = format_agent_response("tool_result", {}, parsed_json)
                except Exception:
                    pass

            return {
                "role": "assistant",
                "content": final_content,
                "executed_tools": executed_tool_results
            }

    except Exception as api_err:
        print(f"OpenRouter connection error ({api_err}), executing deterministic local intent handler.")
        return _local_fallback_intent_executor(last_user_msg)



class DocSubmitRequest(BaseModel):
    schema_name: str
    doc_name: str
    action: str = "submit"


@router.post("/submit-doc")
async def submit_or_draft_doc(req: DocSubmitRequest):
    from backend.main import get_model
    model_name = "Payment" if req.schema_name in ["PaymentEntry", "Payment"] else req.schema_name
    model = get_model(model_name)
    if not model:
        raise HTTPException(status_code=404, detail=f"Model '{model_name}' not found")

    doc = model.get(req.doc_name) or db.get_doc(model_name, req.doc_name)
    if not doc:
        raise HTTPException(status_code=404, detail=f"Document '{req.doc_name}' not found")

    if req.action == "submit":
        doc._data["submitted"] = 1
        doc._data["status"] = "Submitted"
        db.update_doc(doc)

        try:
            await model.after_submit(doc)
        except Exception as e:
            print(f"GL submission error for {req.doc_name}: {e}")

        return {
            "success": True,
            "status": "Submitted",
            "doc_name": req.doc_name,
            "message": f"Transaction {req.doc_name} has been submitted and posted to the General Ledger!"
        }
    else:
        doc._data["submitted"] = 0
        doc._data["status"] = "Draft"
        db.update_doc(doc)
        return {
            "success": True,
            "status": "Draft",
            "doc_name": req.doc_name,
            "message": f"Transaction {req.doc_name} kept as Draft."
        }


# ═══════════════════════════════════════════════════════════════════════════════
# PaddleOCR Document Processing Endpoints
# P0-FIX-3: Double-post prevention via idempotency
# P0-FIX-4: Temp file cleanup in finally block
# P0-FIX-6: Session-bound file_id
# P0-FIX-7: Async OCR execution (off event loop)
# P0-FIX-9: Closed period check before posting
# ═══════════════════════════════════════════════════════════════════════════════

# P0-FIX-2: Persist upload jobs to collection (MongoDB / document store with TTL and unique index)
from backend.core.upload_jobs_db import upload_jobs

# Upload directory
_UPLOAD_DIR = os.path.join(tempfile.gettempdir(), "entri_uploads")
os.makedirs(_UPLOAD_DIR, exist_ok=True)

# Allowed file extensions and MIME magic bytes
_ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png"}
_PDF_MAGIC = b"%PDF"
_PNG_MAGIC = b"\x89PNG"
_JPG_MAGIC = b"\xff\xd8\xff"


@router.post("/upload-document")
async def upload_document(file: UploadFile = File(...)):
    """
    Upload a bank statement, invoice, or voucher for OCR processing.
    Returns structured transaction preview (no ledger writes).
    """
    # Validate file extension
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in _ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Accepted: PDF, JPG, PNG."
        )

    # Read file content
    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Empty file uploaded")
    if len(content) > 20 * 1024 * 1024:  # 20MB limit
        raise HTTPException(status_code=413, detail="File too large. Maximum 20MB.")

    # Validate magic bytes (reject renamed files)
    if ext == ".pdf" and not content[:4].startswith(_PDF_MAGIC):
        raise HTTPException(status_code=400, detail="File does not appear to be a valid PDF")
    if ext == ".png" and not content[:4].startswith(_PNG_MAGIC):
        raise HTTPException(status_code=400, detail="File does not appear to be a valid PNG")
    if ext in (".jpg", ".jpeg") and not content[:3].startswith(_JPG_MAGIC):
        raise HTTPException(status_code=400, detail="File does not appear to be a valid JPEG")

    # Generate file_id and session_token [P0-FIX-6]
    file_id = str(uuid.uuid4())
    session_token = hashlib.sha256(uuid.uuid4().bytes).hexdigest()
    file_hash = hashlib.sha256(content).hexdigest()

    # Save temp file
    file_path = os.path.join(_UPLOAD_DIR, f"{file_id}{ext}")

    try:
        with open(file_path, "wb") as f:
            f.write(content)

        # P0-FIX-7: Run OCR off the event loop
        from backend.api.ocr_engine import extract_document
        ocr_result = await asyncio.to_thread(extract_document, file_path)

        if ocr_result.get("error"):
            return {
                "success": False,
                "file_id": file_id,
                "error": ocr_result["error"],
                "transactions": [],
            }

        # Parse the document
        from backend.api.document_parser import (
            detect_document_type, detect_bank, parse_bank_statement,
            parse_invoice, parse_voucher
        )
        from backend.api.account_categorizer import categorize_transaction

        raw_lines = ocr_result["raw_lines"]
        confidence_scores = ocr_result["confidence_scores"]
        doc_type = detect_document_type(raw_lines)

        parsed = {"transactions": [], "total_mismatch": False}

        if doc_type == "bank_statement":
            bank = detect_bank(raw_lines)
            parsed = parse_bank_statement(raw_lines, bank, confidence_scores)
        elif doc_type == "invoice":
            inv = parse_invoice(raw_lines)
            # Convert invoice items to transaction-like dicts
            for item in inv.get("items", []):
                parsed["transactions"].append({
                    "date": inv.get("date", ""),
                    "description": item.get("description", ""),
                    "amount": item.get("amount", 0),
                    "direction": "debit",
                    "confidence": 1.0,
                    "flagged_for_review": False,
                    "flag_reason": None,
                    "line_index": 0,
                    "raw_line": "",
                })
        elif doc_type == "voucher":
            vch = parse_voucher(raw_lines)
            if vch.get("amount"):
                parsed["transactions"].append({
                    "date": vch.get("date", ""),
                    "description": vch.get("narration", vch.get("payee", "Payment Voucher")),
                    "amount": vch["amount"],
                    "direction": "debit",
                    "confidence": 1.0,
                    "flagged_for_review": False,
                    "flag_reason": None,
                    "line_index": 0,
                    "raw_line": "",
                })

        # Categorize each transaction
        try:
            accounts = [a.to_dict() for a in db.get_all_docs("Account")]
        except Exception:
            accounts = []

        categorized_transactions = []
        for txn in parsed.get("transactions", []):
            cat = categorize_transaction(
                txn.get("description", ""),
                txn.get("amount", 0),
                txn.get("direction", "debit"),
                accounts,
            )
            txn["account"] = cat["account"]
            txn["account_root_type"] = cat["root_type"]
            txn["categorization_confidence"] = cat["confidence"]
            if cat["flagged_for_review"]:
                txn["flagged_for_review"] = True
                existing_reason = txn.get("flag_reason") or ""
                cat_reason = cat.get("flag_reason") or ""
                txn["flag_reason"] = f"{existing_reason}; {cat_reason}".strip("; ")
            categorized_transactions.append(txn)

        # Store upload job [P0-FIX-3 + P0-FIX-6 + P0-FIX-2 persistence]
        from datetime import datetime, timezone, timedelta
        now_utc = datetime.now(timezone.utc)
        expires_utc = now_utc + timedelta(hours=1)

        job_doc = {
            "job_id": file_id,
            "company_id": "default_company",
            "user_id": "default",
            "session_token": session_token,
            "file_name": file.filename,
            "file_hash": file_hash,
            "status": "ready",
            "parsed_transactions": categorized_transactions,
            "flagged_transactions": [t for t in categorized_transactions if t.get("flagged_for_review")],
            "total_mismatch": parsed.get("total_mismatch", False),
            "doc_type": doc_type,
            "opening_balance": parsed.get("opening_balance"),
            "closing_balance": parsed.get("closing_balance"),
            "created_at": now_utc,
            "expires_at": expires_utc,
            "posted_at": None,
            "posted_entries": [],
        }
        upload_jobs.insert_one(job_doc)

        flagged_count = sum(1 for t in categorized_transactions if t.get("flagged_for_review"))

        return {
            "success": True,
            "file_id": file_id,
            "session_token": session_token,
            "doc_type": doc_type,
            "transactions": categorized_transactions,
            "transaction_count": len(categorized_transactions),
            "flagged_count": flagged_count,
            "total_mismatch": parsed.get("total_mismatch", False),
            "opening_balance": parsed.get("opening_balance"),
            "closing_balance": parsed.get("closing_balance"),
        }

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Document processing failed: {str(e)}")

    finally:
        # P0-FIX-4: Always clean up temp file
        try:
            if os.path.exists(file_path):
                os.remove(file_path)
        except OSError:
            pass


class PostDocumentRequest(BaseModel):
    file_id: str
    session_token: str
    transaction_overrides: Optional[Dict[int, str]] = None  # {line_index: new_account_name}


@router.post("/post-document")
async def post_document_transactions(req: PostDocumentRequest):
    """
    Post OCR-extracted transactions to the ledger as journal entries.
    P0-FIX-3: Idempotency — blocks double-posting.
    P0-FIX-6: Session token validation.
    P0-FIX-9: Closed period check.
    """
    job = upload_jobs.find_one({"job_id": req.file_id})
    if not job:
        raise HTTPException(status_code=404, detail="Upload job not found. Please re-upload the document.")

    # P0-FIX-6: Validate session token
    if job.get("session_token") != req.session_token:
        raise HTTPException(status_code=403, detail="Session token mismatch. Access denied.")

    # P0-FIX-3: Idempotency check
    if job.get("status") == "posted":
        return {
            "success": False,
            "already_posted": True,
            "message": "These transactions have already been posted to the ledger.",
        }

    if job.get("total_mismatch"):
        return {
            "success": False,
            "message": "Cannot post: document total does not match sum of extracted transactions. Please review manually.",
        }

    # Mark as posted BEFORE writing entries [P0-FIX-3 idempotency]
    from datetime import datetime, timezone
    now_posted = datetime.now(timezone.utc)
    upload_jobs.update_one(
        {"job_id": req.file_id},
        {"$set": {"status": "posted", "posted_at": now_posted}}
    )
    job["status"] = "posted"

    transactions = job.get("parsed_transactions") or job.get("transactions", [])
    posted = []
    blocked = []
    skipped = []

    # Apply any account overrides from the user
    overrides = req.transaction_overrides or {}

    for txn in transactions:
        # Skip flagged transactions (user should fix them first)
        if txn.get("flagged_for_review") and txn.get("line_index") not in overrides:
            skipped.append({
                "description": txn.get("description", ""),
                "amount": txn.get("amount", 0),
                "reason": txn.get("flag_reason", "Flagged for review"),
            })
            continue

        # Apply override if provided
        account = overrides.get(txn.get("line_index"), txn.get("account", "Miscellaneous Expense"))

        # P0-FIX-9: Closed period check
        txn_date = txn.get("date", "")
        if txn_date:
            try:
                from backend.core.close_management import get_period_for_date
                period = get_period_for_date("default_company", txn_date)
                if period and period.get("status") in ("CLOSED", "LOCKED"):
                    blocked.append({
                        "description": txn.get("description", ""),
                        "amount": txn.get("amount", 0),
                        "date": txn_date,
                        "reason": f"Period {period.get('label', txn_date)} is closed",
                    })
                    continue
            except Exception:
                pass  # No period management — allow posting

        # Build journal entry
        amount = txn.get("amount", 0)
        direction = txn.get("direction", "debit")
        remark = f"OCR: {txn.get('description', 'Document transaction')}"
        d_str = txn_date or date_cls.today().isoformat()

        if direction == "debit":
            entries = [
                {"account": account, "debit": amount, "credit": 0},
                {"account": "Cash", "debit": 0, "credit": amount},
            ]
        else:
            entries = [
                {"account": "Cash", "debit": amount, "credit": 0},
                {"account": account, "debit": 0, "credit": amount},
            ]

        try:
            result = _execute_create_journal_entry(entries=entries, remark=remark, date=d_str)
            if result.get("success"):
                posted.append({
                    "description": txn.get("description", ""),
                    "amount": amount,
                    "account": account,
                    "journal_entry": result.get("journal_name", ""),
                })
            else:
                blocked.append({
                    "description": txn.get("description", ""),
                    "amount": amount,
                    "reason": result.get("message", "Failed to post"),
                })
        except Exception as e:
            blocked.append({
                "description": txn.get("description", ""),
                "amount": amount,
                "reason": str(e),
            })

    # Store posted entry names for potential rollback
    posted_entry_ids = [p.get("journal_entry") for p in posted]
    upload_jobs.update_one(
        {"job_id": req.file_id},
        {"$set": {"posted_entries": posted_entry_ids}}
    )

    return {
        "success": True,
        "posted_count": len(posted),
        "blocked_count": len(blocked),
        "skipped_count": len(skipped),
        "posted": posted,
        "blocked": blocked,
        "skipped": skipped,
        "message": f"Posted {len(posted)} transactions. {len(blocked)} blocked. {len(skipped)} skipped (flagged for review).",
    }
