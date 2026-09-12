from .account import AccountModel
from .party import PartyModel
from .item import ItemModel
from .invoice import InvoiceModel
from .sales_invoice import SalesInvoiceModel
from .purchase_invoice import PurchaseInvoiceModel
from .payment import PaymentModel
from .journal_entry import JournalEntryModel
from .number_series import NumberSeriesModel
from .tax import TaxModel
from .purchase_order import PurchaseOrderModel
from .reconciliation import ReconciliationModel
from .approval import ApprovalModel

MODEL_REGISTRY = {
    "Account": AccountModel(),
    "Party": PartyModel(),
    "Item": ItemModel(),
    "SalesInvoice": SalesInvoiceModel(),
    "PurchaseInvoice": PurchaseInvoiceModel(),
    "Payment": PaymentModel(),
    "JournalEntry": JournalEntryModel(),
    "NumberSeries": NumberSeriesModel(),
    "Invoice": InvoiceModel(),
    "Tax": TaxModel(),
    "PurchaseOrder": PurchaseOrderModel(),
    "Reconciliation": ReconciliationModel(),
    "Approval": ApprovalModel(),
}

def get_model(schema_name: str):
    if not schema_name:
        return None
    normalized = schema_name.replace(" ", "").replace("_", "").lower()
    aliases = {
        "salesinvoice": "SalesInvoice",
        "purchaseinvoice": "PurchaseInvoice",
        "journalentry": "JournalEntry",
        "payment": "Payment",
        "paymententry": "Payment",
        "purchaseorder": "PurchaseOrder",
        "account": "Account",
        "party": "Party",
        "item": "Item",
        "tax": "Tax",
        "numberseries": "NumberSeries",
        "reconciliation": "Reconciliation",
        "approval": "Approval",
    }
    target_key = aliases.get(normalized, schema_name)
    return MODEL_REGISTRY.get(target_key) or MODEL_REGISTRY.get(schema_name)

def get_all_models():
    return MODEL_REGISTRY

