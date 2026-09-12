import React, { useEffect, useState } from 'react'
import { api } from '@/utils/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function Settings() {
  const [loading, setLoading] = useState(true)

  const [incomeAccounts, setIncomeAccounts] = useState<any[]>([])
  const [expenseAccounts, setExpenseAccounts] = useState<any[]>([])
  const [receivableAccounts, setReceivableAccounts] = useState<any[]>([])
  const [payableAccounts, setPayableAccounts] = useState<any[]>([])
  const [cashAccounts, setCashAccounts] = useState<any[]>([])
  const [bankAccounts, setBankAccounts] = useState<any[]>([])

  const [companyName, setCompanyName] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [fiscalYearStart, setFiscalYearStart] = useState('1')
  const [fiscalYearEnd, setFiscalYearEnd] = useState('12')
  const [defaultSalesAccount, setDefaultSalesAccount] = useState('Sales')
  const [defaultPurchaseAccount, setDefaultPurchaseAccount] = useState('Cost of Goods Sold')
  const [defaultReceivableAccount, setDefaultReceivableAccount] = useState('Debtors')
  const [defaultPayableAccount, setDefaultPayableAccount] = useState('Creditors')
  const [defaultCashAccount, setDefaultCashAccount] = useState('Cash')
  const [defaultBankAccount, setDefaultBankAccount] = useState('Bank')

  useEffect(() => {
    async function loadData() {
      try {
        const accounts = await api.list('Account')
        const all = accounts as any[]
        setIncomeAccounts(all.filter(a => a.rootType === 'Income'))
        setExpenseAccounts(all.filter(a => a.rootType === 'Expense'))
        setReceivableAccounts(all.filter(a => a.accountType === 'Receivable'))
        setPayableAccounts(all.filter(a => a.accountType === 'Payable'))
        setCashAccounts(all.filter(a => a.accountType === 'Cash'))
        setBankAccounts(all.filter(a => a.accountType === 'Bank'))

        setCompanyName((await api.getSingleValue('company_name')) || 'My Company')
        setCurrency((await api.getSingleValue('currency')) || 'USD')
        setFiscalYearStart(await api.getSingleValue('fiscal_year_start') || '1')
        setFiscalYearEnd(await api.getSingleValue('fiscal_year_end') || '12')
        setDefaultSalesAccount((await api.getSingleValue('default_sales_account')) || 'Sales')
        setDefaultPurchaseAccount((await api.getSingleValue('default_purchase_account')) || 'Cost of Goods Sold')
        setDefaultReceivableAccount((await api.getSingleValue('default_receivable_account')) || 'Debtors')
        setDefaultPayableAccount((await api.getSingleValue('default_payable_account')) || 'Creditors')
        setDefaultCashAccount((await api.getSingleValue('default_cash_account')) || 'Cash')
        setDefaultBankAccount((await api.getSingleValue('default_bank_account')) || 'Bank')
      } catch (e) {
        console.error(e)
      }
      setLoading(false)
    }
    loadData()
  }, [])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    try {
      const entries = [
        ['company_name', companyName],
        ['currency', currency],
        ['fiscal_year_start', fiscalYearStart],
        ['fiscal_year_end', fiscalYearEnd],
        ['default_sales_account', defaultSalesAccount],
        ['default_purchase_account', defaultPurchaseAccount],
        ['default_receivable_account', defaultReceivableAccount],
        ['default_payable_account', defaultPayableAccount],
        ['default_cash_account', defaultCashAccount],
        ['default_bank_account', defaultBankAccount],
      ]
      for (const [key, value] of entries) {
        await api.setSingleValue(key, value)
      }
      alert('Settings saved')
    } catch (err: any) {
      alert(err.message)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-gray-400">Loading...</CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage company preferences and default accounts</p>
      </div>

      <form onSubmit={save} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Company</CardTitle>
            <CardDescription>Basic company information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="mb-1.5 block">Company Name</Label>
              <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} required />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="mb-1.5 block">Currency</Label>
                <NativeSelect value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                  <option value="INR">INR</option>
                  <option value="AUD">AUD</option>
                  <option value="CAD">CAD</option>
                </NativeSelect>
              </div>
              <div>
                <Label className="mb-1.5 block">Fiscal Year Start (Month)</Label>
                <NativeSelect value={fiscalYearStart} onChange={(e) => setFiscalYearStart(e.target.value)}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                    <option key={m} value={String(m)}>{m}</option>
                  ))}
                </NativeSelect>
              </div>
            </div>
            <div>
              <Label className="mb-1.5 block">Fiscal Year End (Month)</Label>
              <NativeSelect value={fiscalYearEnd} onChange={(e) => setFiscalYearEnd(e.target.value)}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                  <option key={m} value={String(m)}>{m}</option>
                ))}
              </NativeSelect>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Default Accounts</CardTitle>
            <CardDescription>Set default accounts for common transactions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="mb-1.5 block">Sales Account</Label>
                <NativeSelect value={defaultSalesAccount} onChange={(e) => setDefaultSalesAccount(e.target.value)}>
                  <option value="">Select...</option>
                  {incomeAccounts.map(a => (
                    <option key={a.name} value={a.name}>{a.name}</option>
                  ))}
                </NativeSelect>
              </div>
              <div>
                <Label className="mb-1.5 block">Purchase Account</Label>
                <NativeSelect value={defaultPurchaseAccount} onChange={(e) => setDefaultPurchaseAccount(e.target.value)}>
                  <option value="">Select...</option>
                  {expenseAccounts.map(a => (
                    <option key={a.name} value={a.name}>{a.name}</option>
                  ))}
                </NativeSelect>
              </div>
              <div>
                <Label className="mb-1.5 block">Receivable Account</Label>
                <NativeSelect value={defaultReceivableAccount} onChange={(e) => setDefaultReceivableAccount(e.target.value)}>
                  <option value="">Select...</option>
                  {receivableAccounts.map(a => (
                    <option key={a.name} value={a.name}>{a.name}</option>
                  ))}
                </NativeSelect>
              </div>
              <div>
                <Label className="mb-1.5 block">Payable Account</Label>
                <NativeSelect value={defaultPayableAccount} onChange={(e) => setDefaultPayableAccount(e.target.value)}>
                  <option value="">Select...</option>
                  {payableAccounts.map(a => (
                    <option key={a.name} value={a.name}>{a.name}</option>
                  ))}
                </NativeSelect>
              </div>
              <div>
                <Label className="mb-1.5 block">Cash Account</Label>
                <NativeSelect value={defaultCashAccount} onChange={(e) => setDefaultCashAccount(e.target.value)}>
                  <option value="">Select...</option>
                  {cashAccounts.map(a => (
                    <option key={a.name} value={a.name}>{a.name}</option>
                  ))}
                </NativeSelect>
              </div>
              <div>
                <Label className="mb-1.5 block">Bank Account</Label>
                <NativeSelect value={defaultBankAccount} onChange={(e) => setDefaultBankAccount(e.target.value)}>
                  <option value="">Select...</option>
                  {bankAccounts.map(a => (
                    <option key={a.name} value={a.name}>{a.name}</option>
                  ))}
                </NativeSelect>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3 justify-end">
          <Button type="submit">Save Settings</Button>
        </div>
      </form>
    </div>
  )
}
