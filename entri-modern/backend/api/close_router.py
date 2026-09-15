"""
Close Management & Period Locking FastAPI Router.
Endpoints matching the frontend contract for month-end close workflows.
"""
from datetime import datetime
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel

from backend.core import database as db
from backend.core.errors import PeriodClosedError
from backend.core.close_management import (
    get_or_create_period,
    get_period_for_date,
    run_checklist,
    close_period,
    reopen_period,
)

router = APIRouter(prefix="/api/close", tags=["Close Management"])


# ─── Request Models ───────────────────────────────────────────────────────────

class ClosePeriodRequest(BaseModel):
    company_id: str = "default_company"
    user_id: str = "system"


class ReopenPeriodRequest(BaseModel):
    company_id: str = "default_company"
    user_id: str = "system"
    user_role: str = "ACCOUNTANT"
    reason: str


class EnsurePeriodRequest(BaseModel):
    company_id: str = "default_company"
    period_start: str


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/periods")
async def list_periods(company_id: str = Query("default_company")):
    """List recent fiscal periods for company."""
    docs = db.get_all_docs("FiscalPeriod", {"company_id": company_id})
    res = [d.to_dict() for d in docs]
    res.sort(key=lambda x: x.get("period_start", ""), reverse=True)
    return {"periods": res}


@router.get("/periods/current")
async def get_current_period(company_id: str = Query("default_company")):
    """Get or create current month's OPEN period."""
    today_str = datetime.utcnow().strftime("%Y-%m-%d")
    period = get_or_create_period(company_id, today_str)
    return {"period": period}


@router.post("/periods/ensure")
async def ensure_period(req: EnsurePeriodRequest):
    """Idempotently create/fetch a period for the specified period_start date."""
    period = get_or_create_period(req.company_id, req.period_start)
    return {"period": period}


@router.get("/periods/{period_id}/checklist")
async def get_period_checklist(
    period_id: str,
    company_id: str = Query("default_company"),
    user_id: str = Query("system"),
    user_role: str = Query("ACCOUNTANT"),
):
    """Run checklist live and return full frontend contract format without persisting snapshot."""
    try:
        res = run_checklist(company_id, period_id, user_id=user_id, persist_snapshot=False)
        period_data = res["period"]
        tasks = res["tasks"]
        can_reopen = user_role in ["MANAGER", "ADMIN"] and period_data.get("status") in ["CLOSED", "LOCKED"]

        # Format checklist tasks with action URLs if applicable
        formatted_tasks = []
        for t in tasks:
            tid = t.get("task_id")
            action_url = None
            if tid == "no_draft_entries":
                action_url = "/journal-entries?status=Draft"
            elif tid == "no_pending_approvals":
                action_url = "/approvals?status=Pending"
            elif tid == "bank_reconciled":
                action_url = "/bank-reconciliation"

            formatted_tasks.append({
                "task_id": tid,
                "label": t.get("label"),
                "status": t.get("status"),
                "details": t.get("details"),
                "is_required": t.get("is_required", True),
                "action_url": action_url,
            })

        return {
            "period": period_data,
            "checklist": formatted_tasks,
            "ready_to_close": res["ready_to_close"],
            "blocking_tasks": res["blocking_tasks"],
            "can_reopen": can_reopen,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/periods/{period_id}/close")
async def close_fiscal_period(period_id: str, req: ClosePeriodRequest):
    """Closes period if checklist is ready, raises PeriodClosedError otherwise."""
    try:
        updated = close_period(req.company_id, period_id, closed_by=req.user_id)
        return {"period": updated, "message": f"Fiscal period '{updated.get('label')}' closed successfully."}
    except PeriodClosedError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=e.message)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/periods/{period_id}/reopen")
async def reopen_fiscal_period(period_id: str, req: ReopenPeriodRequest):
    """Reopens a closed fiscal period. Requires MANAGER or ADMIN role and non-empty reason."""
    try:
        updated = reopen_period(
            company_id=req.company_id,
            period_id=period_id,
            reopened_by=req.user_id,
            reason=req.reason,
            user_role=req.user_role,
        )
        return {"period": updated, "message": f"Fiscal period '{updated.get('label')}' reopened successfully."}
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/periods/{period_id}/audit")
async def get_period_close_audit(period_id: str, company_id: str = Query("default_company")):
    """Fetch append-only audit trail logs for close actions on the given period."""
    logs = db.get_all_docs("CloseAuditLog", {"company_id": company_id, "period_id": period_id})
    res = [l.to_dict() for l in logs]
    res.sort(key=lambda x: x.get("timestamp", ""))
    return {"audit_logs": res}
