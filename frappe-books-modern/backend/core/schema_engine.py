"""
Schema-driven ORM engine - mirrors Frappe Books' fyo framework architecture.
Schemas define data shape, models provide business logic.
"""
import json
import os
from datetime import date, datetime
from typing import Any, Optional
from uuid import uuid4

from pydantic import BaseModel, Field


class FieldDef(BaseModel):
    """Mirrors schemas/types.ts Field type"""
    fieldname: str
    label: str
    fieldtype: str  # Data, Select, Link, Date, Check, Int, Float, Currency, Text, Table, etc.
    required: bool = False
    hidden: bool = False
    read_only: bool = False
    default: Any = None
    target: Optional[str] = None  # For Link/Table fields
    options: Optional[list[dict[str, str]]] = None  # For Select fields
    placeholder: Optional[str] = None
    section: Optional[str] = None
    tab: Optional[str] = None
    meta: bool = False
    computed: bool = False


class SchemaDef(BaseModel):
    """Mirrors schemas/types.ts Schema type"""
    name: str
    label: str
    fields: list[FieldDef]
    naming: str = "random"  # autoincrement, random, numberSeries, manual
    is_tree: bool = False
    is_child: bool = False
    is_single: bool = False
    is_submittable: bool = False
    is_abstract: bool = False
    extends: Optional[str] = None
    title_field: Optional[str] = None
    keyword_fields: list[str] = []
    table_fields: list[str] = []


# --- In-memory schema registry ---

_schema_registry: dict[str, SchemaDef] = {}


def load_schemas(schemas_dir: str):
    """Load all JSON schema files from the schemas directory."""
    for filename in os.listdir(schemas_dir):
        if filename.endswith(".json"):
            filepath = os.path.join(schemas_dir, filename)
            with open(filepath) as f:
                data = json.load(f)
            schema = SchemaDef(**data)
            _schema_registry[schema.name] = schema
    # Resolve extends: merge fields from parent schemas
    _resolve_extends()


def _resolve_extends():
    for name, schema in list(_schema_registry.items()):
        if schema.extends and schema.extends in _schema_registry:
            parent = _schema_registry[schema.extends]
            existing_names = {f.fieldname for f in schema.fields}
            merged = list(parent.fields) + [
                f for f in schema.fields if f.fieldname not in existing_names
            ]
            schema.fields = merged


def get_schema(name: str) -> Optional[SchemaDef]:
    return _schema_registry.get(name)


def get_all_schemas() -> dict[str, SchemaDef]:
    return _schema_registry


# --- Document / ORM Layer ---

class Doc:
    """
    Mirrors fyo/model/doc.ts Doc class.
    A Doc is an instance of a Schema with data.
    """
    def __init__(self, schema_name: str, data: Optional[dict] = None):
        self.schema_name = schema_name
        self.schema = get_schema(schema_name)
        if not self.schema:
            raise ValueError(f"Schema '{schema_name}' not found")

        self._data: dict[str, Any] = {}
        self._original: dict[str, Any] = {}
        self._dirty = True
        self._not_inserted = True
        self._submitted = False
        self._cancelled = False

        if data:
            self._set_values(data)
        else:
            self._set_defaults()

    def _set_defaults(self):
        for field in self.schema.fields:
            if field.default is not None:
                self._data[field.fieldname] = field.default

    def _set_values(self, data: dict):
        for field in self.schema.fields:
            if field.fieldname in data:
                self._data[field.fieldname] = data[field.fieldname]
        # Also capture any extra keys not in schema fields (like 'name')
        for key in data:
            if key not in self._data:
                self._data[key] = data[key]
        self._original = dict(self._data)

    def __getattr__(self, name: str) -> Any:
        if name.startswith('_'):
            raise AttributeError(name)
        return self._data.get(name)

    def __setattr__(self, name: str, value: Any):
        if name.startswith('_') or name in ('schema_name', 'schema'):
            super().__setattr__(name, value)
        else:
            self._data[name] = value
            self._dirty = True

    @property
    def name(self) -> Optional[str]:
        return self._data.get('name')

    @name.setter
    def name(self, value: str):
        self._data['name'] = value

    @property
    def submitted(self) -> bool:
        return self._submitted

    @property
    def cancelled(self) -> bool:
        return self._cancelled

    @property
    def not_inserted(self) -> bool:
        return self._not_inserted

    @property
    def inserted(self) -> bool:
        return not self._not_inserted

    def to_dict(self) -> dict:
        return dict(self._data)

    def get(self, fieldname: str, default=None):
        return self._data.get(fieldname, default)


# --- Ledger Posting (Double-Entry Engine) ---
# Mirrors models/Transactional/LedgerPosting.ts

class LedgerEntry:
    """A single debit/credit line in the ledger."""
    def __init__(
        self,
        account: str,
        debit: float = 0.0,
        credit: float = 0.0,
        party: str = "",
        date: Optional[date] = None,
        reference_type: str = "",
        reference_name: str = "",
    ):
        self.account = account
        self.debit = debit
        self.credit = credit
        self.party = party
        self.date = date or date.today()
        self.reference_type = reference_type
        self.reference_name = reference_name


class LedgerPosting:
    """
    Mirrors models/Transactional/LedgerPosting.ts
    Maintains a set of ledger entries for a single transactional doc.
    Debits must equal credits before posting.
    """
    def __init__(self, reference_doc: Doc):
        self.ref_doc = reference_doc
        self.entries: list[LedgerEntry] = []
        self._debit_map: dict[str, LedgerEntry] = {}
        self._credit_map: dict[str, LedgerEntry] = {}

    def debit(self, account: str, amount: float):
        if account in self._debit_map:
            self._debit_map[account].debit += amount
        else:
            entry = LedgerEntry(
                account=account,
                debit=amount,
                credit=0.0,
                party=self.ref_doc.get('party', ''),
                date=self.ref_doc.get('date', date.today()),
                reference_type=self.ref_doc.schema_name,
                reference_name=self.ref_doc.get('name', ''),
            )
            self.entries.append(entry)
            self._debit_map[account] = entry

    def credit(self, account: str, amount: float):
        if account in self._credit_map:
            self._credit_map[account].credit += amount
        else:
            entry = LedgerEntry(
                account=account,
                debit=0.0,
                credit=amount,
                party=self.ref_doc.get('party', ''),
                date=self.ref_doc.get('date', date.today()),
                reference_type=self.ref_doc.schema_name,
                reference_name=self.ref_doc.get('name', ''),
            )
            self.entries.append(entry)
            self._credit_map[account] = entry

    def validate(self):
        total_debit = sum(e.debit for e in self.entries)
        total_credit = sum(e.credit for e in self.entries)
        if abs(total_debit - total_credit) > 0.001:
            raise ValueError(
                f"Total Debit ({total_debit}) must equal Total Credit ({total_credit})"
            )

    def get_entries(self) -> list[LedgerEntry]:
        return self.entries
