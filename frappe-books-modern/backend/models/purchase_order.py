"""Purchase Order model - extends Invoice base for purchase orders."""
from .invoice import InvoiceModel


class PurchaseOrderModel(InvoiceModel):
    schema_name = "PurchaseOrder"

    def get_defaults(self, doc):
        defaults = super().get_defaults(doc)
        defaults.update({
            "status": "Draft",
            "submitted": False,
            "cancelled": False,
        })
        return defaults

    async def after_submit(self, doc):
        doc._data["submitted"] = True
        doc._data["status"] = "Submitted"
        from backend.core import database as db
        db.update_doc(doc)

    async def after_cancel(self, doc):
        doc._data["submitted"] = False
        doc._data["cancelled"] = True
        doc._data["status"] = "Cancelled"
        from backend.core import database as db
        db.update_doc(doc)
