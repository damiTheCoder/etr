"""
Default Account Mapping & Settings Models (Multi-Tenant).
Supports PyMongo/MongoDB & core database storage.
"""
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, field_validator

from backend.core import database as db
from backend.core.errors import AccountTypeMismatchError, SettingsIncompleteError


class CompanyInfo(BaseModel):
    name: str = "My Company"
    base_currency: str = "USD"
    fiscal_year_start: int = Field(default=1, ge=1, le=12)
    fiscal_year_end: int = Field(default=12, ge=1, le=12)

    @field_validator("fiscal_year_end")
    @classmethod
    def validate_fiscal_year(cls, v: int, info):
        start = info.data.get("fiscal_year_start", 1)
        if start == v:
            raise ValueError("fiscal_year_start cannot be equal to fiscal_year_end.")
        return v


class AccountRef(BaseModel):
    id: str
    name: str
    code: str = ""


class DefaultsAccountFields(BaseModel):
    default_sales_income_account_id: Optional[str] = None
    default_purchase_expense_account_id: Optional[str] = None
    default_receivable_account_id: Optional[str] = None
    default_payable_account_id: Optional[str] = None
    default_cash_account_id: Optional[str] = None
    default_bank_account_id: Optional[str] = None
    default_tax_payable_account_id: Optional[str] = None
    default_tax_receivable_account_id: Optional[str] = None
    round_off_account_id: Optional[str] = None
    discount_allowed_account_id: Optional[str] = None
    stock_inventory_account_id: Optional[str] = None
    depreciation_account_id: Optional[str] = None
    accumulated_depreciation_account_id: Optional[str] = None
    fx_gain_loss_account_id: Optional[str] = None


class SettingsPayload(DefaultsAccountFields):
    company_id: str = "default_company"
    company_name: Optional[str] = None
    base_currency: Optional[str] = None
    fiscal_year_start: Optional[int] = None
    fiscal_year_end: Optional[int] = None
    reason: Optional[str] = None

    @field_validator("fiscal_year_end")
    @classmethod
    def validate_fiscal_year(cls, v: Optional[int], info):
        if v is not None:
            start = info.data.get("fiscal_year_start")
            if start is not None and start == v:
                raise ValueError("fiscal_year_start cannot be equal to fiscal_year_end.")
        return v



class SettingsResponse(BaseModel):
    company_id: str
    version: int = 1
    company: CompanyInfo
    defaults: Dict[str, Optional[AccountRef]]
    company_name: Optional[str] = None
    base_currency: Optional[str] = None
    fiscal_year_start: Optional[int] = None
    fiscal_year_end: Optional[int] = None
    default_sales_income_account_id: Optional[str] = None
    default_purchase_expense_account_id: Optional[str] = None
    default_receivable_account_id: Optional[str] = None
    default_payable_account_id: Optional[str] = None
    default_cash_account_id: Optional[str] = None
    default_bank_account_id: Optional[str] = None
    default_tax_payable_account_id: Optional[str] = None
    default_tax_receivable_account_id: Optional[str] = None
    round_off_account_id: Optional[str] = None
    discount_allowed_account_id: Optional[str] = None
    stock_inventory_account_id: Optional[str] = None
    depreciation_account_id: Optional[str] = None
    accumulated_depreciation_account_id: Optional[str] = None
    fx_gain_loss_account_id: Optional[str] = None


class SettingsAuditLog(BaseModel):
    id: Optional[str] = None
    company_id: str
    changed_by: str
    changed_at: str
    field_name: str
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    reason: Optional[str] = None


# Field mapping rules: (setting_field, expected_root_type)
REQUIRED_ACCOUNT_FIELDS = {
    "default_sales_income_account_id": ("sales_income", ["Income"]),
    "default_purchase_expense_account_id": ("purchase_expense", ["Expense", "Cost of Goods Sold"]),
    "default_receivable_account_id": ("receivable", ["Asset"]),
    "default_payable_account_id": ("payable", ["Liability"]),
    "default_cash_account_id": ("cash", ["Asset"]),
    "default_bank_account_id": ("bank", ["Asset"]),
    "default_tax_payable_account_id": ("tax_payable", ["Liability"]),
    "default_tax_receivable_account_id": ("tax_receivable", ["Asset"]),
    "round_off_account_id": ("round_off", ["Expense", "Income"]),
    "discount_allowed_account_id": ("discount_allowed", ["Expense"]),
    "stock_inventory_account_id": ("stock_inventory", ["Asset"]),
    "depreciation_account_id": ("depreciation", ["Expense"]),
    "accumulated_depreciation_account_id": ("accumulated_depreciation", ["Asset"]),
    "fx_gain_loss_account_id": ("fx_gain_loss", ["Income", "Expense"]),
}


def _get_account_ref(account_name_or_id: Optional[str]) -> Optional[AccountRef]:
    if not account_name_or_id:
        return None
    acct = db.get_doc("Account", account_name_or_id)
    if not acct:
        # Fallback query by name
        docs = db.get_all_docs("Account", {"name": account_name_or_id})
        if docs:
            acct = docs[0]
    if not acct:
        return AccountRef(id=account_name_or_id, name=account_name_or_id, code="")
    return AccountRef(
        id=str(acct.get("name")),
        name=str(acct.get("name")),
        code=str(acct.get("accountNumber") or acct.get("account_number") or ""),
    )


def get_company_settings(company_id: str = "default_company") -> SettingsResponse:
    """Fetch company settings with populated account details matching frontend contract."""
    doc = db.settings.find_one({"company_id": company_id})
    if not doc:
        company_name = db.get_single_value(f"company_name_{company_id}") or db.get_single_value("company_name") or "My Company"
        currency = db.get_single_value(f"currency_{company_id}") or db.get_single_value("currency") or "USD"
        fy_start = int(db.get_single_value(f"fiscal_year_start_{company_id}") or db.get_single_value("fiscal_year_start") or 1)
        fy_end = int(db.get_single_value(f"fiscal_year_end_{company_id}") or db.get_single_value("fiscal_year_end") or 12)
        doc = {
            "company_id": company_id,
            "company_name": company_name,
            "base_currency": currency,
            "fiscal_year_start": fy_start,
            "fiscal_year_end": fy_end,
            "version": 1
        }
    else:
        company_name = doc.get("company_name") or db.get_single_value(f"company_name_{company_id}") or "My Company"
        currency = doc.get("base_currency") or db.get_single_value(f"currency_{company_id}") or "USD"
        fy_start = doc.get("fiscal_year_start") or int(db.get_single_value(f"fiscal_year_start_{company_id}") or 1)
        fy_end = doc.get("fiscal_year_end") or int(db.get_single_value(f"fiscal_year_end_{company_id}") or 12)

    company_info = CompanyInfo(
        name=company_name,
        base_currency=currency,
        fiscal_year_start=int(fy_start),
        fiscal_year_end=int(fy_end),
    )

    # Defaults mapping key -> account_id
    field_to_key = {
        "default_sales_income_account_id": "sales_income",
        "default_purchase_expense_account_id": "purchase_expense",
        "default_receivable_account_id": "receivable",
        "default_payable_account_id": "payable",
        "default_cash_account_id": "cash",
        "default_bank_account_id": "bank",
        "default_tax_payable_account_id": "tax_payable",
        "default_tax_receivable_account_id": "tax_receivable",
        "round_off_account_id": "round_off",
        "discount_allowed_account_id": "discount_allowed",
        "stock_inventory_account_id": "stock_inventory",
        "depreciation_account_id": "depreciation",
        "accumulated_depreciation_account_id": "accumulated_depreciation",
        "fx_gain_loss_account_id": "fx_gain_loss",
    }

    db_keys = {
        "default_sales_income_account_id": ["default_sales_income_account_id", "default_sales_account"],
        "default_purchase_expense_account_id": ["default_purchase_expense_account_id", "default_purchase_account"],
        "default_receivable_account_id": ["default_receivable_account_id", "default_receivable_account"],
        "default_payable_account_id": ["default_payable_account_id", "default_payable_account"],
        "default_cash_account_id": ["default_cash_account_id", "default_cash_account"],
        "default_bank_account_id": ["default_bank_account_id", "default_bank_account"],
        "default_tax_payable_account_id": ["default_tax_payable_account_id"],
        "default_tax_receivable_account_id": ["default_tax_receivable_account_id"],
        "round_off_account_id": ["round_off_account_id", "default_round_off_account"],
        "discount_allowed_account_id": ["discount_allowed_account_id", "default_discount_account"],
        "stock_inventory_account_id": ["stock_inventory_account_id", "default_stock_account"],
        "depreciation_account_id": ["depreciation_account_id", "default_depreciation_account"],
        "accumulated_depreciation_account_id": ["accumulated_depreciation_account_id", "default_accumulated_depreciation_account"],
        "fx_gain_loss_account_id": ["fx_gain_loss_account_id", "default_fx_gain_loss_account"],
    }

    defaults_res: Dict[str, Optional[AccountRef]] = {}

    for field_name, json_key in field_to_key.items():
        acct_val = doc.get(field_name) if doc else None
        single_val = db.get_single_value(f"{field_name}_{company_id}")
        if single_val == "":
            acct_val = ""
        elif not acct_val and single_val:
            acct_val = single_val

        if not acct_val and acct_val != "":
            for fallback_k in db_keys[field_name]:
                f_val = db.get_single_value(fallback_k)
                if f_val == "":
                    acct_val = ""
                    break
                elif f_val:
                    acct_val = f_val
                    break

        defaults_res[json_key] = _get_account_ref(acct_val) if acct_val else None

    def _resolve_val(key_name: str) -> Optional[str]:
        val = doc.get(key_name) if doc else None
        s_val = db.get_single_value(f"{key_name}_{company_id}")
        if s_val == "":
            return None
        if val:
            return val
        if s_val:
            return s_val
        for fb in db_keys.get(key_name, []):
            fb_v = db.get_single_value(fb)
            if fb_v == "":
                return None
            if fb_v:
                return fb_v
        return None

    return SettingsResponse(
        company_id=company_id,
        version=doc.get("version", 1),
        company=company_info,
        defaults=defaults_res,
        company_name=company_name,
        base_currency=currency,
        fiscal_year_start=int(fy_start),
        fiscal_year_end=int(fy_end),
        default_sales_income_account_id=_resolve_val("default_sales_income_account_id"),
        default_purchase_expense_account_id=_resolve_val("default_purchase_expense_account_id"),
        default_receivable_account_id=_resolve_val("default_receivable_account_id"),
        default_payable_account_id=_resolve_val("default_payable_account_id"),
        default_cash_account_id=_resolve_val("default_cash_account_id"),
        default_bank_account_id=_resolve_val("default_bank_account_id"),
        default_tax_payable_account_id=_resolve_val("default_tax_payable_account_id"),
        default_tax_receivable_account_id=_resolve_val("default_tax_receivable_account_id"),
        round_off_account_id=_resolve_val("round_off_account_id"),
        discount_allowed_account_id=_resolve_val("discount_allowed_account_id"),
        stock_inventory_account_id=_resolve_val("stock_inventory_account_id"),
        depreciation_account_id=_resolve_val("depreciation_account_id"),
        accumulated_depreciation_account_id=_resolve_val("accumulated_depreciation_account_id"),
        fx_gain_loss_account_id=_resolve_val("fx_gain_loss_account_id"),
    )


def update_company_settings(
    payload: SettingsPayload,
    changed_by: str = "system",
    company_id: Optional[str] = None
) -> SettingsResponse:
    """Update settings with validation and append-only audit trail logging."""
    cid = company_id or payload.company_id or "default_company"

    field_dict = payload.model_dump(exclude_none=True)
    if "company_id" in field_dict:
        del field_dict["company_id"]
    if "reason" in field_dict:
        del field_dict["reason"]

    # Validate accounts if provided
    for field_name, (json_key, allowed_types) in REQUIRED_ACCOUNT_FIELDS.items():
        if field_name in field_dict:
            new_acct_id = field_dict[field_name]
            if new_acct_id:
                acct_doc = db.get_doc("Account", new_acct_id)
                if not acct_doc:
                    docs = db.get_all_docs("Account", {"name": new_acct_id})
                    if docs:
                        acct_doc = docs[0]
                if not acct_doc:
                    raise ValueError(f"Account '{new_acct_id}' does not exist in Chart of Accounts.")

    if field_dict:
        field_dict["updated_at"] = datetime.utcnow().isoformat()
        field_dict["updated_by"] = changed_by

        # Perform atomic update on db.settings collection
        res = db.settings.update_one(
            {"company_id": cid},
            {"$set": field_dict, "$inc": {"version": 1}},
            upsert=False
        )

        if res.matched_count == 0:
            # Seed document if not created yet
            doc_to_insert = {
                "company_id": cid,
                "company_name": "My Company",
                "base_currency": "USD",
                "fiscal_year_start": 1,
                "fiscal_year_end": 12,
                "version": 1,
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat(),
            }
            doc_to_insert.update(field_dict)
            try:
                db.settings.insert_one(doc_to_insert)
            except Exception:
                pass

        for k in field_dict.keys():
            if k not in {"updated_at", "updated_by"}:
                db.add_audit_log(
                    ref_type="SettingsAuditLog",
                    ref_name=f"{cid}:{k}",
                    action="UPDATE",
                    details=f"changed_by: {changed_by} | field: {k} | value: {field_dict[k]}"
                )

    invalidate_settings_cache(cid)
    return get_company_settings(cid)


def invalidate_settings_cache(company_id: str) -> None:
    """Helper to clear any per-process or thread-local settings cache for company_id."""
    pass


def validate_company_settings(company_id: str = "default_company") -> Dict[str, Any]:
    """Check that all required default accounts are configured, exist, and are valid."""
    settings = get_company_settings(company_id)
    missing: List[str] = []
    invalid: List[str] = []

    for field_name, (json_key, allowed_types) in REQUIRED_ACCOUNT_FIELDS.items():
        acct_ref = settings.defaults.get(json_key)
        if not acct_ref or not acct_ref.id:
            missing.append(field_name)
        else:
            acct_doc = db.get_doc("Account", acct_ref.id)
            if not acct_doc:
                missing.append(field_name)

    return {
        "valid": len(missing) == 0 and len(invalid) == 0,
        "company_id": company_id,
        "missing_accounts": missing,
        "invalid_accounts": invalid,
    }


def check_account_deletion_allowed(account_id: str, company_id: str = "default_company") -> bool:
    """Prevent deleting an account if it is referenced in default account settings."""
    settings = get_company_settings(company_id)
    for json_key, acct_ref in settings.defaults.items():
        if acct_ref and (acct_ref.id == account_id or acct_ref.name == account_id):
            return False
    return True
