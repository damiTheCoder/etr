"""
MongoDB / Document persistence layer for AI Chat Messages with reasoning, todos, and tool calls.
Matches MongoDB collection interface (insert_one, find_one, find) with MongoDB and SQLite fallback.
"""
import os
import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import uuid4

logger = logging.getLogger(__name__)


class ChatMessagesCollection:
    def __init__(self):
        self._mongo_client = None
        self._mongo_col = None
        self._init_backend()

    def _init_backend(self):
        mongo_uri = os.environ.get("MONGODB_URI") or os.environ.get("MONGO_URL")
        if mongo_uri:
            try:
                import pymongo
                self._mongo_client = pymongo.MongoClient(mongo_uri, serverSelectionTimeoutMS=2000)
                db_name = os.environ.get("MONGODB_DB", "entri")
                self._mongo_col = self._mongo_client[db_name]["chat_messages"]
                self._mongo_col.create_index("message_id", unique=True)
                self._mongo_col.create_index("company_id")
                logger.info("Connected to MongoDB for chat_messages collection")
                return
            except Exception as e:
                logger.warning("MongoDB URI provided but connection failed (%s); falling back to persistent document store", e)

        # Persistent SQLite backed document store matching MongoDB collection interface
        from backend.core import database as db
        conn = db.get_connection()
        conn.execute("""
            CREATE TABLE IF NOT EXISTS [chat_messages] (
                [_id] TEXT PRIMARY KEY,
                [message_id] TEXT UNIQUE,
                [company_id] TEXT,
                [role] TEXT,
                [content] TEXT,
                [reasoning] TEXT,
                [tool_calls] TEXT,
                [todos] TEXT,
                [model] TEXT,
                [created_at] TEXT
            )
        """)
        conn.commit()

    def insert_one(self, doc: Dict[str, Any]) -> Any:
        if self._mongo_col is not None:
            return self._mongo_col.insert_one(doc)

        from backend.core import database as db
        conn = db.get_connection()
        _id = str(doc.get("_id") or uuid4())
        msg_id = str(doc.get("message_id") or uuid4())
        company_id = str(doc.get("company_id", "default_company"))
        role = str(doc.get("role", "assistant"))
        content = str(doc.get("content", ""))
        reasoning = str(doc.get("reasoning", "") or "")
        tool_calls = json.dumps(doc.get("tool_calls", []))
        todos = json.dumps(doc.get("todos", []))
        model = str(doc.get("model", ""))
        created_at = doc.get("created_at") or datetime.now(timezone.utc).isoformat()

        conn.execute("""
            INSERT OR REPLACE INTO [chat_messages]
            ([_id], [message_id], [company_id], [role], [content], [reasoning], [tool_calls], [todos], [model], [created_at])
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (_id, msg_id, company_id, role, content, reasoning, tool_calls, todos, model, created_at))
        conn.commit()

        class InsertResult:
            inserted_id = _id
        return InsertResult()

    def find_one(self, filter_dict: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        if self._mongo_col is not None:
            return self._mongo_col.find_one(filter_dict)

        from backend.core import database as db
        conn = db.get_connection()
        where_clauses = []
        params = []
        for k, v in filter_dict.items():
            where_clauses.append(f"[{k}] = ?")
            params.append(str(v))

        where_sql = " AND ".join(where_clauses) if where_clauses else "1=1"
        cursor = conn.execute(f"SELECT * FROM [chat_messages] WHERE {where_sql} LIMIT 1", params)
        row = cursor.fetchone()
        if not row:
            return None

        col_names = [desc[0] for desc in cursor.description]
        data = dict(zip(col_names, row))
        try:
            data["tool_calls"] = json.loads(data.get("tool_calls") or "[]")
        except Exception:
            data["tool_calls"] = []
        try:
            data["todos"] = json.loads(data.get("todos") or "[]")
        except Exception:
            data["todos"] = []
        return data


# Global singleton instance
chat_messages = ChatMessagesCollection()
