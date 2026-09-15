"""
Approval workflow core engine.
Manages approval rules, threshold-based triggers, and decision-driven ledger posting.
"""
from datetime import datetime, date
from typing import Any, Dict, List, Optional

from backend.core import database as db
from backend.core.base_model import BaseModel
from backend.core.schema_engine import Doc



class ApprovalModel(BaseModel):
    schema_name = "Approval"

    def get_defaults(self, doc: Doc) -> dict:
        return {
            "date": date.today().isoformat(),
            "status": "Pending",
            "approval_status": "Pending",
            "submitted": False,
            "cancelled": False,
        }

    async def after_submit(self, doc: Doc):
        doc._data["submitted"] = True
        db.update_doc(doc)

    async def after_cancel(self, doc: Doc):
        doc._data["submitted"] = False
        doc._data["cancelled"] = True
        db.update_doc(doc)


class ApprovalRuleModel(BaseModel):
    schema_name = "ApprovalRule"

    def get_defaults(self, doc: Doc) -> dict:
        return {
            "company_id": "default_company",
            "min_amount": 0.0,
            "approver_role": "Finance Manager",
            "is_active": True,
        }



def check_approval_required(company_id: str, document_type: str, amount: float) -> Optional[Dict[str, Any]]:
    """
    Check if a document transaction requires approval based on active ApprovalRules.
    Returns matching rule dict if required, else None.
    """
    rules = db.get_all_docs("ApprovalRule", {"company_id": company_id, "document_type": document_type})
    if not rules:
        rules = db.get_all_docs("ApprovalRule", {"document_type": document_type})

    for rule in rules:
        is_active = rule.get("is_active", True)
        min_amount = float(rule.get("min_amount", 0))
        if is_active and amount >= min_amount:
            return rule.to_dict()

    return None


def create_approval_request(
    company_id: str,
    reference_type: str,
    reference_name: str,
    amount: float,
    requested_by: str = "system",
    remark: str = ""
) -> Dict[str, Any]:
    """Creates a new Pending Approval request document."""
    from backend.models import get_model
    appr_model = get_model("Approval")

    payload = {
        "company_id": company_id,
        "referenceType": reference_type,
        "referenceName": reference_name,
        "amount": amount,
        "requested_by": requested_by,
        "status": "Pending",
        "remark": remark or f"Approval required for {reference_type} {reference_name} (${amount:,.2f})",
        "date": date.today().isoformat(),
    }
    doc = appr_model.create(payload)
    appr_model.save(doc)

    # Set approvalStatus="Pending" on target document
    target_doc = db.get_doc(reference_type, reference_name)
    if target_doc:
        target_doc._data["approvalStatus"] = "Pending"
        db.update_doc(target_doc)

    db.add_audit_log(
        ref_type="Approval",
        ref_name=doc.name,
        action="REQUESTED",
        details=f"Created pending approval request for {reference_type} {reference_name} by {requested_by}"
    )

    return doc.to_dict()


async def approve_request(
    approval_name: str,
    approver: str = "Finance Manager",
    remark: str = ""
) -> Dict[str, Any]:
    """Approves request, updates target doc to 'Approved', and posts target doc to ledger."""
    appr_doc = db.get_doc("Approval", approval_name)
    if not appr_doc:
        raise ValueError(f"Approval request '{approval_name}' not found.")

    if appr_doc.get("status") != "Pending":
        raise ValueError(f"Approval request '{approval_name}' is already {appr_doc.get('status')}.")

    # ─── Self-Approval Guard (Segregation of Duties) ─────────────────────────
    requested_by = (appr_doc.get("requested_by") or "").strip().lower()
    approver_clean = (approver or "").strip().lower()
    if requested_by and approver_clean and requested_by == approver_clean:
        raise ValueError(
            f"Self-approval is strictly forbidden per segregation of duties. "
            f"User '{approver}' requested this approval and cannot approve their own request."
        )

    appr_doc._data["status"] = "Approved"

    appr_doc._data["approver"] = approver
    appr_doc._data["decided_at"] = datetime.now().isoformat()
    if remark:
        appr_doc._data["remark"] = remark
    db.update_doc(appr_doc)

    ref_type = appr_doc.get("referenceType")
    ref_name = appr_doc.get("referenceName")

    # Update target doc and auto-submit to ledger
    if ref_type and ref_name:
        from backend.models import get_model
        target_model = get_model(ref_type)

        if target_model:
            target_doc = target_model.get(ref_name)
            if target_doc:
                target_doc._data["approvalStatus"] = "Approved"
                db.update_doc(target_doc)

                # Post to ledger if not submitted yet
                if not target_doc.get("submitted"):
                    await target_model.after_submit(target_doc)
                    db.add_audit_log(ref_type, ref_name, "Posted", f"Auto-posted entries to ledger following approval {approval_name}")

    db.add_audit_log(
        ref_type="Approval",
        ref_name=approval_name,
        action="APPROVED",
        details=f"Approved by {approver}. Target {ref_type} {ref_name} posted."
    )

    return appr_doc.to_dict()


async def reject_request(
    approval_name: str,
    approver: str = "Finance Manager",
    remark: str = ""
) -> Dict[str, Any]:
    """Rejects request and marks target doc as 'Rejected'."""
    appr_doc = db.get_doc("Approval", approval_name)
    if not appr_doc:
        raise ValueError(f"Approval request '{approval_name}' not found.")

    if appr_doc.get("status") != "Pending":
        raise ValueError(f"Approval request '{approval_name}' is already {appr_doc.get('status')}.")

    appr_doc._data["status"] = "Rejected"
    appr_doc._data["approver"] = approver
    appr_doc._data["decided_at"] = datetime.now().isoformat()
    if remark:
        appr_doc._data["remark"] = remark
    db.update_doc(appr_doc)

    ref_type = appr_doc.get("referenceType")
    ref_name = appr_doc.get("referenceName")

    if ref_type and ref_name:
        target_doc = db.get_doc(ref_type, ref_name)
        if target_doc:
            target_doc._data["approvalStatus"] = "Rejected"
            db.update_doc(target_doc)

    db.add_audit_log(
        ref_type="Approval",
        ref_name=approval_name,
        action="REJECTED",
        details=f"Rejected by {approver}. Reason: {remark or 'None'}"
    )

    return appr_doc.to_dict()
