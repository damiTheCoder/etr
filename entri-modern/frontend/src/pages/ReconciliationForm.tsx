import React, { useEffect, useState, useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react'
import { api } from '@/utils/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { NativeSelect } from '@/components/ui/native-select'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { useCompany } from '@/context/CompanyContext'

export default function ReconciliationForm() {
  const { formatCurrency, currencySymbol } = useCompany()
  const navigate = useNavigate()
  const { name } = useParams()
  const isEdit = !!name

  const [loading, setLoading] = useState(true)
  const [accounts, setAccounts] = useState<any[]>([])
  const [glEntries, setGlEntries] = useState<any[]>([])
  const [clearedEntryIds, setClearedEntryIds] = useState<Set<string>>(new Set())

  const [account, setAccount] = useState('Cash')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [openingBalance, setOpeningBalance] = useState(0)
  const [closingBalance, setClosingBalance] = useState(0)
  const [userRemark, setUserRemark] = useState('')

  const formatNumber = (v: number) => Number(v || 0).toFixed(2)

  useEffect(() => {
    async function loadData() {
      try {
        const accs = await api.list('Account')
        const bankOrCashAccs = (accs as any[]).filter(
          a => a.accountType === 'Bank' || a.accountType === 'Cash' || ['Bank', 'Cash', 'Bank Account', 'Petty Cash'].includes(a.name)
        )
        setAccounts(bankOrCashAccs.length > 0 ? bankOrCashAccs : (accs as any[]))
        if (!account && bankOrCashAccs.length > 0) {
          setAccount(bankOrCashAccs[0].name)
        }

        if (isEdit && name) {
          const doc = await api.get('Reconciliation', name)
          setAccount(doc.account || 'Cash')
          setDate(doc.date || new Date().toISOString().split('T')[0])
          setOpeningBalance(doc.openingBalance || 0)
          setClosingBalance(doc.closingBalance || 0)
          setUserRemark(doc.userRemark || '')
        }
      } catch (e) {
        console.error('Failed to load:', e)
      }
      setLoading(false)
    }
    loadData()
  }, [isEdit, name])

  useEffect(() => {
    if (!account) return
    async function loadGLEntries() {
      try {
        const res = await api.getReport('general-ledger', { account })
        const entries = res?.entries || []
        setGlEntries(entries)
        // Select all by default for quick reconciliation
        setClearedEntryIds(new Set(entries.map((e: any) => e.name)))
      } catch (e) {
        console.error('Failed to load GL entries:', e)
      }
    }
    loadGLEntries()
  }, [account])

  function toggleCleared(id: string) {
    const updated = new Set(clearedEntryIds)
    if (updated.has(id)) {
      updated.delete(id)
    } else {
      updated.add(id)
    }
    setClearedEntryIds(updated)
  }

  const { clearedDeposits, clearedWithdrawals, reconciledBalance } = useMemo(() => {
    let deposits = 0
    let withdrawals = 0
    for (const e of glEntries) {
      if (clearedEntryIds.has(e.name)) {
        deposits += Number(e.debit || 0)
        withdrawals += Number(e.credit || 0)
      }
    }
    const balance = openingBalance + deposits - withdrawals
    return {
      clearedDeposits: deposits,
      clearedWithdrawals: withdrawals,
      reconciledBalance: balance,
    }
  }, [glEntries, clearedEntryIds, openingBalance])

  const difference = closingBalance - reconciledBalance

  async function save(e: React.FormEvent) {
    e.preventDefault()
    try {
      const data = {
        account,
        date,
        openingBalance,
        closingBalance,
        clearedDeposits,
        clearedWithdrawals,
        reconciledBalance,
        userRemark,
        status: Math.abs(difference) < 0.01 ? 'Completed' : 'Draft',
        reconciled: Math.abs(difference) < 0.01,
      }
      if (isEdit && name) {
        await api.update('Reconciliation', name, data)
      } else {
        await api.create('Reconciliation', data)
      }
      navigate('/reconciliations')
    } catch (err: any) {
      alert(err.message)
    }
  }

  if (loading) return <div>Loading...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 sm:gap-4 mb-2">
        <Link to="/reconciliations" className="shrink-0 text-gray-400 hover:text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            {isEdit ? 'Edit Bank Reconciliation' : 'New Bank Reconciliation'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">Reconcile bank/cash transactions with statement balance</p>
        </div>
      </div>

      <form onSubmit={save} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Account & Statement Balances</CardTitle>
            <CardDescription>Select bank account and target statement balances</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <Label className="mb-1.5 block">Bank / Cash Account</Label>
                <NativeSelect value={account} onChange={(e) => setAccount(e.target.value)} required>
                  <option value="">Select account...</option>
                  {accounts.map(acct => (
                    <option key={acct.name} value={acct.name}>{acct.name}</option>
                  ))}
                </NativeSelect>
              </div>
              <div>
                <Label className="mb-1.5 block">Reconciliation Date</Label>
                <Input value={date} onChange={(e) => setDate(e.target.value)} type="date" required />
              </div>
              <div>
                <Label className="mb-1.5 block">Opening Balance ({currencySymbol})</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div>
                <Label className="mb-1.5 block">Statement Closing Balance ({currencySymbol})</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={closingBalance}
                  onChange={(e) => setClosingBalance(parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>

            {/* Live reconciliation summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2">
              <div className="p-3 bg-slate-50 rounded-xl border">
                <span className="text-xs text-slate-500 block">Cleared Deposits</span>
                <span className="text-lg font-bold text-emerald-600">{formatCurrency(clearedDeposits)}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border">
                <span className="text-xs text-slate-500 block">Cleared Withdrawals</span>
                <span className="text-lg font-bold text-rose-600">{formatCurrency(clearedWithdrawals)}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border">
                <span className="text-xs text-slate-500 block">Reconciled Balance</span>
                <span className="text-lg font-bold text-slate-900">{formatCurrency(reconciledBalance)}</span>
              </div>
              <div className={`p-3 rounded-xl border ${Math.abs(difference) < 0.01 ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                <span className="text-xs text-slate-500 block">Difference</span>
                <span className={`text-lg font-bold ${Math.abs(difference) < 0.01 ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {formatCurrency(difference)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Transactions list */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Transactions to Reconcile ({glEntries.length})</CardTitle>
              <CardDescription>Check transactions that appear on your bank statement</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setClearedEntryIds(new Set(glEntries.map(e => e.name)))}
              >
                Select All
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setClearedEntryIds(new Set())}
              >
                Clear All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px] text-center">Cleared</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Reference / Party</TableHead>
                  <TableHead className="text-right">Deposit (Debit)</TableHead>
                  <TableHead className="text-right">Withdrawal (Credit)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {glEntries.map((e) => {
                  const checked = clearedEntryIds.has(e.name)
                  return (
                    <TableRow key={e.name} className={checked ? 'bg-blue-50/40' : ''}>
                      <TableCell className="text-center">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleCleared(e.name)}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </TableCell>
                      <TableCell className="text-gray-500">{e.date}</TableCell>
                      <TableCell className="font-medium text-slate-800">
                        {e.party ? `${e.party} (${e.reference_name || ''})` : e.reference_name || e.account}
                      </TableCell>
                      <TableCell className="text-right font-mono text-emerald-600">
                        {Number(e.debit || 0) > 0 ? formatCurrency(e.debit) : '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-rose-600">
                        {Number(e.credit || 0) > 0 ? formatCurrency(e.credit) : '-'}
                      </TableCell>
                    </TableRow>
                  )
                })}
                {glEntries.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-gray-400 py-12">
                      No general ledger entries found for account "{account}".
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Remarks & Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              rows={2}
              placeholder="Enter optional notes..."
              value={userRemark}
              onChange={(e) => setUserRemark(e.target.value)}
            />
          </CardContent>
        </Card>

        <div className="flex gap-3 justify-end">
          <Button type="button" variant="secondary" asChild>
            <Link to="/reconciliations">Cancel</Link>
          </Button>
          <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white">
            <CheckCircle2 className="w-4 h-4 mr-1.5" /> Complete Reconciliation
          </Button>
        </div>
      </form>
    </div>
  )
}
