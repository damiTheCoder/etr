"""
Tax model - master for tax rates and accounts.
"""
from backend.core.base_model import BaseModel


class TaxModel(BaseModel):
    schema_name = "Tax"

    def get_defaults(self, doc: dict) -> dict:
        return {
            "rate": 0,
        }
