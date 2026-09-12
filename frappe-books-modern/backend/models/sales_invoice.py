"""Sales Invoice model - mirrors models/baseModels/SalesInvoice/SalesInvoice.ts"""
from .invoice import InvoiceModel


class SalesInvoiceModel(InvoiceModel):
    schema_name = "SalesInvoice"
