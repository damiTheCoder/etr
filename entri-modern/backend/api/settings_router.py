"""
FastAPI Settings Router for Default Account Mapping & Company Config.
"""
from typing import Any, Dict, Optional
from fastapi import APIRouter, HTTPException, Query

from backend.models.settings_model import (
    SettingsPayload,
    SettingsResponse,
    get_company_settings,
    update_company_settings,
    validate_company_settings,
)
from backend.core import database as db

router = APIRouter(prefix="/api/settings", tags=["Default Account Mapping & Settings"])


@router.get("", response_model=SettingsResponse)
async def get_settings(company_id: str = Query(default="default_company")):
    """Fetch current company settings with populated default account details."""
    try:
        return get_company_settings(company_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


from datetime import datetime
from backend.models.settings_model import (
    SettingsPayload,
    SettingsResponse,
    get_company_settings,
    update_company_settings,
    validate_company_settings,
    invalidate_settings_cache,
)

@router.patch("", response_model=SettingsResponse)
@router.put("", response_model=SettingsResponse)
async def patch_settings(
    payload: Dict[str, Any],
    company_id: Optional[str] = Query(default=None),
    changed_by: str = Query(default="system")
):
    """Partially update company settings using $set merge and optimistic concurrency versioning."""
    try:
        cid = payload.get("company_id") or company_id or "default_company"

        # Check if settings exist in database
        existing = db.settings.find_one({"company_id": cid})
        if not existing:
            raise HTTPException(
                status_code=404,
                detail=f"Settings not found for company {cid}. Settings are created automatically at company registration — contact support if this persists."
            )

        client_version = payload.get("version")

        # Filter out None values and protected fields
        update_fields = {
            k: v for k, v in payload.items()
            if v is not None and k not in {"_id", "company_id", "created_at", "version"}
        }

        if not update_fields and client_version is None:
            raise HTTPException(status_code=400, detail="No fields to update")

        update_fields["updated_at"] = datetime.utcnow().isoformat()
        update_fields["updated_by"] = changed_by

        filter_query = {"company_id": cid}
        if client_version is not None:
            filter_query["version"] = int(client_version)

        result = db.settings.update_one(
            filter_query,
            {"$set": update_fields, "$inc": {"version": 1}},
            upsert=False
        )

        if result.matched_count == 0:
            raise HTTPException(
                status_code=409,
                detail="Settings were changed by another user. Please refresh and try again."
            )

        invalidate_settings_cache(cid)

        # Record audit log entries
        changed_keys = [k for k in update_fields.keys() if k not in {"updated_at", "updated_by"}]
        for k in changed_keys:
            db.add_audit_log(
                ref_type="SettingsAuditLog",
                ref_name=f"{cid}:{k}",
                action="PATCH",
                details=f"changed_by: {changed_by} | field: {k} | value: {update_fields[k]}"
            )

        return get_company_settings(cid)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/validate")
async def validate_settings(company_id: str = Query(default="default_company")):
    """Check that all required default accounts are configured and exist in Chart of Accounts."""
    try:
        return validate_company_settings(company_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/audit")
async def get_settings_audit_logs(company_id: str = Query(default="default_company")):
    """Return append-only audit trail history of settings changes."""
    try:
        logs = db.get_audit_logs(ref_type="SettingsAuditLog", ref_name="")
        company_logs = [
            l for l in logs
            if l.get("reference_name", "").startswith(f"{company_id}:") or not l.get("reference_name")
        ]
        return {
            "company_id": company_id,
            "total": len(company_logs),
            "logs": company_logs,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/diagnostics")
async def settings_diagnostics(company_id: str = Query(default="default_company")):
    """Return diagnostic details of settings currently saved and used in memory/DB."""
    try:
        settings = get_company_settings(company_id)
        
        accounts_in_use = {}
        for key, ref in settings.defaults.items():
            if ref:
                accounts_in_use[key] = {"id": ref.id, "name": ref.name, "code": ref.code}
            else:
                accounts_in_use[key] = None

        conn = db.get_connection()
        sales_invs = conn.execute(
            "SELECT name, accounts FROM AccountingJournalEntry WHERE reference_type = 'SalesInvoice' AND company_id = ? ORDER BY date DESC LIMIT 1",
            (company_id,)
        ).fetchall()
        vendor_bills = conn.execute(
            "SELECT name, accounts FROM AccountingJournalEntry WHERE reference_type = 'PurchaseInvoice' AND company_id = ? ORDER BY date DESC LIMIT 1",
            (company_id,)
        ).fetchall()

        journals_last_created = {
            "sales_invoice": {"entry_id": sales_invs[0][0], "used_accounts": sales_invs[0][1]} if sales_invs else None,
            "vendor_bill": {"entry_id": vendor_bills[0][0], "used_accounts": vendor_bills[0][1]} if vendor_bills else None,
        }

        return {
            "company_id": company_id,
            "company_name": settings.company.name,
            "base_currency": settings.company.base_currency,
            "fiscal_year": {
                "start": settings.company.fiscal_year_start,
                "end": settings.company.fiscal_year_end
            },
            "accounts_in_use": accounts_in_use,
            "journals_last_created": journals_last_created
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
