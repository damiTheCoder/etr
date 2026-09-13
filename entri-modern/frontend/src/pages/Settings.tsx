import React, { useEffect, useState } from 'react'
import { api } from '@/utils/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  Building2, 
  Coins, 
  Calendar, 
  Receipt, 
  CreditCard, 
  Wallet, 
  Building, 
  CheckCircle2, 
  AlertCircle, 
  Save, 
  RefreshCw, 
  Sliders, 
  ShieldCheck,
  Scale
} from 'lucide-react'

function ensureString(val: any, fallback: string = ''): string {
  if (val === null || val === undefined) return fallback
  if (typeof val === 'string') {
    if (val === '[object Object]' || val.startsWith('{')) {
      try {
        const parsed = JSON.parse(val)
        if (parsed && typeof parsed === 'object' && 'value' in parsed) {
          return String(parsed.value ?? fallback)
        }
      } catch {
        return fallback
      }
    }
    return val
  }
  if (typeof val === 'object' && 'value' in val) {
    return String(val.value ?? fallback)
  }
  return String(val)
}

export default function Settings() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const [allAccounts, setAllAccounts] = useState<any[]>([])
  const [incomeAccounts, setIncomeAccounts] = useState<any[]>([])
  const [expenseAccounts, setExpenseAccounts] = useState<any[]>([])
  const [assetAccounts, setAssetAccounts] = useState<any[]>([])
  const [liabilityAccounts, setLiabilityAccounts] = useState<any[]>([])

  const [companyName, setCompanyName] = useState('My Company')
  const [currency, setCurrency] = useState('USD')
  const [fiscalYearStart, setFiscalYearStart] = useState('1')
  const [fiscalYearEnd, setFiscalYearEnd] = useState('12')

  const [defaultSalesAccount, setDefaultSalesAccount] = useState('Sales')
  const [defaultPurchaseAccount, setDefaultPurchaseAccount] = useState('Cost of Goods Sold')
  const [defaultReceivableAccount, setDefaultReceivableAccount] = useState('Debtors')
  const [defaultPayableAccount, setDefaultPayableAccount] = useState('Creditors')
  const [defaultCashAccount, setDefaultCashAccount] = useState('Cash')
  const [defaultBankAccount, setDefaultBankAccount] = useState('Bank')
  const [defaultRoundOffAccount, setDefaultRoundOffAccount] = useState('Round Off')
  const [defaultDiscountAccount, setDefaultDiscountAccount] = useState('Discount Allowed')
  const [defaultStockAccount, setDefaultStockAccount] = useState('Stock in Hand')
  const [defaultDepreciationAccount, setDefaultDepreciationAccount] = useState('Depreciation')

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      try {
        const accounts = await api.list('Account')
        const all = Array.isArray(accounts) ? accounts : []
        setAllAccounts(all)

        const income = all.filter(a => a.rootType === 'Income' || (a.accountType && a.accountType.includes('Income')))
        setIncomeAccounts(income.length ? income : all.filter(a => a.rootType === 'Income'))

        const expense = all.filter(a => a.rootType === 'Expense' || (a.accountType && a.accountType.includes('Expense')))
        setExpenseAccounts(expense.length ? expense : all.filter(a => a.rootType === 'Expense'))

        const assets = all.filter(a => a.rootType === 'Asset')
        setAssetAccounts(assets)

        const liabilities = all.filter(a => a.rootType === 'Liability')
        setLiabilityAccounts(liabilities)

        const [
          cName,
          curr,
          fyStart,
          fyEnd,
          dSales,
          dPurch,
          dRec,
          dPay,
          dCash,
          dBank,
          dRound,
          dDisc,
          dStock,
          dDep,
        ] = await Promise.all([
          api.getSingleValue('company_name'),
          api.getSingleValue('currency'),
          api.getSingleValue('fiscal_year_start'),
          api.getSingleValue('fiscal_year_end'),
          api.getSingleValue('default_sales_account'),
          api.getSingleValue('default_purchase_account'),
          api.getSingleValue('default_receivable_account'),
          api.getSingleValue('default_payable_account'),
          api.getSingleValue('default_cash_account'),
          api.getSingleValue('default_bank_account'),
          api.getSingleValue('default_round_off_account'),
          api.getSingleValue('default_discount_account'),
          api.getSingleValue('default_stock_account'),
          api.getSingleValue('default_depreciation_account'),
        ])

        setCompanyName(ensureString(cName, 'My Company'))
        setCurrency(ensureString(curr, 'USD'))
        setFiscalYearStart(ensureString(fyStart, '1'))
        setFiscalYearEnd(ensureString(fyEnd, '12'))
        setDefaultSalesAccount(ensureString(dSales, 'Sales'))
        setDefaultPurchaseAccount(ensureString(dPurch, 'Cost of Goods Sold'))
        setDefaultReceivableAccount(ensureString(dRec, 'Debtors'))
        setDefaultPayableAccount(ensureString(dPay, 'Creditors'))
        setDefaultCashAccount(ensureString(dCash, 'Cash'))
        setDefaultBankAccount(ensureString(dBank, 'Bank'))
        setDefaultRoundOffAccount(ensureString(dRound, 'Round Off'))
        setDefaultDiscountAccount(ensureString(dDisc, 'Discount Allowed'))
        setDefaultStockAccount(ensureString(dStock, 'Stock in Hand'))
        setDefaultDepreciationAccount(ensureString(dDep, 'Depreciation'))
      } catch (e: any) {
        console.error('Failed to load settings:', e)
        setNotification({ type: 'error', message: 'Failed to load company preferences.' })
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setNotification(null)

    try {
      const entries: [string, string][] = [
        ['company_name', ensureString(companyName)],
        ['currency', ensureString(currency)],
        ['fiscal_year_start', ensureString(fiscalYearStart)],
        ['fiscal_year_end', ensureString(fiscalYearEnd)],
        ['default_sales_account', ensureString(defaultSalesAccount)],
        ['default_purchase_account', ensureString(defaultPurchaseAccount)],
        ['default_receivable_account', ensureString(defaultReceivableAccount)],
        ['default_payable_account', ensureString(defaultPayableAccount)],
        ['default_cash_account', ensureString(defaultCashAccount)],
        ['default_bank_account', ensureString(defaultBankAccount)],
        ['default_round_off_account', ensureString(defaultRoundOffAccount)],
        ['default_discount_account', ensureString(defaultDiscountAccount)],
        ['default_stock_account', ensureString(defaultStockAccount)],
        ['default_depreciation_account', ensureString(defaultDepreciationAccount)],
      ]

      for (const [key, value] of entries) {
        await api.setSingleValue(key, value)
      }

      setNotification({ type: 'success', message: 'Settings saved successfully!' })
      
      // Auto-hide success notification after 4 seconds
      setTimeout(() => {
        setNotification(prev => prev?.type === 'success' ? null : prev)
      }, 4000)
    } catch (err: any) {
      console.error('Error saving settings:', err)
      setNotification({ type: 'error', message: err?.message || 'Failed to save settings. Please try again.' })
    } finally {
      setSaving(false)
    }
  }

  const monthNames = [
    { value: '1', label: 'January (01)' },
    { value: '2', label: 'February (02)' },
    { value: '3', label: 'March (03)' },
    { value: '4', label: 'April (04)' },
    { value: '5', label: 'May (05)' },
    { value: '6', label: 'June (06)' },
    { value: '7', label: 'July (07)' },
    { value: '8', label: 'August (08)' },
    { value: '9', label: 'September (09)' },
    { value: '10', label: 'October (10)' },
    { value: '11', label: 'November (11)' },
    { value: '12', label: 'December (12)' },
  ]

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6 py-4">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-8 w-48 bg-slate-200 animate-pulse rounded-md"></div>
            <div className="h-4 w-72 bg-slate-100 animate-pulse rounded-md"></div>
          </div>
        </div>
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="py-16 text-center text-slate-500 space-y-3">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-600" />
            <p className="text-sm font-medium">Loading system preferences and default accounts...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-xl shadow-md shadow-blue-500/20">
              <Sliders className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Settings</h1>
              <p className="text-sm text-slate-500">Configure core company information and default accounting ledger mappings</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full">
            <ShieldCheck className="w-3.5 h-3.5" /> Single Entry / Standard COA Active
          </span>
        </div>
      </div>

      {/* Alert Notification */}
      {notification && (
        <div
          className={`flex items-center justify-between p-4 rounded-xl border shadow-sm transition-all ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-3">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <p className="text-sm font-medium">{notification.message}</p>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      <form onSubmit={save} className="space-y-6">
        {/* Company Profile Card */}
        <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-600" />
              <CardTitle className="text-lg font-semibold text-slate-900">Company Information</CardTitle>
            </div>
            <CardDescription>Legal entity details and base reporting currency</CardDescription>
          </CardHeader>

          <CardContent className="pt-6 space-y-5">
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5 block">
                Company Name
              </Label>
              <Input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. Acme Corp Ltd."
                className="bg-white border-slate-300 focus:border-blue-500 focus:ring-blue-500 font-medium"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5 block flex items-center gap-1.5">
                  <Coins className="w-3.5 h-3.5 text-amber-500" /> Base Currency
                </Label>
                <NativeSelect
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="bg-white border-slate-300 font-medium"
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="INR">INR (₹)</option>
                  <option value="AUD">AUD ($)</option>
                  <option value="CAD">CAD ($)</option>
                  <option value="AED">AED (د.إ)</option>
                  <option value="SAR">SAR (﷼)</option>
                  <option value="SGD">SGD ($)</option>
                </NativeSelect>
              </div>

              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5 block flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-blue-500" /> Fiscal Year Start
                </Label>
                <NativeSelect
                  value={fiscalYearStart}
                  onChange={(e) => setFiscalYearStart(e.target.value)}
                  className="bg-white border-slate-300 font-medium"
                >
                  {monthNames.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </NativeSelect>
              </div>

              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5 block flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-indigo-500" /> Fiscal Year End
                </Label>
                <NativeSelect
                  value={fiscalYearEnd}
                  onChange={(e) => setFiscalYearEnd(e.target.value)}
                  className="bg-white border-slate-300 font-medium"
                >
                  {monthNames.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Primary Default Accounts Card */}
        <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-indigo-600" />
              <CardTitle className="text-lg font-semibold text-slate-900">Default Transaction Accounts</CardTitle>
            </div>
            <CardDescription>Default ledger accounts assigned automatically during invoice & payment processing</CardDescription>
          </CardHeader>

          <CardContent className="pt-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5 block flex items-center gap-1.5">
                  <Coins className="w-3.5 h-3.5 text-emerald-600" /> Default Sales / Income Account
                </Label>
                <NativeSelect
                  value={defaultSalesAccount}
                  onChange={(e) => setDefaultSalesAccount(e.target.value)}
                  className="bg-white border-slate-300 font-medium"
                >
                  <option value="">Select Sales Account...</option>
                  {incomeAccounts.map((a) => (
                    <option key={a.name} value={a.name}>
                      {a.name} ({a.rootType})
                    </option>
                  ))}
                  {allAccounts.filter(a => a.rootType !== 'Income').map((a) => (
                    <option key={`other-${a.name}`} value={a.name}>
                      {a.name} ({a.rootType})
                    </option>
                  ))}
                </NativeSelect>
              </div>

              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5 block flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-rose-600" /> Default Purchase / Expense Account
                </Label>
                <NativeSelect
                  value={defaultPurchaseAccount}
                  onChange={(e) => setDefaultPurchaseAccount(e.target.value)}
                  className="bg-white border-slate-300 font-medium"
                >
                  <option value="">Select Purchase Account...</option>
                  {expenseAccounts.map((a) => (
                    <option key={a.name} value={a.name}>
                      {a.name} ({a.rootType})
                    </option>
                  ))}
                  {allAccounts.filter(a => a.rootType !== 'Expense').map((a) => (
                    <option key={`other-${a.name}`} value={a.name}>
                      {a.name} ({a.rootType})
                    </option>
                  ))}
                </NativeSelect>
              </div>

              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5 block flex items-center gap-1.5">
                  <Wallet className="w-3.5 h-3.5 text-sky-600" /> Accounts Receivable (Debtors)
                </Label>
                <NativeSelect
                  value={defaultReceivableAccount}
                  onChange={(e) => setDefaultReceivableAccount(e.target.value)}
                  className="bg-white border-slate-300 font-medium"
                >
                  <option value="">Select Receivable Account...</option>
                  {assetAccounts.map((a) => (
                    <option key={a.name} value={a.name}>
                      {a.name} ({a.accountType || a.rootType})
                    </option>
                  ))}
                </NativeSelect>
              </div>

              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5 block flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-amber-600" /> Accounts Payable (Creditors)
                </Label>
                <NativeSelect
                  value={defaultPayableAccount}
                  onChange={(e) => setDefaultPayableAccount(e.target.value)}
                  className="bg-white border-slate-300 font-medium"
                >
                  <option value="">Select Payable Account...</option>
                  {liabilityAccounts.map((a) => (
                    <option key={a.name} value={a.name}>
                      {a.name} ({a.accountType || a.rootType})
                    </option>
                  ))}
                </NativeSelect>
              </div>

              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5 block flex items-center gap-1.5">
                  <Coins className="w-3.5 h-3.5 text-emerald-600" /> Default Cash Account
                </Label>
                <NativeSelect
                  value={defaultCashAccount}
                  onChange={(e) => setDefaultCashAccount(e.target.value)}
                  className="bg-white border-slate-300 font-medium"
                >
                  <option value="">Select Cash Account...</option>
                  {assetAccounts.map((a) => (
                    <option key={a.name} value={a.name}>
                      {a.name} ({a.accountType || a.rootType})
                    </option>
                  ))}
                </NativeSelect>
              </div>

              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5 block flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-blue-600" /> Default Bank Account
                </Label>
                <NativeSelect
                  value={defaultBankAccount}
                  onChange={(e) => setDefaultBankAccount(e.target.value)}
                  className="bg-white border-slate-300 font-medium"
                >
                  <option value="">Select Bank Account...</option>
                  {assetAccounts.map((a) => (
                    <option key={a.name} value={a.name}>
                      {a.name} ({a.accountType || a.rootType})
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Auxiliary Accounting Settings */}
        <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <Scale className="w-5 h-5 text-slate-700" />
              <CardTitle className="text-lg font-semibold text-slate-900">Adjustments & Inventory Accounts</CardTitle>
            </div>
            <CardDescription>Accounts used for round offs, discounts allowed, stock valuation, and depreciation</CardDescription>
          </CardHeader>

          <CardContent className="pt-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5 block">
                  Round Off Account
                </Label>
                <NativeSelect
                  value={defaultRoundOffAccount}
                  onChange={(e) => setDefaultRoundOffAccount(e.target.value)}
                  className="bg-white border-slate-300 font-medium"
                >
                  <option value="">Select Round Off Account...</option>
                  {allAccounts.map((a) => (
                    <option key={a.name} value={a.name}>
                      {a.name} ({a.rootType})
                    </option>
                  ))}
                </NativeSelect>
              </div>

              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5 block">
                  Discount Allowed Account
                </Label>
                <NativeSelect
                  value={defaultDiscountAccount}
                  onChange={(e) => setDefaultDiscountAccount(e.target.value)}
                  className="bg-white border-slate-300 font-medium"
                >
                  <option value="">Select Discount Account...</option>
                  {expenseAccounts.map((a) => (
                    <option key={a.name} value={a.name}>
                      {a.name} ({a.rootType})
                    </option>
                  ))}
                </NativeSelect>
              </div>

              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5 block">
                  Stock / Inventory Account
                </Label>
                <NativeSelect
                  value={defaultStockAccount}
                  onChange={(e) => setDefaultStockAccount(e.target.value)}
                  className="bg-white border-slate-300 font-medium"
                >
                  <option value="">Select Stock Account...</option>
                  {assetAccounts.map((a) => (
                    <option key={a.name} value={a.name}>
                      {a.name} ({a.rootType})
                    </option>
                  ))}
                </NativeSelect>
              </div>

              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5 block">
                  Depreciation Account
                </Label>
                <NativeSelect
                  value={defaultDepreciationAccount}
                  onChange={(e) => setDefaultDepreciationAccount(e.target.value)}
                  className="bg-white border-slate-300 font-medium"
                >
                  <option value="">Select Depreciation Account...</option>
                  {expenseAccounts.map((a) => (
                    <option key={a.name} value={a.name}>
                      {a.name} ({a.rootType})
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="submit"
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl shadow-md shadow-blue-500/20 font-semibold flex items-center gap-2 transition-all cursor-pointer"
          >
            {saving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" /> Saving Changes...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" /> Save Settings
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
