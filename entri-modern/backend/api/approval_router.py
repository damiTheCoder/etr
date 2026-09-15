"""
FastAPI Router for Approvals Module.
Endpoints for approval requests, rule management, and approve/reject decision actions.
"""
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from backend.core import database as db
from backend.models.approval_model import (
    check_approval_required,
    create_approval_request,
    approve_request,
    reject_request,
)

router = APIRouter(prefix="/api", tags=["Approvals"])


class DecisionPayload(BaseModel):
    approver: str = "Finance Manager"
    remark: Optional[str] = None


class RulePayload(BaseModel):
    company_id: str = "default_company"
    document_type: str  # JournalEntry, SalesInvoice, PurchaseInvoice, Payment, PurchaseOrder
    min_amount: float = 0.0
    approver_role: str = "Finance Manager"
    is_active: bool = True


@router.get("/approvals")
def list_approvals(
    company_id: Optional[str] = None,
    status: Optional[str] = None,
    reference_type: Optional[str] = None,
):
    """List approval requests with optional filtering."""
    filters = {}
    if company_id:
        filters["company_id"] = company_id
    if status:
        filters["status"] = status
    if reference_type:
        filters["referenceType"] = reference_type

    docs = db.get_all_docs("Approval", filters if filters else None)
    return [d.to_dict() for d in docs]


@router.get("/approvals/pending")
def list_pending_approvals(company_id: str = "default_company"):
    """Get all pending approval requests requiring decision."""
    docs = db.get_all_docs("Approval", {"company_id": company_id, "status": "Pending"})
    return [d.to_dict() for d in docs]


@router.post("/approvals/{name}/approve")
async def approve_endpoint(name: str, payload: DecisionPayload):
    """Approve a pending approval request and auto-post the target document to the ledger."""
    try:
        res = await approve_request(
            approval_name=name,
            approver=payload.approver,
            remark=payload.remark or "Approved"
        )
        return res
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/approvals/{name}/reject")
async def reject_endpoint(name: str, payload: DecisionPayload):
    """Reject an approval request and mark target document as Rejected."""
    try:
        res = await reject_request(
            approval_name=name,
            approver=payload.approver,
            remark=payload.remark or "Rejected"
        )
        return res
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/approval-rules")
def list_approval_rules(company_id: str = "default_company"):
    """List all approval threshold rules."""
    rules = db.get_all_docs("ApprovalRule", {"company_id": company_id})
    return [r.to_dict() for r in rules]


@router.post("/approval-rules")
def create_or_update_approval_rule(payload: RulePayload):
    """Create or update an approval threshold rule."""
    from backend.models import get_model
    rule_model = get_model("ApprovalRule")
    doc = rule_model.create(payload.model_dump())
    rule_model.save(doc)
    return doc.to_dict()
