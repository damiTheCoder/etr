"""Approval model - for approval workflows."""
from datetime import date
from typing import Any, Optional
from backend.core.base_model import BaseModel
from backend.core.schema_engine import Doc
from backend.core import database as db


class ApprovalModel(BaseModel):
    schema_name = "Approval"

    def get_defaults(self, doc: Doc) -> dict:
        return {
            "date": date.today().isoformat(),
            "status": "Pending",
            "submitted": False,
            "cancelled": False,
        }

    async def after_submit(self, doc):
        doc._data["submitted"] = True
        db.update_doc(doc)

    async def after_cancel(self, doc):
        doc._data["submitted"] = False
        doc._data["cancelled"] = True
        db.update_doc(doc)
