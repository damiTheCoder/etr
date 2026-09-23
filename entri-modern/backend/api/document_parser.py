"""
Deterministic document parser for bank statements, invoices, and vouchers.
All amounts extracted via regex — zero AI guessing.

P0-FIX-1: DR/CR direction sanity check (validate_direction)
P0-FIX-8: Negative amount / reversal detection
"""
import re
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# --- Compiled regex patterns ---

# Amount pattern: optional minus, optional currency symbol, digits with commas, optional decimals, optional DR/CR
# P0-FIX-8: Captures leading minus for reversals
_AMOUNT_RE = re.compile(
    r'(-?)\s*[₦N#]?\s*([\d,]+\.?\d{0,2})\s*(DR|CR|dr|cr|Dr|Cr)?'
)

# Date patterns by bank
_DATE_PATTERNS = {
    "gtbank": re.compile(r'(\d{1,2})[/\-](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[/\-](\d{4})', re.IGNORECASE),
    "access": re.compile(r'(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})'),
    "zenith": re.compile(r'(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})'),
    "generic_ymd": re.compile(r'(\d{4})[/\-](\d{1,2})[/\-](\d{1,2})'),
    "generic_dmy": re.compile(r'(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})'),
    "generic_dmy_named": re.compile(r'(\d{1,2})[/\-](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[/\-](\d{4})', re.IGNORECASE),
}

# Bank detection keywords
_BANK_SIGNATURES = {
    "gtbank": ["guaranty trust", "gtbank", "gtb"],
    "access": ["access bank"],
    "zenith": ["zenith bank", "zenith"],
}

# Balance / total detection
_BALANCE_RE = re.compile(r'(closing\s*balance|total\s*balance|balance\s*c/f|ending\s*balance)', re.IGNORECASE)
_OPENING_RE = re.compile(r'(opening\s*balance|balance\s*b/f|beginning\s*balance)', re.IGNORECASE)


def detect_document_type(raw_lines: list[str]) -> str:
    """Classify document as bank_statement, invoice, voucher, or unknown."""
    text = " ".join(raw_lines).lower()

    bank_kw = ["statement", "account number", "opening balance", "closing balance", "transaction"]
    invoice_kw = ["invoice", "bill to", "subtotal", "total due", "amount due"]
    voucher_kw = ["voucher", "payee", "payment voucher"]

    bank_score = sum(1 for kw in bank_kw if kw in text)
    invoice_score = sum(1 for kw in invoice_kw if kw in text)
    voucher_score = sum(1 for kw in voucher_kw if kw in text)

    if bank_score >= 2:
        return "bank_statement"
    if invoice_score >= 2:
        return "invoice"
    if voucher_score >= 2:
        return "voucher"
    if bank_score >= 1 and ("debit" in text or "credit" in text):
        return "bank_statement"
    return "unknown"


def detect_bank(raw_lines: list[str]) -> str:
    """Detect which Nigerian bank issued the statement."""
    text = " ".join(raw_lines).lower()
    for bank, keywords in _BANK_SIGNATURES.items():
        for kw in keywords:
            if kw in text:
                return bank
    return "generic"


def _extract_amount(text: str) -> Optional[tuple[float, str]]:
    """
    Extract amount and direction from a text string.
    P0-FIX-8: Handles negative amounts (reversals).
    
    Returns (amount, direction) or None.
    """
    matches = _AMOUNT_RE.findall(text)
    if not matches:
        return None

    # Find the best match — the one with the largest numeric value (likely the transaction amount)
    best = None
    best_val = -1

    for sign, num_str, dr_cr in matches:
        num_str_clean = num_str.replace(",", "")
        if not num_str_clean or num_str_clean == ".":
            continue
        try:
            val = float(num_str_clean)
        except ValueError:
            continue

        if val > best_val:
            best_val = val
            is_negative = sign == "-"
            direction = "credit" if dr_cr.upper() == "CR" else "debit" if dr_cr.upper() == "DR" else None
            if is_negative:
                val = -val
            best = (val, direction)

    return best


def _extract_date(text: str, bank: str) -> Optional[str]:
    """Extract date string from a line, using bank-specific format."""
    if bank in _DATE_PATTERNS:
        m = _DATE_PATTERNS[bank].search(text)
        if m:
            return m.group(0)

    # Fallback: try all generic patterns
    for key in ["generic_dmy_named", "generic_ymd", "generic_dmy"]:
        m = _DATE_PATTERNS[key].search(text)
        if m:
            return m.group(0)
    return None


def _extract_balance(raw_lines: list[str], pattern: re.Pattern) -> Optional[float]:
    """Extract a balance value from lines matching a pattern."""
    for line in raw_lines:
        if pattern.search(line):
            amt = _extract_amount(line)
            if amt:
                return abs(amt[0])
    return None


def validate_direction(direction: str, account_root_type: str) -> tuple[bool, Optional[str]]:
    """
    P0-FIX-1: Check if DR/CR direction is suspicious for the account type.
    
    Returns (is_suspicious, reason).
    """
    if direction == "debit" and account_root_type == "Income":
        return True, "Debit to Income account is unusual"
    if direction == "credit" and account_root_type == "Expense":
        return True, "Credit to Expense account is unusual"
    return False, None


def parse_bank_statement(
    raw_lines: list[str],
    bank: str,
    confidence_scores: Optional[list[float]] = None,
) -> dict:
    """
    Parse bank statement lines into structured transactions.
    
    Returns:
        {
            'transactions': list[dict],
            'header_total': float | None,
            'opening_balance': float | None,
            'closing_balance': float | None,
            'total_mismatch': bool,
        }
    """
    transactions = []
    opening_balance = _extract_balance(raw_lines, _OPENING_RE)
    closing_balance = _extract_balance(raw_lines, _BALANCE_RE)

    if confidence_scores is None:
        confidence_scores = [1.0] * len(raw_lines)

    for i, line in enumerate(raw_lines):
        # Skip header/balance lines
        if _BALANCE_RE.search(line) or _OPENING_RE.search(line):
            continue
        if len(line.strip()) < 5:
            continue

        date_str = _extract_date(line, bank)
        amt_result = _extract_amount(line)

        if amt_result is None:
            continue
        amount, direction = amt_result
        if amount == 0:
            continue

        # If no explicit DR/CR, infer: negative = credit for reversals
        if direction is None:
            direction = "credit" if amount < 0 else "debit"

        conf = confidence_scores[i] if i < len(confidence_scores) else 1.0
        flagged = conf < 0.80
        flag_reason = "Low OCR confidence" if flagged else None

        # Build description: strip date and amount from the line to get narration
        description = line.strip()

        transactions.append({
            "date": date_str or "",
            "description": description,
            "amount": abs(amount),
            "direction": direction,
            "raw_line": line,
            "line_index": i,
            "confidence": round(conf, 4),
            "flagged_for_review": flagged,
            "flag_reason": flag_reason,
        })

    # Total reconciliation
    total_mismatch = False
    header_total = None

    if opening_balance is not None and closing_balance is not None:
        header_total = closing_balance
        expected_net = closing_balance - opening_balance
        actual_net = sum(
            t["amount"] if t["direction"] == "credit" else -t["amount"]
            for t in transactions
        )
        if abs(expected_net - actual_net) > 0.01:
            total_mismatch = True
            logger.warning(
                "Total mismatch: expected net %.2f, got %.2f (diff: %.2f)",
                expected_net, actual_net, abs(expected_net - actual_net),
            )

    return {
        "transactions": transactions,
        "header_total": header_total,
        "opening_balance": opening_balance,
        "closing_balance": closing_balance,
        "total_mismatch": total_mismatch,
    }


def parse_invoice(raw_lines: list[str]) -> dict:
    """Extract structured data from an invoice."""
    result = {"vendor": None, "date": None, "items": [], "total": None, "error": None}
    text = " ".join(raw_lines).lower()

    # Extract vendor
    for i, line in enumerate(raw_lines):
        ll = line.lower()
        if any(kw in ll for kw in ["from:", "vendor:", "supplier:", "bill from"]):
            # Vendor name is usually on the next line or after the colon
            parts = line.split(":", 1)
            if len(parts) > 1 and parts[1].strip():
                result["vendor"] = parts[1].strip()
            elif i + 1 < len(raw_lines):
                result["vendor"] = raw_lines[i + 1].strip()
            break

    # Extract date
    for line in raw_lines:
        d = _extract_date(line, "generic")
        if d:
            result["date"] = d
            break

    # Extract total
    for line in raw_lines:
        ll = line.lower()
        if any(kw in ll for kw in ["total", "amount due", "grand total", "balance due"]):
            amt = _extract_amount(line)
            if amt:
                result["total"] = abs(amt[0])
                break

    # Extract line items (lines with amounts that aren't the total)
    for line in raw_lines:
        ll = line.lower()
        if any(kw in ll for kw in ["total", "subtotal", "tax", "vat", "discount"]):
            continue
        amt = _extract_amount(line)
        if amt and abs(amt[0]) > 0:
            result["items"].append({
                "description": line.strip(),
                "qty": 1.0,
                "rate": abs(amt[0]),
                "amount": abs(amt[0]),
            })

    return result


def parse_voucher(raw_lines: list[str]) -> dict:
    """Extract structured data from a payment voucher."""
    result = {"payee": None, "date": None, "amount": None, "narration": None, "error": None}

    for i, line in enumerate(raw_lines):
        ll = line.lower()
        if "payee" in ll or "paid to" in ll or "pay to" in ll:
            parts = line.split(":", 1)
            if len(parts) > 1 and parts[1].strip():
                result["payee"] = parts[1].strip()
            elif i + 1 < len(raw_lines):
                result["payee"] = raw_lines[i + 1].strip()

        if "narration" in ll or "description" in ll or "purpose" in ll:
            parts = line.split(":", 1)
            if len(parts) > 1:
                result["narration"] = parts[1].strip()

        if result["date"] is None:
            d = _extract_date(line, "generic")
            if d:
                result["date"] = d

        if result["amount"] is None:
            if "amount" in ll or "sum" in ll or "total" in ll:
                amt = _extract_amount(line)
                if amt:
                    result["amount"] = abs(amt[0])

    # If no labeled amount, find the largest amount in the document
    if result["amount"] is None:
        max_amt = 0
        for line in raw_lines:
            amt = _extract_amount(line)
            if amt and abs(amt[0]) > max_amt:
                max_amt = abs(amt[0])
        if max_amt > 0:
            result["amount"] = max_amt

    return result
