"""Reconciliation model - for bank/account reconciliation."""
from datetime import date
from typing import Any, Optional
from backend.core.base_model import BaseModel
from backend.core.schema_engine import Doc
from backend.core import database as db


class ReconciliationModel(BaseModel):
    schema_name = "Reconciliation"

    def get_defaults(self, doc: Doc) -> dict:
        return {
            "date": date.today().isoformat(),
            "status": "Draft",
            "submitted": False,
            "cancelled": False,
            "openingBalance": 0,
            "closingBalance": 0,
        }

    async def after_submit(self, doc):
        doc._data["submitted"] = True
        doc._data["status"] = "Completed"
        db.update_doc(doc)

    async def after_cancel(self, doc):
        doc._data["submitted"] = False
        doc._data["cancelled"] = True
        doc._data["status"] = "Cancelled"
        db.update_doc(doc)
