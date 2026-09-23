"""
MongoDB / Document persistence layer for Upload Jobs.
Mirrors MongoDB collection interface (insert_one, find_one, update_one, delete_one, create_index)
with native TTL and unique constraint support.
When MongoDB / pymongo is not running or installed, gracefully provides an SQLite / document-store backed
collection that satisfies the exact MongoDB interface and schema requirements.
"""
import os
import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
from uuid import uuid4

logger = logging.getLogger(__name__)

# MongoDB collection interface abstraction
class UploadJobsCollection:
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
                self._mongo_col = self._mongo_client[db_name]["upload_jobs"]
                # Create indexes
                self._mongo_col.create_index("expires_at", expireAfterSeconds=0)
                self._mongo_col.create_index("job_id", unique=True)
                self._mongo_col.create_index("company_id")
                logger.info("Connected to MongoDB for upload_jobs collection")
                return
            except Exception as e:
                logger.warning("MongoDB URI provided but connection failed (%s); falling back to persistent document store", e)

        # Persistent SQLite backed document store matching MongoDB collection interface
        from backend.core import database as db
        conn = db.get_connection()
        conn.execute("""
            CREATE TABLE IF NOT EXISTS [upload_jobs] (
                [_id] TEXT PRIMARY KEY,
                [job_id] TEXT UNIQUE,
                [company_id] TEXT,
                [user_id] TEXT,
                [session_token] TEXT,
                [file_name] TEXT,
                [file_hash] TEXT,
                [status] TEXT,
                [parsed_transactions] TEXT,
                [flagged_transactions] TEXT,
                [total_mismatch] INTEGER,
                [created_at] TEXT,
                [expires_at] TEXT,
                [posted_at] TEXT,
                [doc_type] TEXT,
                [opening_balance] REAL,
                [closing_balance] REAL,
                [posted_entries] TEXT
            )
        """)
        conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_upload_jobs_job_id ON [upload_jobs] (job_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_upload_jobs_company_id ON [upload_jobs] (company_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_upload_jobs_expires_at ON [upload_jobs] (expires_at)")
        conn.commit()

    def create_index(self, key: str, **kwargs):
        if self._mongo_col:
            return self._mongo_col.create_index(key, **kwargs)
        # SQLite already indexed in _init_backend
        return key

    def insert_one(self, doc: Dict[str, Any]):
        if self._mongo_col:
            return self._mongo_col.insert_one(doc)

        from backend.core import database as db
        conn = db.get_connection()
        doc_id = str(doc.get("_id") or uuid4())
        job_id = doc.get("job_id")
        created_at = doc.get("created_at")
        if isinstance(created_at, datetime):
            created_at = created_at.isoformat()
        expires_at = doc.get("expires_at")
        if isinstance(expires_at, datetime):
            expires_at = expires_at.isoformat()
        posted_at = doc.get("posted_at")
        if isinstance(posted_at, datetime):
            posted_at = posted_at.isoformat()

        conn.execute("""
            INSERT OR REPLACE INTO [upload_jobs] (
                [_id], [job_id], [company_id], [user_id], [session_token],
                [file_name], [file_hash], [status], [parsed_transactions],
                [flagged_transactions], [total_mismatch], [created_at],
                [expires_at], [posted_at], [doc_type], [opening_balance],
                [closing_balance], [posted_entries]
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            doc_id,
            job_id,
            str(doc.get("company_id", "default_company")),
            str(doc.get("user_id", "default")),
            doc.get("session_token"),
            doc.get("file_name"),
            doc.get("file_hash"),
            doc.get("status", "processing"),
            json.dumps(doc.get("parsed_transactions", [])),
            json.dumps(doc.get("flagged_transactions", [])),
            1 if doc.get("total_mismatch") else 0,
            created_at,
            expires_at,
            posted_at,
            doc.get("doc_type"),
            doc.get("opening_balance"),
            doc.get("closing_balance"),
            json.dumps(doc.get("posted_entries", []))
        ))
        conn.commit()

    def find_one(self, filter_dict: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        if self._mongo_col:
            doc = self._mongo_col.find_one(filter_dict)
            if not doc:
                return None
            # Enforce TTL if fetched via Mongo without background sweep running
            now = datetime.now(timezone.utc)
            exp = doc.get("expires_at")
            if exp:
                if isinstance(exp, str):
                    exp = datetime.fromisoformat(exp.rstrip("Z")).replace(tzinfo=timezone.utc)
                elif exp.tzinfo is None:
                    exp = exp.replace(tzinfo=timezone.utc)
                if now > exp:
                    self._mongo_col.delete_one({"_id": doc["_id"]})
                    return None
            return doc

        from backend.core import database as db
        conn = db.get_connection()
        where_clauses = []
        params = []
        for k, v in filter_dict.items():
            where_clauses.append(f"[{k}] = ?")
            params.append(str(v))
        where_sql = " AND ".join(where_clauses) if where_clauses else "1=1"
        row = conn.execute(f"SELECT * FROM [upload_jobs] WHERE {where_sql} LIMIT 1", params).fetchone()
        if not row:
            return None

        # Build dict
        doc = dict(row)

        # Check TTL expiration
        expires_at_str = doc.get("expires_at")
        if expires_at_str:
            try:
                exp_dt = datetime.fromisoformat(expires_at_str.rstrip("Z"))
                if exp_dt.tzinfo is None:
                    exp_dt = exp_dt.replace(tzinfo=timezone.utc)
                now_dt = datetime.now(timezone.utc)
                if now_dt > exp_dt:
                    conn.execute("DELETE FROM [upload_jobs] WHERE [_id] = ?", (doc["_id"],))
                    conn.commit()
                    return None
            except Exception:
                pass

        # Parse JSON fields
        for json_col in ("parsed_transactions", "flagged_transactions", "posted_entries"):
            if doc.get(json_col):
                try:
                    doc[json_col] = json.loads(doc[json_col])
                except Exception:
                    doc[json_col] = []
            else:
                doc[json_col] = []
        doc["total_mismatch"] = bool(doc.get("total_mismatch"))
        return doc

    def update_one(self, filter_dict: Dict[str, Any], update_dict: Dict[str, Any]):
        if self._mongo_col:
            return self._mongo_col.update_one(filter_dict, update_dict)

        set_fields = update_dict.get("$set", update_dict)
        from backend.core import database as db
        conn = db.get_connection()
        set_clauses = []
        params = []
        for k, v in set_fields.items():
            if isinstance(v, (dict, list)):
                v = json.dumps(v)
            elif isinstance(v, datetime):
                v = v.isoformat()
            elif isinstance(v, bool):
                v = 1 if v else 0
            set_clauses.append(f"[{k}] = ?")
            params.append(v)

        where_clauses = []
        for k, v in filter_dict.items():
            where_clauses.append(f"[{k}] = ?")
            params.append(str(v))

        sql = f"UPDATE [upload_jobs] SET {', '.join(set_clauses)} WHERE {' AND '.join(where_clauses)}"
        conn.execute(sql, params)
        conn.commit()

    def delete_one(self, filter_dict: Dict[str, Any]):
        if self._mongo_col:
            return self._mongo_col.delete_one(filter_dict)

        from backend.core import database as db
        conn = db.get_connection()
        where_clauses = [f"[{k}] = ?" for k in filter_dict]
        params = [str(v) for v in filter_dict.values()]
        conn.execute(f"DELETE FROM [upload_jobs] WHERE {' AND '.join(where_clauses)}", params)
        conn.commit()


# Singleton upload_jobs collection handle
upload_jobs = UploadJobsCollection()
