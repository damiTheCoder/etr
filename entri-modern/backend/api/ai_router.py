"""
AI Agentic Accounting Router for FastAPI
Provides natural-language control over entri accounting operations.
Connects securely to OpenRouter API (Next N2 Pro model) server-side.
"""
import os
import json
import httpx
from datetime import date as date_cls
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.core import database as db
from backend.core.schema_engine import Doc

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

def _execute_create_sales_invoice(customer: str, items: list, date: str = None, date_str: str = None):
    d_str = date or date_str or date_cls.today().isoformat()
    _execute_create_party(name=customer, party_type="Customer")

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

    series = db.get_doc("NumberSeries", "SINV-")
    curr = series.get("current", 0) + 1 if series else 1
    if series:
        series.current = curr
        db.update_doc(series)
    inv_name = f"SINV-{curr:05d}"

    inv_doc = Doc("SalesInvoice", {
        "name": inv_name,
        "customer": customer,
        "date": d_str,
        "grandTotal": grand_total,
        "outstandingAmount": grand_total,
        "status": "Submitted",
        "items": formatted_items
    })
    inv_doc._not_inserted = True
    db.insert_doc(inv_doc)

    return {
        "success": True,
        "invoice_name": inv_name,
        "customer": customer,
        "grand_total": grand_total,
        "status": "Submitted",
        "message": f"Sales Invoice {inv_name} created successfully for {customer}."
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

    series = db.get_doc("NumberSeries", "PINV-")
    curr = series.get("current", 0) + 1 if series else 1
    if series:
        series.current = curr
        db.update_doc(series)
    inv_name = f"PINV-{curr:05d}"

    inv_doc = Doc("PurchaseInvoice", {
        "name": inv_name,
        "supplier": supplier,
        "date": d_str,
        "grandTotal": grand_total,
        "outstandingAmount": grand_total,
        "status": "Submitted",
        "items": formatted_items
    })
    inv_doc._not_inserted = True
    db.insert_doc(inv_doc)

    return {
        "success": True,
        "invoice_name": inv_name,
        "supplier": supplier,
        "grand_total": grand_total,
        "status": "Submitted",
        "message": f"Purchase Invoice {inv_name} created successfully from {supplier}."
    }

def _execute_get_payments(party: str = "", limit: int = 10):
    filters = {}
    if party:
        filters["party"] = party
    payments = db.get_all_docs("PaymentEntry", filters=filters if filters else None, order_by="date", order="desc", limit=limit)
    res = [p.to_dict() for p in payments]
    return {"payments": res, "total": len(res)}

def _execute_create_payment(party: str, amount: float, payment_type: str = "Receive", reference: str = ""):
    series = db.get_doc("NumberSeries", "PE-")
    curr = series.get("current", 0) + 1 if series else 1
    if series:
        series.current = curr
        db.update_doc(series)
    pay_name = f"PE-{curr:05d}"

    doc = Doc("PaymentEntry", {
        "name": pay_name,
        "party": party,
        "paymentType": payment_type,
        "paidAmount": amount,
        "date": date_cls.today().isoformat(),
        "referenceNo": reference,
        "status": "Submitted"
    })
    doc._not_inserted = True
    db.insert_doc(doc)

    return {
        "success": True,
        "payment_name": pay_name,
        "party": party,
        "amount": amount,
        "payment_type": payment_type,
        "message": f"Payment entry {pay_name} of ₦{amount:,.2f} recorded for {party}."
    }

def _execute_get_journal_entries(limit: int = 10):
    entries = db.get_all_docs("JournalEntry", order_by="date", order="desc", limit=limit)
    res = [e.to_dict() for e in entries]
    return {"journal_entries": res, "total": len(res)}

def _execute_create_journal_entry(entries: list, remark: str = ""):
    series = db.get_doc("NumberSeries", "JV-")
    curr = series.get("current", 0) + 1 if series else 1
    if series:
        series.current = curr
        db.update_doc(series)
    jv_name = f"JV-{curr:05d}"

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

    doc = Doc("JournalEntry", {
        "name": jv_name,
        "date": date_cls.today().isoformat(),
        "userRemark": remark,
        "totalDebit": total_debit,
        "totalCredit": total_credit,
        "status": "Submitted",
        "accounts": formatted_accounts
    })
    doc._not_inserted = True
    db.insert_doc(doc)

    return {
        "success": True,
        "jv_name": jv_name,
        "total_debit": total_debit,
        "total_credit": total_credit,
        "message": f"Journal Entry {jv_name} posted successfully."
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

    series = db.get_doc("NumberSeries", "PO-")
    curr = series.get("current", 0) + 1 if series else 1
    if series:
        series.current = curr
        db.update_doc(series)
    po_name = f"PO-{curr:05d}"

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
    from backend.main import get_accounts_tree
    return get_accounts_tree()

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
    return general_ledger(account_name=account if account else None)

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
        "parties": "/parties",
        "customers": "/parties",
        "suppliers": "/parties",
        "items": "/items",
        "products": "/items",
        "accounts": "/accounts",
        "settings": "/settings"
    }
    for phrase, route in routes_map.items():
        if t == phrase or t == f"go to {phrase}" or t == f"show {phrase}" or t == f"open {phrase}" or t == f"take me to {phrase}":
            return route
    return None


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
            "content": f"Opening {matched_route}...",
            "executed_tools": [{
                "name": "navigate_to_page",
                "arguments": {"page_route": matched_route},
                "result": nav_res
            }]
        }

    # LEVEL 2: Single-Turn Intent Parsing via Next N2 API (1 API Call max)
    system_prompt = {
        "role": "system",
        "content": (
            "You are entri AI language processor. Your job is ONLY to select the best accounting tool to execute "
            "based on user input. Available tools: get_customers, get_parties, create_party, get_sales_invoices, "
            "create_sales_invoice, get_purchase_invoices, create_purchase_invoice, get_payments, create_payment, "
            "get_journal_entries, create_journal_entry, get_purchase_orders, create_purchase_order, get_items, "
            "create_item, get_accounts, get_dashboard_metrics, get_profit_and_loss, get_balance_sheet, get_general_ledger, "
            "get_trial_balance, get_aging_report, navigate_to_page. "
            "Call the appropriate tool with arguments."
        )
    }
    
    full_messages = [system_prompt] + messages_payload
    executed_tool_results = []

    async with httpx.AsyncClient(timeout=60.0) as client:
        # 1-2 Turn lightweight execution
        for step in range(3):
            body = {
                "model": MODEL_ID,
                "messages": full_messages,
                "tools": TOOLS_SCHEMA,
                "max_tokens": 500
            }
            headers = {
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
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
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"OpenRouter API error: {response.text}"
                )
            
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

                    # Deterministic Local Accounting Execution (0 API calls for logic)
                    tool_output = None
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
                return {
                    "role": "assistant",
                    "content": msg.get("content", ""),
                    "executed_tools": executed_tool_results
                }

        return {
            "role": "assistant",
            "content": full_messages[-1].get("content", "Task executed successfully."),
            "executed_tools": executed_tool_results
        }
