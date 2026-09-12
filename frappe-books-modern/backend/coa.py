"""
Standard Chart of Accounts - IFRS/GAAP compliant.

Every account is classified as debit-natured (Assets, Expenses)
or credit-natured (Liabilities, Equity, Income) per accounting standards.

Tree structure: root -> group -> sub-account -> leaf account
Each account carries: name, rootType, accountType, accountNumber, isGroup, parentAccount
"""

# Account type constants
AT_DEPR = "Depreciation"
AT_ACC_DEPR = "Accumulated Depreciation"
AT_ACC_AMORT = "Accumulated Amortization"
AT_BANK = "Bank"
AT_CASH = "Cash"
AT_CHARGEABLE = "Chargeable"
AT_COGS = "Cost of Goods Sold"
AT_EQUITY = "Equity"
AT_EXPENSE = "Expense Account"
AT_EXP_VALUATION = "Expenses Included In Valuation"
AT_FIXED_ASSET = "Fixed Asset"
AT_INTANGIBLE = "Intangible Asset"
AT_INCOME = "Income Account"
AT_PAYABLE = "Payable"
AT_RECEIVABLE = "Receivable"
AT_ROUND_OFF = "Round Off"
AT_STOCK = "Stock"
AT_STOCK_ADJ = "Stock Adjustment"
AT_STOCK_RNB = "Stock Received But Not Billed"
AT_TAX = "Tax"
AT_TEMPORARY = "Temporary"
AT_PREPAYMENT = "Prepayment"
AT_DEFERRED_TAX = "Deferred Tax"
AT_PROVISION = "Provision"
AT_LEASE_LIAB = "Lease Liability"
AT_RESERVE = "Reserve"
AT_FINANCE_COST = "Finance Cost"
AT_MANUFACTURING = "Manufacturing Expense"

# Root types
RT_ASSET = "Asset"
RT_LIABILITY = "Liability"
RT_EQUITY = "Equity"
RT_INCOME = "Income"
RT_EXPENSE = "Expense"

# Debit-natured root types (normal debit balance)
DEBIT_ROOTS = {RT_ASSET, RT_EXPENSE}
# Credit-natured root types (normal credit balance)
CREDIT_ROOTS = {RT_LIABILITY, RT_EQUITY, RT_INCOME}


def is_debit(root_type: str) -> bool:
    """Returns True if accounts of this root type are debit-natured."""
    return root_type in DEBIT_ROOTS


def is_credit(root_type: str) -> bool:
    """Returns True if accounts of this root type are credit-natured."""
    return root_type in CREDIT_ROOTS


def normal_balance_side(root_type: str) -> str:
    """Returns 'Debit' or 'Credit' for the given root type."""
    return "Debit" if is_debit(root_type) else "Credit"


def get_account_balance(debit: float, credit: float, root_type: str) -> float:
    """
    Compute the normal balance for an account based on its root type.
    Assets/Expenses: balance = debit - credit (positive = debit balance)
    Liabilities/Equity/Income: balance = credit - debit (positive = credit balance)
    """
    if is_debit(root_type):
        return debit - credit
    return credit - debit


# ── Full standard Chart of Accounts tree ──────────────────────────
#
# Each entry: (name, account_number, root_type, account_type, is_group)
# parent_account is resolved sequentially: group accounts are parents
# of the accounts that follow them until another group at the same or
# higher level is encountered.

COA_TREE = [
    # ─── ASSETS (Debit) ───────────────────────────────────────────
    ("Assets", "1000", RT_ASSET, None, True),

    # Current Assets group
    ("Current Assets", "1100", RT_ASSET, None, True),
    # Accounts Receivable
    ("Accounts Receivable", "1110", RT_ASSET, None, True),
    ("Debtors", "1111", RT_ASSET, AT_RECEIVABLE, False),
    ("Staff Receivable", "1112", RT_ASSET, AT_RECEIVABLE, False),
    ("Allowance for Uncollectible Accounts", "1113", RT_ASSET, AT_RECEIVABLE, False),
    # Cash & Cash Equivalents
    ("Cash in Hand", "1120", RT_ASSET, None, True),
    ("Cash", "1121", RT_ASSET, AT_CASH, False),
    ("Petty Cash", "1122", RT_ASSET, AT_CASH, False),
    ("Bank Accounts", "1130", RT_ASSET, None, True),
    ("Bank", "1131", RT_ASSET, AT_BANK, False),
    ("Fixed Deposits", "1132", RT_ASSET, AT_BANK, False),
    # Stock / Inventories
    ("Stock Assets", "1140", RT_ASSET, None, True),
    ("Stock in Hand", "1141", RT_ASSET, AT_STOCK, False),
    ("Raw Materials", "1142", RT_ASSET, AT_STOCK, False),
    ("Work in Progress", "1143", RT_ASSET, AT_STOCK, False),
    ("Finished Goods", "1144", RT_ASSET, AT_STOCK, False),
    ("Goods in Transit", "1145", RT_ASSET, AT_STOCK, False),
    # Tax Assets
    ("Tax Assets", "1150", RT_ASSET, None, True),
    ("Input Tax Credit", "1151", RT_ASSET, AT_TAX, False),
    ("Advance Tax Paid", "1152", RT_ASSET, AT_TAX, False),
    ("VAT Receivable", "1153", RT_ASSET, AT_TAX, False),
    # Prepayments & Accruals (Assets)
    ("Prepayments and Accrued Income", "1155", RT_ASSET, None, True),
    ("Prepaid Rent", "1156", RT_ASSET, AT_PREPAYMENT, False),
    ("Prepaid Insurance", "1157", RT_ASSET, AT_PREPAYMENT, False),
    ("Accrued Interest Receivable", "1158", RT_ASSET, AT_PREPAYMENT, False),
    # Loans & Advances
    ("Loans and Advances (Assets)", "1160", RT_ASSET, None, True),
    ("Advances to Suppliers", "1161", RT_ASSET, AT_RECEIVABLE, False),
    ("Advances to Employees", "1162", RT_ASSET, AT_RECEIVABLE, False),
    ("Securities and Deposits", "1170", RT_ASSET, None, True),
    ("Earnest Money", "1171", RT_ASSET, None, False),

    # Non-Current Assets / Property, Plant & Equipment
    ("Property, Plant and Equipment", "1200", RT_ASSET, None, True),
    ("Land", "1201", RT_ASSET, AT_FIXED_ASSET, False),
    ("Buildings", "1202", RT_ASSET, AT_FIXED_ASSET, False),
    ("Plant and Machinery", "1203", RT_ASSET, AT_FIXED_ASSET, False),
    ("Furniture and Fixtures", "1204", RT_ASSET, AT_FIXED_ASSET, False),
    ("Office Equipment", "1205", RT_ASSET, AT_FIXED_ASSET, False),
    ("Electronic Equipment", "1206", RT_ASSET, AT_FIXED_ASSET, False),
    ("Vehicles", "1207", RT_ASSET, AT_FIXED_ASSET, False),
    ("Capital Work in Progress", "1208", RT_ASSET, AT_FIXED_ASSET, False),
    ("Accumulated Depreciation", "1210", RT_ASSET, AT_ACC_DEPR, False),

    # Intangible Assets
    ("Intangible Assets", "1250", RT_ASSET, None, True),
    ("Software", "1251", RT_ASSET, AT_INTANGIBLE, False),
    ("Patents and Trademarks", "1252", RT_ASSET, AT_INTANGIBLE, False),
    ("Goodwill", "1253", RT_ASSET, AT_INTANGIBLE, False),
    ("Accumulated Amortization", "1254", RT_ASSET, AT_ACC_AMORT, False),

    # Investments & Non-Current Assets
    ("Investments", "1300", RT_ASSET, None, True),
    ("Investments in Shares", "1301", RT_ASSET, None, False),
    ("Investments in Bonds", "1302", RT_ASSET, None, False),
    ("Investment Property", "1303", RT_ASSET, None, False),
    ("Deferred Tax Assets", "1350", RT_ASSET, AT_DEFERRED_TAX, False),

    # Temporary
    ("Temporary Accounts", "1900", RT_ASSET, None, True),
    ("Temporary Opening", "1901", RT_ASSET, AT_TEMPORARY, False),

    # ─── LIABILITIES (Credit) ─────────────────────────────────────
    ("Liabilities", "2000", RT_LIABILITY, None, True),

    # Current Liabilities
    ("Current Liabilities", "2100", RT_LIABILITY, None, True),
    ("Accounts Payable", "2110", RT_LIABILITY, None, True),
    ("Creditors", "2111", RT_LIABILITY, AT_PAYABLE, False),
    ("Payroll Payable", "2112", RT_LIABILITY, None, False),
    ("Accrued Salaries and Wages", "2113", RT_LIABILITY, None, False),
    # Stock Liabilities
    ("Stock Liabilities", "2120", RT_LIABILITY, None, True),
    ("Stock Received But Not Billed", "2121", RT_LIABILITY, AT_STOCK_RNB, False),
    # Duties and Taxes
    ("Duties and Taxes", "2130", RT_LIABILITY, None, True),
    ("Output Tax Payable", "2131", RT_LIABILITY, AT_TAX, False),
    ("Sales Tax Payable", "2132", RT_LIABILITY, AT_TAX, False),
    ("Income Tax Payable", "2133", RT_LIABILITY, AT_TAX, False),
    ("Tax Withheld at Source", "2134", RT_LIABILITY, AT_TAX, False),
    ("VAT Payable", "2135", RT_LIABILITY, AT_TAX, False),
    # Short-term Loans
    ("Loans (Liabilities)", "2140", RT_LIABILITY, None, True),
    ("Secured Loans", "2141", RT_LIABILITY, None, False),
    ("Unsecured Loans", "2142", RT_LIABILITY, None, False),
    ("Bank Overdraft Account", "2143", RT_LIABILITY, AT_BANK, False),
    ("Short-term Bank Loans", "2144", RT_LIABILITY, None, False),
    # Other Current Liabilities & Provisions
    ("Other Current Liabilities", "2150", RT_LIABILITY, None, True),
    ("Interest Payable", "2151", RT_LIABILITY, None, False),
    ("Accrued Expenses", "2152", RT_LIABILITY, AT_PROVISION, False),
    ("Advances from Customers", "2153", RT_LIABILITY, None, False),
    ("Unearned Revenue", "2154", RT_LIABILITY, None, False),
    ("Dividends Payable", "2155", RT_LIABILITY, None, False),
    ("Current Portion of Long-term Debt", "2156", RT_LIABILITY, None, False),

    # Non-Current Liabilities
    ("Non-Current Liabilities", "2200", RT_LIABILITY, None, True),
    ("Long-term Loans", "2201", RT_LIABILITY, None, False),
    ("Bonds and Debentures Payable", "2202", RT_LIABILITY, None, False),
    ("Lease Liabilities", "2203", RT_LIABILITY, AT_LEASE_LIAB, False),
    ("Deferred Tax Liabilities", "2204", RT_LIABILITY, AT_DEFERRED_TAX, False),
    ("Pension & Post-Employment Obligations", "2205", RT_LIABILITY, AT_PROVISION, False),

    # ─── EQUITY (Credit) ──────────────────────────────────────────
    ("Equity", "3000", RT_EQUITY, None, True),
    ("Capital Stock", "3100", RT_EQUITY, None, True),
    ("Share Capital", "3101", RT_EQUITY, AT_EQUITY, False),
    ("Share Premium", "3102", RT_EQUITY, AT_EQUITY, False),
    ("Owner's Capital", "3103", RT_EQUITY, AT_EQUITY, False),
    ("Owner's Drawings", "3104", RT_EQUITY, AT_EQUITY, False),
    ("Reserves & Surplus", "3200", RT_EQUITY, None, True),
    ("Retained Earnings", "3201", RT_EQUITY, AT_EQUITY, False),
    ("Revaluation Reserve", "3202", RT_EQUITY, AT_RESERVE, False),
    ("General Reserve", "3203", RT_EQUITY, AT_RESERVE, False),
    ("Opening Balance Equity", "3300", RT_EQUITY, AT_EQUITY, False),
    ("Dividends Paid", "3400", RT_EQUITY, AT_EQUITY, False),
    ("Round Off", "3900", RT_EQUITY, AT_ROUND_OFF, False),

    # ─── INCOME (Credit) ──────────────────────────────────────────
    ("Income", "4000", RT_INCOME, None, True),

    # Direct Income / Revenue
    ("Direct Income", "4100", RT_INCOME, None, True),
    ("Sales", "4101", RT_INCOME, AT_INCOME, False),
    ("Service", "4102", RT_INCOME, AT_INCOME, False),
    ("Product Sales", "4103", RT_INCOME, AT_INCOME, False),
    ("Export Sales", "4104", RT_INCOME, AT_INCOME, False),
    ("Fee Income", "4105", RT_INCOME, AT_INCOME, False),

    # Indirect Income
    ("Indirect Income", "4200", RT_INCOME, None, True),
    ("Interest Income", "4201", RT_INCOME, AT_INCOME, False),
    ("Discount Received", "4202", RT_INCOME, AT_INCOME, False),
    ("Exchange Gain", "4203", RT_INCOME, AT_INCOME, False),
    ("Gain on Asset Disposal", "4204", RT_INCOME, AT_INCOME, False),
    ("Other Income", "4205", RT_INCOME, AT_INCOME, False),
    ("Commission Received", "4206", RT_INCOME, AT_INCOME, False),
    ("Rental Income", "4207", RT_INCOME, AT_INCOME, False),
    ("Royalty Income", "4208", RT_INCOME, AT_INCOME, False),
    ("Dividend Income", "4209", RT_INCOME, AT_INCOME, False),

    # ─── EXPENSES (Debit) ─────────────────────────────────────────
    ("Expenses", "5000", RT_EXPENSE, None, True),

    # Direct Expenses / Cost of Sales
    ("Direct Expenses", "5100", RT_EXPENSE, None, True),
    ("Stock Expenses", "5110", RT_EXPENSE, None, True),
    ("Cost of Goods Sold", "5111", RT_EXPENSE, AT_COGS, False),
    ("Expenses Included In Valuation", "5112", RT_EXPENSE, AT_EXP_VALUATION, False),
    ("Stock Adjustment", "5113", RT_EXPENSE, AT_STOCK_ADJ, False),
    ("Direct Labour", "5114", RT_EXPENSE, AT_MANUFACTURING, False),
    ("Direct Material", "5115", RT_EXPENSE, AT_MANUFACTURING, False),
    ("Freight and Carriage Inwards", "5116", RT_EXPENSE, AT_COGS, False),
    ("Manufacturing Overheads", "5117", RT_EXPENSE, AT_MANUFACTURING, False),

    # Operating / Indirect Expenses
    ("Indirect Expenses", "5200", RT_EXPENSE, None, True),
    ("Salary and Wages", "5201", RT_EXPENSE, AT_EXPENSE, False),
    ("Employee Benefits and Welfare", "5202", RT_EXPENSE, AT_EXPENSE, False),
    ("Office Rent", "5203", RT_EXPENSE, AT_EXPENSE, False),
    ("Utility Expenses", "5204", RT_EXPENSE, AT_EXPENSE, False),
    ("Telephone Expenses", "5205", RT_EXPENSE, AT_EXPENSE, False),
    ("Internet Expenses", "5206", RT_EXPENSE, AT_EXPENSE, False),
    ("Travel Expenses", "5207", RT_EXPENSE, AT_EXPENSE, False),
    ("Office Maintenance Expenses", "5208", RT_EXPENSE, AT_EXPENSE, False),
    ("Print and Stationery", "5209", RT_EXPENSE, AT_EXPENSE, False),
    ("Postal Expenses", "5210", RT_EXPENSE, AT_EXPENSE, False),
    ("Legal Expenses", "5211", RT_EXPENSE, AT_EXPENSE, False),
    ("Marketing Expenses", "5212", RT_EXPENSE, AT_CHARGEABLE, False),
    ("Advertising Expenses", "5213", RT_EXPENSE, AT_EXPENSE, False),
    ("Administrative Expenses", "5214", RT_EXPENSE, AT_EXPENSE, False),
    ("Depreciation", "5215", RT_EXPENSE, AT_DEPR, False),
    ("Amortization Expense", "5216", RT_EXPENSE, AT_DEPR, False),
    ("Entertainment Expenses", "5217", RT_EXPENSE, AT_EXPENSE, False),
    ("Commission on Sales", "5218", RT_EXPENSE, AT_EXPENSE, False),
    ("Freight and Forwarding", "5219", RT_EXPENSE, AT_CHARGEABLE, False),
    ("Miscellaneous Expenses", "5220", RT_EXPENSE, AT_CHARGEABLE, False),
    ("Discount Allowed", "5221", RT_EXPENSE, AT_EXPENSE, False),
    ("Bank Charges", "5222", RT_EXPENSE, AT_FINANCE_COST, False),
    ("Interest Expense", "5223", RT_EXPENSE, AT_FINANCE_COST, False),
    ("Insurance Expenses", "5224", RT_EXPENSE, AT_EXPENSE, False),
    ("Repairs and Maintenance", "5225", RT_EXPENSE, AT_EXPENSE, False),
    ("Audit Fees", "5226", RT_EXPENSE, AT_EXPENSE, False),
    ("Consultancy Fees", "5227", RT_EXPENSE, AT_EXPENSE, False),
    ("Software Subscriptions", "5228", RT_EXPENSE, AT_EXPENSE, False),
    ("Exchange Gain/Loss", "5229", RT_EXPENSE, AT_FINANCE_COST, False),
    ("Gain/Loss on Asset Disposal", "5230", RT_EXPENSE, AT_EXPENSE, False),
    ("Write Off", "5231", RT_EXPENSE, AT_EXPENSE, False),
    ("Sales Expenses", "5232", RT_EXPENSE, AT_EXPENSE, False),
    ("Bad Debts", "5233", RT_EXPENSE, AT_EXPENSE, False),
]


def build_coa_hierarchy():
    """
    Build the COA as a flat list of dicts with parentAccount resolved.

    Uses a stack-based approach: group accounts at each level become
    parents for the accounts that follow, until a sibling or higher-level
    group is encountered.
    """
    result = []
    # Stack of (root_type, group_name) for parent resolution
    # Level 0 = root, Level 1 = first group under root, Level 2 = sub-group, etc.
    # We track group parents by root_type
    parent_stack = {}  # root_type -> list of group names (stack)

    for name, number, root_type, acct_type, is_group in COA_TREE:
        parent = None

        if root_type not in parent_stack:
            parent_stack[root_type] = []

        if parent_stack[root_type]:
            # Parent is the top of the stack for this root type
            parent = parent_stack[root_type][-1]

        result.append({
            "name": name,
            "accountNumber": number,
            "rootType": root_type,
            "accountType": acct_type or "",
            "isGroup": is_group,
            "parentAccount": parent or "",
            "balance": 0,
            "lft": 0,
            "rgt": 0,
        })

        if is_group:
            parent_stack[root_type].append(name)

    return result


def get_default_account(name: str) -> str:
    """Get a default account name by common alias."""
    aliases = {
        "receivable": "Debtors",
        "debtor": "Debtors",
        "debtors": "Debtors",
        "payable": "Creditors",
        "creditor": "Creditors",
        "creditors": "Creditors",
        "cash": "Cash",
        "bank": "Bank",
        "sales": "Sales",
        "cogs": "Cost of Goods Sold",
        "cost_of_goods_sold": "Cost of Goods Sold",
        "round_off": "Round Off",
        "roundoff": "Round Off",
        "depreciation": "Depreciation",
        "accumulated_depreciation": "Accumulated Depreciation",
        "tax": "Output Tax Payable",
        "output_tax": "Output Tax Payable",
        "input_tax": "Input Tax Credit",
        "retained_earnings": "Retained Earnings",
        "equity": "Share Capital",
        "capital": "Owner's Capital",
        "discount_allowed": "Discount Allowed",
        "discount_received": "Discount Received",
        "write_off": "Write Off",
        "round_off_equity": "Round Off",
        "opening_balance_equity": "Opening Balance Equity",
        "temporary": "Temporary Opening",
        "stock": "Stock in Hand",
        "stock_rnb": "Stock Received But Not Billed",
        "stock_adjustment": "Stock Adjustment",
    }
    return aliases.get(name.lower(), name)


def resolve_account_name(name: str) -> str:
    """Resolve user or AI provided account string to exact Chart of Accounts name."""
    if not name or not isinstance(name, str):
        return "Cash"
    name_clean = name.strip()
    all_names = {item[0] for item in COA_TREE}
    if name_clean in all_names:
        return name_clean

    lower_map = {item[0].lower(): item[0] for item in COA_TREE}
    if name_clean.lower() in lower_map:
        return lower_map[name_clean.lower()]

    alias = get_default_account(name_clean)
    if alias in all_names:
        return alias

    extra_aliases = {
        "sales revenue": "Sales",
        "revenue": "Sales",
        "cash sale": "Cash",
        "cash sales": "Cash",
        "sales account": "Sales",
        "cash account": "Cash",
        "bank account": "Bank",
        "office rent": "Office Rent",
        "rent": "Office Rent",
        "rent expense": "Office Rent",
        "salaries": "Salary and Wages",
        "salary": "Salary and Wages",
        "wages": "Salary and Wages",
        "electricity": "Utility Expenses",
        "utilities": "Utility Expenses",
        "utility": "Utility Expenses",
        "supplies": "Office Maintenance Expenses",
        "office supplies": "Office Maintenance Expenses",
        "consulting": "Consultancy Fees",
        "consulting revenue": "Service",
        "services": "Service",
        "receivables": "Debtors",
        "payables": "Creditors",
    }
    if name_clean.lower() in extra_aliases:
        return extra_aliases[name_clean.lower()]

    for item in COA_TREE:
        acct = item[0]
        if name_clean.lower() in acct.lower() or acct.lower() in name_clean.lower():
            return acct

    return name_clean

