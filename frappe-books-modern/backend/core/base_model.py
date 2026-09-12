"""
Base model class - mirrors fyo/model/doc.ts Doc class behavior
Each model provides business logic for its schema.
"""
from typing import Any, Optional
from backend.core.schema_engine import Doc, get_schema
from backend.core import database as db


class BaseModel:
    """Base class for all business models."""

    schema_name: str = ""

    def get_defaults(self, doc: Doc) -> dict:
        """Override to provide dynamic defaults."""
        return {}

    def get_filters(self, fieldname: str, doc: Optional[Doc] = None) -> Optional[dict]:
        """Override to provide dynamic filters for Link fields."""
        return None

    async def before_sync(self, doc: Doc):
        """Called before saving. Override for validation/pre-save logic."""
        pass

    async def after_submit(self, doc: Doc):
        """Called after submit. Override for ledger posting etc."""
        pass

    async def after_cancel(self, doc: Doc):
        """Called after cancel. Override for reverse posting."""
        pass

    async def after_delete(self, doc: Doc):
        """Called after delete."""
        pass

    def create(self, data: dict) -> Doc:
        doc = Doc(self.schema_name, data)
        # Apply dynamic defaults
        defaults = self.get_defaults(doc)
        for key, value in defaults.items():
            if doc.get(key) is None:
                doc._data[key] = value
        return doc

    def save(self, doc: Doc) -> str:
        if doc.not_inserted:
            return db.insert_doc(doc)
        else:
            db.update_doc(doc)
            return doc.name or ""

    def get(self, name: str) -> Optional[Doc]:
        return db.get_doc(self.schema_name, name)

    def get_all(self, filters: Optional[dict] = None, **kwargs) -> list[Doc]:
        return db.get_all_docs(self.schema_name, filters, **kwargs)

    def delete(self, name: str):
        db.delete_doc(self.schema_name, name)
