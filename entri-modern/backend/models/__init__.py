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
from .approval_model import ApprovalRuleModel

from backend.core.base_model import BaseModel


class GenericModel(BaseModel):
    def __init__(self, schema_name: str):
        self.schema_name = schema_name


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
    "ApprovalRule": ApprovalRuleModel(),
    "FiscalPeriod": GenericModel("FiscalPeriod"),
    "CloseChecklistTemplate": GenericModel("CloseChecklistTemplate"),
    "CloseAuditLog": GenericModel("CloseAuditLog"),
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
        "approvalrule": "ApprovalRule",
        "fiscalperiod": "FiscalPeriod",
        "closechecklisttemplate": "CloseChecklistTemplate",
        "closeauditlog": "CloseAuditLog",
    }
    target_key = aliases.get(normalized, schema_name)
    model = MODEL_REGISTRY.get(target_key) or MODEL_REGISTRY.get(schema_name)
    if not model:
        model = GenericModel(schema_name)
        MODEL_REGISTRY[schema_name] = model
    return model


def get_all_models():
    return MODEL_REGISTRY


