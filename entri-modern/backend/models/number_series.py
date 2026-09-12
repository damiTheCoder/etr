"""Number Series model - handles auto-incrementing document numbering."""
from backend.core.base_model import BaseModel


class NumberSeriesModel(BaseModel):
    schema_name = "NumberSeries"

    def get_defaults(self, doc):
        return {
            "current": 0,
            "prefix": doc.get("name", ""),
        }
