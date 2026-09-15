import React, { useEffect, useState } from 'react'
import { api } from '@/utils/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useCompany } from '../context/CompanyContext'

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

function extractState(data: any): Record<string, any> {
  return {
    company_name: data.company?.name ?? data.company_name ?? 'My Company',
    base_currency: data.company?.base_currency ?? data.base_currency ?? 'NGN',
    fiscal_year_start: String(data.company?.fiscal_year_start ?? data.fiscal_year_start ?? 1),
    fiscal_year_end: String(data.company?.fiscal_year_end ?? data.fiscal_year_end ?? 12),
    default_sales_income_account_id: data.defaults?.sales_income?.id ?? data.default_sales_income_account_id ?? 'Sales',
    default_purchase_expense_account_id: data.defaults?.purchase_expense?.id ?? data.default_purchase_expense_account_id ?? 'Cost of Goods Sold',
    default_receivable_account_id: data.defaults?.receivable?.id ?? data.default_receivable_account_id ?? 'Debtors',
    default_payable_account_id: data.defaults?.payable?.id ?? data.default_payable_account_id ?? 'Creditors',
    default_cash_account_id: data.defaults?.cash?.id ?? data.default_cash_account_id ?? 'Cash',
    default_bank_account_id: data.defaults?.bank?.id ?? data.default_bank_account_id ?? 'Bank',
    round_off_account_id: data.defaults?.round_off?.id ?? data.round_off_account_id ?? 'Round Off',
    discount_allowed_account_id: data.defaults?.discount_allowed?.id ?? data.discount_allowed_account_id ?? 'Discount Allowed',
    stock_inventory_account_id: data.defaults?.stock_inventory?.id ?? data.stock_inventory_account_id ?? 'Stock in Hand',
    depreciation_account_id: data.defaults?.depreciation?.id ?? data.depreciation_account_id ?? 'Depreciation',
  }
}

export default function Settings() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null)

  const [allAccounts, setAllAccounts] = useState<any[]>([])
  const [incomeAccounts, setIncomeAccounts] = useState<any[]>([])
  const [expenseAccounts, setExpenseAccounts] = useState<any[]>([])
  const [assetAccounts, setAssetAccounts] = useState<any[]>([])
  const [liabilityAccounts, setLiabilityAccounts] = useState<any[]>([])

  const [formData, setFormData] = useState<Record<string, any>>({})
  const [initialData, setInitialData] = useState<Record<string, any>>({})
  const [version, setVersion] = useState<number>(1)

  const updateFormField = (key: string, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }))
  }

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

        const settingsRes = await fetch('/api/settings?company_id=default_company')
        if (settingsRes.ok) {
          const settingsData = await settingsRes.json()
          const state = extractState(settingsData)
          setFormData(state)
          setInitialData(state)
          setVersion(settingsData.version ?? 1)
        }
      } catch (e: any) {
        console.error('Failed to load settings:', e)
        setNotification({ type: 'error', message: 'Failed to load company preferences.' })
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const { refetchSettings } = useCompany()

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setNotification(null)

    try {
      const diff: Record<string, any> = {}
      Object.keys(formData).forEach(k => {
        if (formData[k] !== initialData[k]) {
          if (k === 'fiscal_year_start' || k === 'fiscal_year_end') {
            diff[k] = parseInt(formData[k], 10)
          } else {
            diff[k] = formData[k]
          }
        }
      })

      if (Object.keys(diff).length === 0) {
        setNotification({ type: 'info', message: 'No changes to save' })
        setSaving(false)
        return
      }

      diff.version = version

      const res = await fetch('/api/settings?company_id=default_company', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(diff),
      })

      if (res.status === 409) {
        setNotification({ type: 'error', message: 'Settings were changed elsewhere. Reloading...' })
        const freshRes = await fetch('/api/settings?company_id=default_company')
        if (freshRes.ok) {
          const freshData = await freshRes.json()
          const freshState = extractState(freshData)
          setFormData(freshState)
          setInitialData(freshState)
          setVersion(freshData.version ?? 1)
        }
        setSaving(false)
        return
      }

      if (!res.ok) {
        throw new Error('Failed to save settings')
      }

      const freshRes = await fetch('/api/settings?company_id=default_company')
      if (freshRes.ok) {
        const freshData = await freshRes.json()
        const freshState = extractState(freshData)
        setFormData(freshState)
        setInitialData(freshState)
        setVersion(freshData.version ?? (version + 1))
      }

      await refetchSettings()

      setNotification({ type: 'success', message: 'Settings saved' })

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
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Settings</h1>
          <p className="text-sm text-slate-500">Configure core company information and default accounting ledger mappings</p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-3 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full">
            Single Entry / Standard COA Active
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
          <p className="text-sm font-medium">{notification.message}</p>
          <button
            onClick={() => setNotification(null)}
            className="text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      <form onSubmit={save} className="space-y-6">
        {/* Company Profile Card */}
        <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
            <CardTitle className="text-lg font-semibold text-slate-900">Company Information</CardTitle>
            <CardDescription>Legal entity details and base reporting currency</CardDescription>
          </CardHeader>

          <CardContent className="pt-6 space-y-5">
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5 block">
                Company Name
              </Label>
              <Input
                value={formData.company_name ?? ''}
                onChange={(e) => updateFormField('company_name', e.target.value)}
                placeholder="e.g. Acme Corp Ltd."
                className="bg-white border-slate-300 focus:border-blue-500 focus:ring-blue-500 font-medium"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5 block">
                  Base Currency
                </Label>
                <NativeSelect
                  value={formData.base_currency ?? 'NGN'}
                  onChange={(e) => updateFormField('base_currency', e.target.value)}
                  className="bg-white border-slate-300 font-medium"
                >
                  <option value="NGN">NGN (₦)</option>
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
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5 block">
                  Fiscal Year Start
                </Label>
                <NativeSelect
                  value={formData.fiscal_year_start ?? '1'}
                  onChange={(e) => updateFormField('fiscal_year_start', e.target.value)}
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
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5 block">
                  Fiscal Year End
                </Label>
                <NativeSelect
                  value={formData.fiscal_year_end ?? '12'}
                  onChange={(e) => updateFormField('fiscal_year_end', e.target.value)}
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
            <CardTitle className="text-lg font-semibold text-slate-900">Default Transaction Accounts</CardTitle>
            <CardDescription>Default ledger accounts assigned automatically during invoice & payment processing</CardDescription>
          </CardHeader>

          <CardContent className="pt-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5 block">
                  Default Sales / Income Account
                </Label>
                <NativeSelect
                  value={formData.default_sales_income_account_id ?? ''}
                  onChange={(e) => updateFormField('default_sales_income_account_id', e.target.value)}
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
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5 block">
                  Default Purchase / Expense Account
                </Label>
                <NativeSelect
                  value={formData.default_purchase_expense_account_id ?? ''}
                  onChange={(e) => updateFormField('default_purchase_expense_account_id', e.target.value)}
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
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5 block">
                  Accounts Receivable (Debtors)
                </Label>
                <NativeSelect
                  value={formData.default_receivable_account_id ?? ''}
                  onChange={(e) => updateFormField('default_receivable_account_id', e.target.value)}
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
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5 block">
                  Accounts Payable (Creditors)
                </Label>
                <NativeSelect
                  value={formData.default_payable_account_id ?? ''}
                  onChange={(e) => updateFormField('default_payable_account_id', e.target.value)}
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
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5 block">
                  Default Cash Account
                </Label>
                <NativeSelect
                  value={formData.default_cash_account_id ?? ''}
                  onChange={(e) => updateFormField('default_cash_account_id', e.target.value)}
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
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5 block">
                  Default Bank Account
                </Label>
                <NativeSelect
                  value={formData.default_bank_account_id ?? ''}
                  onChange={(e) => updateFormField('default_bank_account_id', e.target.value)}
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
            <CardTitle className="text-lg font-semibold text-slate-900">Adjustments & Inventory Accounts</CardTitle>
            <CardDescription>Accounts used for round offs, discounts allowed, stock valuation, and depreciation</CardDescription>
          </CardHeader>

          <CardContent className="pt-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5 block">
                  Round Off Account
                </Label>
                <NativeSelect
                  value={formData.round_off_account_id ?? ''}
                  onChange={(e) => updateFormField('round_off_account_id', e.target.value)}
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
                  value={formData.discount_allowed_account_id ?? ''}
                  onChange={(e) => updateFormField('discount_allowed_account_id', e.target.value)}
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
                  value={formData.stock_inventory_account_id ?? ''}
                  onChange={(e) => updateFormField('stock_inventory_account_id', e.target.value)}
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
                  value={formData.depreciation_account_id ?? ''}
                  onChange={(e) => updateFormField('depreciation_account_id', e.target.value)}
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
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl shadow-md shadow-blue-500/20 font-semibold transition-all cursor-pointer"
          >
            {saving ? 'Saving Changes...' : 'Save Settings'}
          </Button>
        </div>
      </form>
    </div>
  )
}
