"""
FastAPI Router for Bank Reconciliation Module.
Endpoints for statement import, intelligent auto-matching, and ledger reconciliation submission.
"""
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from backend.core import database as db
from backend.core.bank_reconciliation import (
    import_bank_statement,
    auto_match_bank_statement,
    reconcile_bank_statement,
    unreconcile_bank_statement,
    get_unmatched_ledger_entries,
)

router = APIRouter(prefix="/api/bank-reconciliation", tags=["Bank Reconciliation"])



class BankStatementLinePayload(BaseModel):
    date: Optional[str] = None
    description: str = ""
    reference_number: Optional[str] = None
    deposit: float = 0.0
    withdrawal: float = 0.0


class ImportStatementPayload(BaseModel):
    company_id: str = "default_company"
    account: str = "Bank"
    statement_date: Optional[str] = None
    opening_balance: float = 0.0
    closing_balance: float = 0.0
    user_remark: Optional[str] = None
    lines: List[BankStatementLinePayload] = []


class ManualMatchItem(BaseModel):
    line_id: str
    ledger_entry_id: str


class ReconcilePayload(BaseModel):
    matches_override: Optional[List[ManualMatchItem]] = None


@router.post("/import")
def import_statement_endpoint(payload: ImportStatementPayload):
    """Import a bank statement with transaction lines."""
    try:
        lines_data = [l.model_dump() for l in payload.lines]
        res = import_bank_statement(
            company_id=payload.company_id,
            account_name=payload.account,
            statement_date=payload.statement_date or "",
            opening_balance=payload.opening_balance,
            closing_balance=payload.closing_balance,
            lines=lines_data,
            user_remark=payload.user_remark or ""
        )
        return res
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/unmatched-ledger/{account_name}")
def get_unmatched_ledger_endpoint(account_name: str, company_id: str = "default_company"):
    """Fetch all un-reconciled ledger entries for a given bank account."""
    return get_unmatched_ledger_entries(account_name, company_id)


@router.post("/{name}/auto-match")
def auto_match_endpoint(name: str):
    """Trigger intelligent multi-factor matching for a bank statement."""
    try:
        res = auto_match_bank_statement(name)
        return res
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{name}/reconcile")
async def reconcile_endpoint(name: str, payload: ReconcilePayload):
    """Finalize bank statement reconciliation and update ledger status."""
    try:
        overrides = [m.model_dump() for m in payload.matches_override] if payload.matches_override else None
        res = await reconcile_bank_statement(name, matches_override=overrides)
        return res
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{name}/unreconcile")
async def unreconcile_endpoint(name: str):
    """Un-reconcile a completed bank statement and unlock ledger entries."""
    try:
        res = await unreconcile_bank_statement(name)
        return res
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))



@router.get("/{name}")
def get_reconciliation_details(name: str):
    """Fetch statement details including line items and match statuses."""
    doc = db.get_doc("Reconciliation", name)
    if not doc:
        raise HTTPException(status_code=404, detail=f"Reconciliation '{name}' not found")

    conn = db.get_connection()
    rows = conn.execute(
        "SELECT data FROM ChildTable WHERE parent_type = 'Reconciliation' AND parent_name = ? ORDER BY idx",
        (name,)
    ).fetchall()
    lines = [db.json.loads(r[0]) for r in rows]

    res = doc.to_dict()
    res["entries"] = lines
    return res
