"""
AI Agent Security Helpers.

Gap 1: Idempotency key generation for AI-initiated ledger writes.
Gap 3: Prompt injection sanitizer for OCR-extracted and user-provided text.
Gap 4: Entity resolver for ambiguous party lookups.
"""
import hashlib
import logging
import re
import time
from typing import Any, Dict, List, Optional, Tuple

from backend.core import database as db

logger = logging.getLogger(__name__)


# ─── Gap 1: Idempotency Keys ─────────────────────────────────────────────

def generate_idempotency_key(user_message: str, user_id: str = "default") -> str:
    """Generate a deterministic idempotency key for AI-initiated writes.

    Format: ai:{user_id}:{sha256(user_message)[:16]}:{minute_bucket}

    Same message within the same minute always produces the same key,
    so network retries or double-clicks are idempotent.
    """
    msg_hash = hashlib.sha256(user_message.encode()).hexdigest()[:16]
    minute_bucket = int(time.time() // 60)
    return f"ai:{user_id}:{msg_hash}:{minute_bucket}"


def check_idempotency_key(idempotency_key: str) -> Optional[Dict[str, Any]]:
    """Return the existing JournalEntry dict if a duplicate key is found, else None."""
    if not idempotency_key:
        return None
    existing = db.get_all_docs("JournalEntry", {"idempotency_key": idempotency_key})
    if existing:
        logger.warning(
            "Idempotency: duplicate AI write detected for key '%s'. "
            "Returning existing JournalEntry '%s'.",
            idempotency_key,
            existing[0].get("name"),
        )
        return existing[0].to_dict()
    return None


# ─── Gap 3: Prompt Injection Sanitizer ────────────────────────────────────

_INJECTION_PATTERNS: List[re.Pattern] = [
    re.compile(r"ignore\s+(all\s+)?(previous|prior|above)\s+instructions?", re.IGNORECASE),
    re.compile(r"disregard\s+(all\s+)?(previous|prior|above)\s+instructions?", re.IGNORECASE),
    re.compile(r"you\s+are\s+(now|actually)\s+(?:a|an)\s+", re.IGNORECASE),
    re.compile(r"(?:new|system|override)\s+instructions?\s*:", re.IGNORECASE),
    re.compile(r"forget\s+(everything|all|previous)", re.IGNORECASE),
    re.compile(r"act\s+as\s+(if|a|an)\s+", re.IGNORECASE),
    re.compile(r"pretend\s+(you\s+are|to\s+be)\s+", re.IGNORECASE),
    re.compile(r"system\s+prompt", re.IGNORECASE),
    re.compile(r"<\|?(?:system|im_start|im_end|endoftext)\|?>", re.IGNORECASE),
    re.compile(r"###\s*(?:system|instruction|admin)", re.IGNORECASE),
    re.compile(r"(?:execute|run|eval)\s+(?:python|code|command|sql)", re.IGNORECASE),
    re.compile(r"rm\s+-rf", re.IGNORECASE),
    re.compile(r"(?:drop|delete|truncate)\s+table", re.IGNORECASE),
    re.compile(r"(?:;|\||&&|\|\||`|\$\()", re.IGNORECASE),
]

_SQL_INJECTION = re.compile(
    r"(?:union\s+select|information_schema|pg_sleep|benchmark\s*\(|load_file\s*\(|"
    r"xp_cmdshell|sp_executesql|exec\s*\(|eval\s*\(|os\.system|subprocess)",
    re.IGNORECASE,
)


def sanitize_text(text: str) -> str:
    """Strip prompt-injection and SQL-injection patterns from text.

    Intended for OCR-extracted descriptions and user-provided remarks
    that will be stored in ledger entries.
    """
    if not text:
        return ""
    cleaned = text
    for pattern in _INJECTION_PATTERNS:
        cleaned = pattern.sub("[FILTERED]", cleaned)
    cleaned = _SQL_INJECTION.sub("[FILTERED]", cleaned)
    if len(cleaned) > 500:
        cleaned = cleaned[:500]
    return cleaned.strip()


def has_injection_patterns(text: str) -> Tuple[bool, List[str]]:
    """Return (has_injection, list_of_matched_pattern_strings)."""
    if not text:
        return False, []
    matched: List[str] = []
    for pattern in _INJECTION_PATTERNS:
        m = pattern.search(text)
        if m:
            matched.append(m.group(0))
    sql_m = _SQL_INJECTION.search(text)
    if sql_m:
        matched.append(sql_m.group(0))
    return len(matched) > 0, matched


# ─── Gap 4: Entity Resolver ──────────────────────────────────────────────

def resolve_party(
    query: str, party_type: str = "", limit: int = 5
) -> Dict[str, Any]:
    """Resolve a party name from a natural-language query.

    Returns one of:
      {"status": "resolved",    "party": {...}, "candidates": []}
      {"status": "ambiguous",   "candidates": [...], "message": "..."}
      {"status": "not_found",   "candidates": [], "suggestions": [...], "message": "..."}
    """
    if not query or not query.strip():
        return {
            "status": "not_found",
            "candidates": [],
            "suggestions": [],
            "message": "No party name provided.",
        }

    query_clean = query.strip().lower()
    filters: Dict[str, Any] = {}
    if party_type:
        filters["partyType"] = party_type

    all_parties = db.get_all_docs("Party", filters=filters if filters else None)
    party_dicts = [p.to_dict() for p in all_parties]

    # 1. Exact match (case-insensitive)
    exact = [p for p in party_dicts if p.get("name", "").lower() == query_clean]
    if len(exact) == 1:
        return {"status": "resolved", "party": exact[0], "candidates": []}

    # 2. Partial matches (name contains query or vice-versa)
    partial = [
        p
        for p in party_dicts
        if query_clean in p.get("name", "").lower()
        or p.get("name", "").lower() in query_clean
    ]
    if len(partial) == 1:
        return {"status": "resolved", "party": partial[0], "candidates": []}

    if len(partial) > 1:
        return {
            "status": "ambiguous",
            "candidates": partial[:limit],
            "message": (
                f"Found {len(partial)} parties matching '{query}'. "
                "Please specify which one you mean."
            ),
        }

    # 3. No match — offer suggestions
    query_words = query_clean.split()
    suggestions: List[Dict[str, Any]] = []
    if query_words:
        first_word = query_words[0]
        suggestions = [
            p for p in party_dicts if p.get("name", "").lower().startswith(first_word)
        ][:limit]
    if not suggestions and party_dicts:
        suggestions = party_dicts[:limit]

    return {
        "status": "not_found",
        "candidates": [],
        "suggestions": suggestions,
        "message": (
            f"No party found matching '{query}'. "
            f"Would you like to create a new party named '{query}'?"
        ),
    }
