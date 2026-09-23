"""
Account categorizer for OCR-extracted transactions.
Maps bank statement narrations to Chart of Accounts using keyword matching.

P0-FIX-1: Calls validate_direction() to flag suspicious DR/CR combinations.
"""
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Keyword rules: (keywords_frozenset, account_name, root_type)
KEYWORD_RULES: list[tuple[frozenset[str], str, str]] = [
    (frozenset(["transfer", "nip", "interbank", "nibss"]), "Cash", "Asset"),
    (frozenset(["salary", "payroll", "wages", "staff"]), "Salaries Expense", "Expense"),
    (frozenset(["vat", "firs", "tax", "wht", "withholding"]), "Tax Expense", "Expense"),
    (frozenset(["rent", "lease", "tenancy"]), "Rent Expense", "Expense"),
    (frozenset(["diesel", "fuel", "petrol"]), "Fuel & Power Expense", "Expense"),
    (frozenset(["airtime", "data", "mtn", "airtel", "glo", "gloworld", "etisalat", "9mobile"]),
     "Communication Expense", "Expense"),
    (frozenset(["commission", "agency fee", "brokerage"]), "Professional Fees", "Expense"),
    (frozenset(["insurance", "premium"]), "Insurance Expense", "Expense"),
    (frozenset(["interest", "int earned"]), "Interest Income", "Income"),
    (frozenset(["charge", "fee", "maintenance fee", "sms alert", "stamp duty", "bank charge"]),
     "Bank Charges", "Expense"),
    (frozenset(["pos", "point of sale"]), "Sales Revenue", "Income"),
]


def _match_keywords(description: str) -> tuple[Optional[str], Optional[str], float]:
    """
    Match description against keyword rules.
    Returns (account_name, root_type, confidence).
    """
    import re
    desc_lower = description.lower()
    words = desc_lower.split()
    first_five = " ".join(words[:5])

    for keywords, account, root_type in KEYWORD_RULES:
        # Check for word boundary match in first 5 words (higher confidence)
        for kw in keywords:
            pattern = r'\b' + re.escape(kw) + r'\b'
            if re.search(pattern, first_five):
                return account, root_type, 0.95

    for keywords, account, root_type in KEYWORD_RULES:
        # Check anywhere in description
        for kw in keywords:
            pattern = r'\b' + re.escape(kw) + r'\b'
            if re.search(pattern, desc_lower):
                return account, root_type, 0.85

    return None, None, 0.50


def _resolve_account(target_name: str, target_root: str, accounts: list[dict]) -> tuple[str, str]:
    """
    Look up target account name in the accounts list.
    Returns (resolved_name, resolved_root_type).
    """
    if not accounts:
        return target_name, target_root

    for acct in accounts:
        name = acct.get("name", "") or acct.get("accountName", "")
        if name.lower() == target_name.lower():
            return name, acct.get("rootType", target_root)

    # Partial match
    for acct in accounts:
        name = acct.get("name", "") or acct.get("accountName", "")
        if target_name.lower() in name.lower():
            return name, acct.get("rootType", target_root)

    return target_name, target_root


def categorize_transaction(
    description: str,
    amount: float,
    direction: str,
    accounts: Optional[list[dict]] = None,
) -> dict:
    """
    Categorize a transaction into a Chart of Accounts entry.

    Args:
        description: Bank narration / transaction description.
        amount: Transaction amount (absolute value).
        direction: 'debit' or 'credit'.
        accounts: Optional list of account dicts from database.

    Returns:
        {
            'account': str,
            'root_type': str,
            'confidence': float,
            'flagged_for_review': bool,
            'flag_reason': str | None,
        }
    """
    # Load accounts from DB if not provided
    if accounts is None:
        try:
            from backend.core import database as db
            accounts = [a.to_dict() for a in db.get_all_docs("Account")]
        except Exception as e:
            logger.warning("Could not load accounts from DB: %s", e)
            accounts = []

    # Keyword matching
    matched_name, matched_root, confidence = _match_keywords(description)

    flagged = False
    flag_reason = None

    if matched_name is None:
        # No keyword match — use direction-based defaults
        if direction == "credit":
            matched_name = "Sales Revenue"
            matched_root = "Income"
            flagged = True
            flag_reason = "Unmatched credit — defaulted to Sales Revenue"
        else:
            matched_name = "Miscellaneous Expense"
            matched_root = "Expense"
            flagged = True
            flag_reason = "Unmatched debit — defaulted to Miscellaneous Expense"
        confidence = 0.50

    # Resolve against actual Chart of Accounts
    resolved_name, resolved_root = _resolve_account(matched_name, matched_root, accounts)

    # P0-FIX-1: DR/CR direction sanity check
    try:
        from backend.api.document_parser import validate_direction
        is_suspicious, reason = validate_direction(direction, resolved_root)
        if is_suspicious:
            flagged = True
            if flag_reason:
                flag_reason = f"{flag_reason}; {reason}"
            else:
                flag_reason = reason
    except ImportError:
        pass  # Module not available — skip validation

    return {
        "account": resolved_name,
        "root_type": resolved_root,
        "confidence": confidence,
        "flagged_for_review": flagged,
        "flag_reason": flag_reason,
    }
