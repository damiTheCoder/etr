"""
Custom accounting and settings exceptions.
"""

class SettingsIncompleteError(Exception):
    """Raised when a required default account mapping is missing in company settings."""
    def __init__(self, field_name: str, message: str = None):
        self.field_name = field_name
        self.message = message or f"Default account for '{field_name}' is not configured in Settings."
        super().__init__(self.message)


class AccountTypeMismatchError(Exception):
    """Raised when a mapped account does not match the required root or account type."""
    def __init__(self, account_name: str, expected_type: str, actual_type: str):
        self.account_name = account_name
        self.expected_type = expected_type
        self.actual_type = actual_type
        self.message = f"Account '{account_name}' must be of type '{expected_type}', but got '{actual_type}'."
        super().__init__(self.message)


class UnbalancedEntryError(Exception):
    """Raised when total debits in integer cents do not equal total credits in integer cents."""
    def __init__(self, total_debits: int, total_credits: int):
        self.total_debits = total_debits
        self.total_credits = total_credits
        self.message = f"Unbalanced Journal Entry: Debits ({total_debits} cents) != Credits ({total_credits} cents)."
        super().__init__(self.message)


class PeriodClosedError(Exception):
    """Raised when attempting to post a journal entry into a CLOSED or LOCKED fiscal period."""
    def __init__(self, period_label: str, message: str = None):
        self.period_label = period_label
        self.message = message or f"Cannot post to closed period '{period_label}'. Contact an administrator to reopen the period."
        super().__init__(self.message)

