"""Purchase Invoice model"""
from .invoice import InvoiceModel


class PurchaseInvoiceModel(InvoiceModel):
    schema_name = "PurchaseInvoice"
