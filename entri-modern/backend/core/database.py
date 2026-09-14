"""
Database layer - mirrors fyo/core/dbHandler.ts
Handles SQLite operations with schema-driven table creation.
"""
import sqlite3
import json
import os
import threading
from datetime import date, datetime
from typing import Any, Optional
from uuid import uuid4

from .schema_engine import get_schema, get_all_schemas, SchemaDef, Doc


DB_PATH = None
_thread_local = threading.local()


def get_connection() -> sqlite3.Connection:
    if not hasattr(_thread_local, "connection") or _thread_local.connection is None:
        db_path = DB_PATH or os.environ.get("BOOKS_DB_PATH", "books.db")
        conn = sqlite3.connect(db_path, check_same_thread=False, timeout=30.0)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA foreign_keys=ON")
        _thread_local.connection = conn
    return _thread_local.connection


def init_database(db_path: Optional[str] = None):
    """Create database and initialize all tables from schemas."""
    global DB_PATH
    if db_path:
        DB_PATH = db_path
    if hasattr(_thread_local, "connection"):
        _thread_local.connection = None
    conn = get_connection()

    for schema_name, schema in get_all_schemas().items():
        if schema.is_abstract:
            continue
        _create_table(conn, schema)

    # Single value table (Entity-Attribute-Value pattern)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS SingleValue (
            name TEXT PRIMARY KEY,
            value TEXT
        )
    """)

    # Audit Log table
    conn.execute("""
        CREATE TABLE IF NOT EXISTS AuditLog (
            id TEXT PRIMARY KEY,
            reference_type TEXT NOT NULL,
            reference_name TEXT NOT NULL,
            action TEXT NOT NULL,
            details TEXT DEFAULT '',
            timestamp TEXT NOT NULL
        )
    """)

    # Accounting Ledger table
    conn.execute("""
        CREATE TABLE IF NOT EXISTS AccountingLedgerEntry (
            name TEXT PRIMARY KEY,
            account TEXT NOT NULL,
            party TEXT DEFAULT '',
            date TEXT NOT NULL,
            debit REAL DEFAULT 0,
            credit REAL DEFAULT 0,
            reference_type TEXT NOT NULL,
            reference_name TEXT NOT NULL,
            reverted INTEGER DEFAULT 0
        )
    """)

    # Child table storage (JSON-based, for Table fieldtype)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS ChildTable (
            id TEXT PRIMARY KEY,
            parent_type TEXT NOT NULL,
            parent_name TEXT NOT NULL,
            fieldname TEXT NOT NULL,
            idx INTEGER DEFAULT 0,
            data TEXT NOT NULL
        )
    """)

    conn.commit()


def _create_table(conn: sqlite3.Connection, schema: SchemaDef):
    columns = ["name TEXT PRIMARY KEY"]
    for field in schema.fields:
        if field.meta or field.computed:
            continue
        if field.fieldtype == "Table":
            continue
        if field.fieldname == "name":
            continue
        col_type = _get_sqlite_type(field.fieldtype)
        default = ""
        if field.default is not None:
            if isinstance(field.default, str):
                default = f" DEFAULT '{field.default}'"
            elif isinstance(field.default, bool):
                default = f" DEFAULT {1 if field.default else 0}"
            else:
                default = f" DEFAULT {field.default}"
        columns.append(f"  {field.fieldname} {col_type}{default}")

    columns.append("  created_at TEXT DEFAULT (datetime('now'))")
    columns.append("  updated_at TEXT DEFAULT (datetime('now'))")

    conn.execute(f"""
        CREATE TABLE IF NOT EXISTS [{schema.name}] (
            {', '.join(columns)}
        )
    """)


def _get_sqlite_type(fieldtype: str) -> str:
    mapping = {
        "Data": "TEXT",
        "Select": "TEXT",
        "Link": "TEXT",
        "Date": "TEXT",
        "Datetime": "TEXT",
        "Check": "INTEGER",
        "Int": "INTEGER",
        "Float": "REAL",
        "Currency": "REAL",
        "Text": "TEXT",
        "Color": "TEXT",
        "DynamicLink": "TEXT",
        "AttachImage": "TEXT",
        "Attachment": "TEXT",
    }
    return mapping.get(fieldtype, "TEXT")


def insert_doc(doc: Doc) -> str:
    """Insert a document into its table."""
    conn = get_connection()
    schema = doc.schema
    table_name = schema.name

    name = doc.get('name')
    if not name:
        if schema.naming == "numberSeries":
            prefix = doc.get('numberSeries', doc.get('number_series', ''))
            name = _get_next_series_number(conn, prefix or schema.name)
        else:
            name = str(uuid4())[:8]
        doc.name = name

    fields = [f for f in schema.fields
              if not f.meta and not f.computed and f.fieldtype != "Table"]
    col_names = ['name'] + [f.fieldname for f in fields]
    placeholders = ['?'] * len(col_names)
    values = [name] + [doc.get(f.fieldname) for f in fields]

    conn.execute(
        f"INSERT INTO [{table_name}] ({', '.join(col_names)}) VALUES ({', '.join(placeholders)})",
        values
    )

    # Save child table rows
    for field in schema.fields:
        if field.fieldtype == "Table":
            child_data = doc.get(field.fieldname, [])
            if child_data:
                _save_child_rows(conn, name, table_name, field.fieldname, child_data)

    conn.commit()
    doc._not_inserted = False
    doc._dirty = False
    return name


def _save_child_rows(conn, parent_name: str, parent_type: str, fieldname: str, child_data: list):
    """Save child table rows."""
    # Delete existing child rows
    conn.execute(
        "DELETE FROM ChildTable WHERE parent_type = ? AND parent_name = ? AND fieldname = ?",
        (parent_type, parent_name, fieldname)
    )
    for idx, row in enumerate(child_data):
        import json as _json
        row_id = str(uuid4())[:8]
        conn.execute(
            "INSERT INTO ChildTable (id, parent_type, parent_name, fieldname, idx, data) VALUES (?, ?, ?, ?, ?, ?)",
            (row_id, parent_type, parent_name, fieldname, idx, _json.dumps(row))
        )


def _load_child_rows(conn, parent_name: str, parent_type: str) -> dict:
    """Load all child table rows for a document."""
    rows = conn.execute(
        "SELECT fieldname, data FROM ChildTable WHERE parent_type = ? AND parent_name = ? ORDER BY fieldname, idx",
        (parent_type, parent_name)
    ).fetchall()

    result = {}
    for row in rows:
        fieldname = row[0] if isinstance(row, (tuple, list)) else row['fieldname']
        data_val = row[1] if isinstance(row, (tuple, list)) else row['data']
        if fieldname not in result:
            result[fieldname] = []
        result[fieldname].append(json.loads(data_val))
    return result


def update_doc(doc: Doc):
    """Update an existing document."""
    conn = get_connection()
    schema = doc.schema
    table_name = schema.name
    name = doc.get('name')

    fields = [f for f in schema.fields
              if not f.meta and not f.computed and f.fieldtype != "Table"]
    set_clause = ', '.join([f"{f.fieldname} = ?" for f in fields])
    set_clause += ", updated_at = datetime('now')"
    values = [doc.get(f.fieldname) for f in fields] + [name]

    conn.execute(
        f"UPDATE [{table_name}] SET {set_clause} WHERE name = ?",
        values
    )

    # Update child table rows
    for field in schema.fields:
        if field.fieldtype == "Table":
            child_data = doc.get(field.fieldname, [])
            if child_data:
                _save_child_rows(conn, name, table_name, field.fieldname, child_data)

    conn.commit()
    doc._dirty = False


def get_doc(schema_name: str, name: str) -> Optional[Doc]:
    """Fetch a single document by name."""
    conn = get_connection()
    schema = get_schema(schema_name)
    if not schema:
        return None

    row = conn.execute(
        f"SELECT * FROM [{schema_name}] WHERE name = ?", (name,)
    ).fetchone()
    if not row:
        return None

    data = dict(row)
    # Load child table rows
    child_data = _load_child_rows(conn, name, schema_name)
    data.update(child_data)

    doc = Doc(schema_name, data)
    doc._not_inserted = False
    return doc


def get_all_docs(
    schema_name: str,
    filters: Optional[dict] = None,
    order_by: Optional[str] = None,
    order: str = "asc",
    limit: Optional[int] = None,
) -> list[Doc]:
    """Fetch documents with optional filtering."""
    conn = get_connection()
    schema = get_schema(schema_name)
    if not schema:
        return []

    query = f"SELECT * FROM [{schema_name}]"
    params = []

    if filters:
        conditions = []
        for key, value in filters.items():
            if isinstance(value, list) and len(value) == 2 and value[0] == 'in':
                placeholders = ','.join(['?'] * len(value[1]))
                conditions.append(f"{key} IN ({placeholders})")
                params.extend(value[1])
            else:
                conditions.append(f"{key} = ?")
                params.append(value)
        if conditions:
            query += " WHERE " + " AND ".join(conditions)

    if order_by:
        query += f" ORDER BY {order_by} {order}"

    if limit:
        query += f" LIMIT {limit}"

    rows = conn.execute(query, params).fetchall()

    docs = []
    for r in rows:
        data = dict(r)
        child_data = _load_child_rows(conn, data.get('name', ''), schema_name)
        data.update(child_data)
        doc = Doc(schema_name, data)
        doc._not_inserted = False
        docs.append(doc)
    return docs


def delete_doc(schema_name: str, name: str):
    """Delete a document."""
    conn = get_connection()
    conn.execute(f"DELETE FROM [{schema_name}] WHERE name = ?", (name,))
    conn.execute(
        "DELETE FROM ChildTable WHERE parent_type = ? AND parent_name = ?",
        (schema_name, name)
    )
    conn.commit()


def get_single_value(key: str) -> Optional[str]:
    """Get a single value (EAV pattern)."""
    conn = get_connection()
    row = conn.execute(
        "SELECT value FROM SingleValue WHERE name = ?", (key,)
    ).fetchone()
    return row['value'] if row else None


def set_single_value(key: str, value: str):
    """Set a single value (EAV pattern)."""
    conn = get_connection()
    conn.execute(
        "INSERT OR REPLACE INTO SingleValue (name, value) VALUES (?, ?)",
        (key, value)
    )
    conn.commit()


def _get_next_series_number(conn, prefix: str) -> str:
    """Generate next number in a series (e.g. SINV-00001)."""
    series_key = f"series_counter_{prefix}"
    row = conn.execute(
        "SELECT value FROM SingleValue WHERE name = ?", (series_key,)
    ).fetchone()

    if row:
        next_num = int(row['value']) + 1
    else:
        next_num = 1

    conn.execute(
        "INSERT OR REPLACE INTO SingleValue (name, value) VALUES (?, ?)",
        (series_key, str(next_num))
    )
    conn.commit()

    return f"{prefix}{next_num:05d}"


def get_ledger_entries(
    filters: Optional[dict] = None,
    group_by: Optional[str] = None,
    exclude_reverted: bool = True,
) -> list[dict]:
    """
    Query accounting ledger entries.

    Args:
        filters: Optional dict of column=value filters.
        group_by: Optional column name to group by.
        exclude_reverted: If True (default), exclude reverted entries from totals.
    """
    conn = get_connection()

    if group_by:
        query = "SELECT account, SUM(debit) as total_debit, SUM(credit) as total_credit FROM AccountingLedgerEntry"
        conditions = []
        params = []
        if exclude_reverted:
            conditions.append("reverted = 0")
        if filters:
            for key, value in filters.items():
                conditions.append(f"{key} = ?")
                params.append(value)
        if conditions:
            query += " WHERE " + " AND ".join(conditions)
        query += f" GROUP BY {group_by}"
        rows = conn.execute(query, params).fetchall()
        return [dict(r) for r in rows]

    query = "SELECT * FROM AccountingLedgerEntry"
    params = []
    conditions = []

    if filters:
        for key, value in filters.items():
            conditions.append(f"{key} = ?")
            params.append(value)

    if conditions:
        query += " WHERE " + " AND ".join(conditions)

    query += " ORDER BY date ASC"

    rows = conn.execute(query, params).fetchall()
    return [dict(r) for r in rows]


def add_audit_log(ref_type: str, ref_name: str, action: str, details: str = ""):
    """Record an audit trail event for a document."""
    try:
        conn = get_connection()
        import uuid
        log_id = str(uuid.uuid4())[:8]
        ts = datetime.now().isoformat(timespec="seconds")
        conn.execute(
            "INSERT INTO AuditLog (id, reference_type, reference_name, action, details, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
            (log_id, ref_type, ref_name, action, details or "", ts)
        )
        conn.commit()
    except Exception as e:
        print(f"Error adding audit log: {e}")


def get_audit_logs(ref_type: str, ref_name: str) -> list:
    """Retrieve audit trail events for a document."""
    try:
        conn = get_connection()
        rows = conn.execute(
            "SELECT id, reference_type, reference_name, action, details, timestamp FROM AuditLog WHERE reference_type = ? AND reference_name = ? ORDER BY timestamp DESC",
            (ref_type, ref_name)
        ).fetchall()
        return [
            {
                "id": r[0] if isinstance(r, (tuple, list)) else r["id"],
                "reference_type": r[1] if isinstance(r, (tuple, list)) else r["reference_type"],
                "reference_name": r[2] if isinstance(r, (tuple, list)) else r["reference_name"],
                "action": r[3] if isinstance(r, (tuple, list)) else r["action"],
                "details": r[4] if isinstance(r, (tuple, list)) else r["details"],
                "timestamp": r[5] if isinstance(r, (tuple, list)) else r["timestamp"]
            }
            for r in rows
        ]
    except Exception as e:
        print(f"Error reading audit logs: {e}")
        return []
