"""
Bank Reconciliation Core Engine.
Provides bank statement import, intelligent multi-factor matching,
and 1-to-1 ledger entry reconciliation.
"""
from datetime import datetime, date
from decimal import Decimal
from typing import Any, Dict, List, Optional

from backend.core import database as db
from backend.models import get_model


def _amount_to_cents(val: float | Decimal) -> int:
    return int(round(Decimal(str(val)) * 100))


def import_bank_statement(
    company_id: str,
    account_name: str,
    statement_date: str,
    opening_balance: float,
    closing_balance: float,
    lines: List[Dict[str, Any]],
    user_remark: str = ""
) -> Dict[str, Any]:
    """Import a bank statement with transaction lines."""
    # Ensure account exists
    acct = db.get_doc("Account", account_name)
    if not acct:
        docs = db.get_all_docs("Account", {"name": account_name})
        if docs:
            acct = docs[0]
    if not acct:
        raise ValueError(f"Bank account '{account_name}' not found in Chart of Accounts.")

    recon_model = get_model("Reconciliation")
    payload = {
        "company_id": company_id,
        "account": acct.name,
        "date": statement_date or date.today().isoformat(),
        "openingBalance": opening_balance,
        "closingBalance": closing_balance,
        "status": "Draft",
        "userRemark": user_remark,
        "entries": [],
    }

    recon_doc = recon_model.create(payload)
    recon_model.save(recon_doc)

    # Save statement line items
    formatted_lines = []
    conn = db.get_connection()

    for idx, line in enumerate(lines):
        line_id = f"{recon_doc.name}-L{idx+1}"
        deposit = float(line.get("deposit", 0))
        withdrawal = float(line.get("withdrawal", 0))
        desc = line.get("description", "")
        ref_no = str(line.get("reference_number") or line.get("ref_no") or "")
        line_date = line.get("date") or statement_date

        item_data = {
            "id": line_id,
            "statement_id": recon_doc.name,
            "date": line_date,
            "description": desc,
            "reference_number": ref_no,
            "deposit": deposit,
            "withdrawal": withdrawal,
            "matched_ledger_entry_id": None,
            "match_status": "Unmatched",
            "match_score": 0.0,
        }

        # Store line item in ChildTable
        conn.execute(
            """
            INSERT INTO ChildTable (id, parent_type, parent_name, fieldname, idx, data)
            VALUES (?, 'Reconciliation', ?, 'entries', ?, ?)
            """,
            (line_id, recon_doc.name, idx, db.json.dumps(item_data))
        )
        formatted_lines.append(item_data)

    conn.commit()
    res = recon_doc.to_dict()
    res["entries"] = formatted_lines
    return res


def get_unmatched_ledger_entries(account_name: str, company_id: str = "default_company") -> List[Dict[str, Any]]:
    """Fetch all un-reconciled ledger entries for a given bank account."""
    all_entries = db.get_ledger_entries()
    unmatched = []

    for entry in all_entries:
        if entry.get("account") != account_name:
            continue
        if entry.get("reverted"):
            continue
        # Check if already reconciled
        if entry.get("reconciled"):
            continue
        unmatched.append(entry)

    return unmatched


def auto_match_bank_statement(reconciliation_name: str) -> Dict[str, Any]:
    """
    Intelligent multi-factor matching algorithm.
    Matches bank statement lines with unreconciled ledger entries by:
      - Exact amount (Deposit = Debit, Withdrawal = Credit) -> +0.50
      - Reference Number match -> +0.35
      - Date Proximity (<= 3 days) -> +0.15
    Threshold >= 0.70 triggers automatic match.
    """
    recon_doc = db.get_doc("Reconciliation", reconciliation_name)
    if not recon_doc:
        raise ValueError(f"Reconciliation statement '{reconciliation_name}' not found.")

    account_name = recon_doc.get("account")
    company_id = recon_doc.get("company_id") or "default_company"

    # Get statement lines
    conn = db.get_connection()
    rows = conn.execute(
        "SELECT id, idx, data FROM ChildTable WHERE parent_type = 'Reconciliation' AND parent_name = ? ORDER BY idx",
        (reconciliation_name,)
    ).fetchall()

    statement_lines = [db.json.loads(r[2]) for r in rows]
    unmatched_ledger = get_unmatched_ledger_entries(account_name, company_id)

    used_ledger_ids = set()
    auto_matched_count = 0

    for line in statement_lines:
        if line.get("match_status") in ["Manually-Matched", "Reconciled"]:
            if line.get("matched_ledger_entry_id"):
                used_ledger_ids.add(line["matched_ledger_entry_id"])
            continue

        best_candidate = None
        best_score = 0.0

        line_deposit_cents = _amount_to_cents(line.get("deposit", 0))
        line_withdrawal_cents = _amount_to_cents(line.get("withdrawal", 0))
        line_ref = (line.get("reference_number") or "").strip().lower()
        line_desc = (line.get("description") or "").strip().lower()
        line_dt = line.get("date", "")

        for l_entry in unmatched_ledger:
            l_name = l_entry.get("name")
            if l_name in used_ledger_ids:
                continue

            score = 0.0
            has_secondary_factor = False
            l_debit_cents = _amount_to_cents(l_entry.get("debit", 0))
            l_credit_cents = _amount_to_cents(l_entry.get("credit", 0))

            # Amount matching
            amount_matched = False
            if line_deposit_cents > 0 and line_deposit_cents == l_debit_cents:
                amount_matched = True
            elif line_withdrawal_cents > 0 and line_withdrawal_cents == l_credit_cents:
                amount_matched = True

            if not amount_matched:
                continue

            score += 0.50  # Base exact amount match

            # Reference / Description matching (+0.30)
            l_party = (l_entry.get("party") or "").strip().lower()
            l_ref = (l_entry.get("reference_name") or "").strip().lower()

            if line_ref and ((l_ref and line_ref in l_ref) or (l_party and line_ref in l_party)):
                score += 0.30
                has_secondary_factor = True
            elif line_desc and ((l_ref and l_ref in line_desc) or (l_party and l_party in line_desc)):
                score += 0.30
                has_secondary_factor = True

            # Date proximity (+0.20 for same day, +0.10 for <= 3 days)
            l_dt = l_entry.get("date", "")
            if line_dt and l_dt:
                try:
                    d1 = datetime.strptime(line_dt, "%Y-%m-%d").date()
                    d2 = datetime.strptime(l_dt, "%Y-%m-%d").date()
                    diff = abs((d1 - d2).days)
                    if diff == 0:
                        score += 0.20
                        has_secondary_factor = True
                    elif diff <= 3:
                        score += 0.10
                        has_secondary_factor = True
                except ValueError:
                    pass

            # SAFETY GUARD: Require amount + secondary factor (reference OR date proximity). Amount alone is insufficient!
            if has_secondary_factor and score > best_score:
                best_score = score
                best_candidate = l_entry

        if best_candidate and best_score >= 0.70:
            line["matched_ledger_entry_id"] = best_candidate["name"]
            line["match_status"] = "Auto-Matched"
            line["match_score"] = round(best_score, 2)
            used_ledger_ids.add(best_candidate["name"])
            auto_matched_count += 1

            # Update line in database
            conn.execute(
                "UPDATE ChildTable SET data = ? WHERE id = ?",
                (db.json.dumps(line), line["id"])
            )

            db.add_audit_log(
                ref_type="Reconciliation",
                ref_name=reconciliation_name,
                action="AUTO_MATCH",
                details=(
                    f"Matched line '{line['id']}' (${line.get('deposit') or line.get('withdrawal')}) "
                    f"with ledger entry '{best_candidate['name']}' (Score: {best_score:.2f})"
                )
            )

    conn.commit()

    return {
        "reconciliation_name": reconciliation_name,
        "total_lines": len(statement_lines),
        "auto_matched_count": auto_matched_count,
        "unmatched_count": len(statement_lines) - auto_matched_count,
        "lines": statement_lines,
    }


async def reconcile_bank_statement(
    reconciliation_name: str,
    matches_override: Optional[List[Dict[str, str]]] = None
) -> Dict[str, Any]:
    """
    Finalizes bank reconciliation.
    Marks matched ledger entries as reconciled (reconciled=1) and submits Reconciliation statement.
    """
    recon_doc = db.get_doc("Reconciliation", reconciliation_name)
    if not recon_doc:
        raise ValueError(f"Reconciliation statement '{reconciliation_name}' not found.")

    conn = db.get_connection()
    rows = conn.execute(
        "SELECT id, idx, data FROM ChildTable WHERE parent_type = 'Reconciliation' AND parent_name = ? ORDER BY idx",
        (reconciliation_name,)
    ).fetchall()

    statement_lines = [db.json.loads(r[2]) for r in rows]

    # Apply manual match overrides if passed
    if matches_override:
        override_map = {m["line_id"]: m["ledger_entry_id"] for m in matches_override if "line_id" in m and "ledger_entry_id" in m}
        for line in statement_lines:
            lid = line.get("id")
            if lid in override_map:
                line["matched_ledger_entry_id"] = override_map[lid]
                line["match_status"] = "Manually-Matched"
                line["match_score"] = 1.0
                conn.execute(
                    "UPDATE ChildTable SET data = ? WHERE id = ?",
                    (db.json.dumps(line), lid)
                )

    # Reconcile matching ledger entries
    reconciled_count = 0
    for line in statement_lines:
        matched_id = line.get("matched_ledger_entry_id")
        if matched_id:
            # Mark ledger entry as reconciled in database
            conn.execute(
                "UPDATE AccountingLedgerEntry SET reconciled = 1, reconciliation_id = ? WHERE name = ?",
                (reconciliation_name, matched_id)
            )
            line["match_status"] = "Reconciled"
            conn.execute(
                "UPDATE ChildTable SET data = ? WHERE id = ?",
                (db.json.dumps(line), line["id"])
            )
            reconciled_count += 1

    conn.commit()

    # Submit Reconciliation document
    recon_model = get_model("Reconciliation")
    await recon_model.before_sync(recon_doc)
    recon_model.save(recon_doc)
    await recon_model.after_submit(recon_doc)

    db.add_audit_log(
        ref_type="Reconciliation",
        ref_name=reconciliation_name,
        action="RECONCILED",
        details=f"Reconciled {reconciled_count} bank statement transactions with ledger entries."
    )

    res = recon_doc.to_dict()
    res["entries"] = statement_lines
    res["reconciled_count"] = reconciled_count
    return res


async def unreconcile_bank_statement(reconciliation_name: str) -> Dict[str, Any]:
    """
    Un-reconciles a completed bank statement.
    Resets reconciled ledger entries (reconciled=0) and unlocks reconciliation statement.
    """
    recon_doc = db.get_doc("Reconciliation", reconciliation_name)
    if not recon_doc:
        raise ValueError(f"Reconciliation statement '{reconciliation_name}' not found.")

    conn = db.get_connection()

    # Reset ledger entries
    conn.execute(
        "UPDATE AccountingLedgerEntry SET reconciled = 0, reconciliation_id = '' WHERE reconciliation_id = ?",
        (reconciliation_name,)
    )

    # Reset statement lines
    rows = conn.execute(
        "SELECT id, idx, data FROM ChildTable WHERE parent_type = 'Reconciliation' AND parent_name = ? ORDER BY idx",
        (reconciliation_name,)
    ).fetchall()

    statement_lines = [db.json.loads(r[2]) for r in rows]
    for line in statement_lines:
        line["match_status"] = "Unmatched"
        line["matched_ledger_entry_id"] = None
        conn.execute(
            "UPDATE ChildTable SET data = ? WHERE id = ?",
            (db.json.dumps(line), line["id"])
        )

    conn.commit()

    # Reset document status to Draft
    recon_model = get_model("Reconciliation")
    await recon_model.after_cancel(recon_doc)

    db.add_audit_log(
        ref_type="Reconciliation",
        ref_name=reconciliation_name,
        action="UNRECONCILED",
        details="Unlocked reconciliation statement and reset ledger entry reconciliation statuses."
    )

    res = recon_doc.to_dict()
    res["entries"] = statement_lines
    return res

