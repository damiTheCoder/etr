import React, { useEffect, useState } from 'react'
import { Download, Printer } from 'lucide-react'
import { api } from '@/utils/api'
import { exportToCSV, exportToPDF } from '@/utils/exportUtils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

import { useCompany } from '@/context/CompanyContext'

export default function GeneralLedger() {
  const { formatCurrency } = useCompany()
  const [data, setData] = useState<any>(null)
  const [accounts, setAccounts] = useState<any[]>([])
  const [filterAccount, setFilterAccount] = useState('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  async function loadReport() {
    try {
      const params: Record<string, string> = {}
      if (filterAccount && filterAccount !== 'all') params.account = filterAccount
      if (fromDate) params.from_date = fromDate
      if (toDate) params.to_date = toDate
      const res = await api.getReport('general-ledger', params)
      setData(res)
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    async function loadAccounts() {
      try {
        const accs = await api.list('Account', 1000)
        setAccounts(accs || [])
      } catch (e) {
        console.error(e)
      }
    }
    loadAccounts()
    loadReport()
  }, [])

  const entries = data?.entries || []
  const totalDebit = entries.reduce((s: number, e: any) => s + Number(e.debit || 0), 0)
  const totalCredit = entries.reduce((s: number, e: any) => s + Number(e.credit || 0), 0)

  function handleExportCSV() {
    const headers = ['Date', 'Account', 'Party', 'Reference', 'Debit', 'Credit', 'Running Balance']
    const rows = entries.map((e: any) => [
      e.date,
      e.account,
      e.party || '',
      `${e.reference_type || ''}: ${e.reference_name || ''}`,
      e.debit || 0,
      e.credit || 0,
      e.balance || 0,
    ])
    rows.push(['TOTALS', '', '', '', totalDebit, totalCredit, ''])
    exportToCSV('General_Ledger', headers, rows)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">General Ledger</h1>
          <p className="text-sm text-gray-500 mt-1">Detailed double-entry view of all accounting ledger transactions</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="border-slate-300">
            <Download className="w-4 h-4 mr-1.5" /> Export Excel / CSV
          </Button>
          <Button size="sm" onClick={() => exportToPDF('General Ledger')} className="bg-blue-600 hover:bg-blue-700 text-white">
            <Printer className="w-4 h-4 mr-1.5" /> Export PDF
          </Button>
        </div>
      </div>

      <Card className="no-print">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Refine ledger entries by account or date range</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <Label className="mb-1.5 block">Account</Label>
              <NativeSelect value={filterAccount} onChange={(e) => setFilterAccount(e.target.value)}>
                <option value="all">All Accounts</option>
                {accounts.map(a => (
                  <option key={a.name} value={a.name}>{a.name}</option>
                ))}
              </NativeSelect>
            </div>
            <div>
              <Label className="mb-1.5 block">From Date</Label>
              <Input
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                type="date"
                className="w-auto text-sm"
              />
            </div>
            <div>
              <Label className="mb-1.5 block">To Date</Label>
              <Input
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                type="date"
                className="w-auto text-sm"
              />
            </div>
            <Button size="sm" onClick={loadReport}>
              Apply
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Main Container */}
      <Card className="border-none bg-transparent shadow-none p-0">
        <CardHeader className="border-none px-0 py-4 bg-transparent">
          <CardTitle className="text-slate-900 font-bold">General Ledger Statement</CardTitle>
          <CardDescription className="text-slate-500 font-medium">
            {filterAccount !== 'all' ? `Filtered by ${filterAccount}` : 'All accounts'} • {entries.length} transactions recorded
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 bg-transparent">
          {entries.length > 0 ? (
            <div className="overflow-x-auto">
              <Table className="w-full bg-transparent">
                <TableHeader>
                  <TableRow className="border-b border-slate-300 bg-slate-100">
                    <TableHead className="w-[100px] text-slate-900 font-bold">Date</TableHead>
                    <TableHead className="text-slate-900 font-bold">Account</TableHead>
                    <TableHead className="text-slate-900 font-bold">Party</TableHead>
                    <TableHead className="text-slate-900 font-bold">Reference</TableHead>
                    <TableHead className="text-right text-slate-900 font-bold">Debit ($)</TableHead>
                    <TableHead className="text-right text-slate-900 font-bold">Credit ($)</TableHead>
                    <TableHead className="text-right text-slate-900 font-bold">Running Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="bg-transparent">
                  {entries.map((entry: any, i: number) => (
                    <TableRow key={i} className="hover:bg-slate-50 border-b border-slate-100 bg-transparent">
                      <TableCell className="text-sm text-slate-700">{entry.date}</TableCell>
                      <TableCell className="font-semibold text-slate-900">{entry.account}</TableCell>
                      <TableCell className="text-sm text-slate-700">{entry.party || '—'}</TableCell>
                      <TableCell className="text-sm text-slate-600">
                        {entry.reference_type}: {entry.reference_name}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-slate-900">
                        {entry.debit > 0 ? formatCurrency(entry.debit) : '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-slate-900">
                        {entry.credit > 0 ? formatCurrency(entry.credit) : '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm font-semibold text-slate-900">
                        {formatCurrency(entry.balance)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Totals Summary Row */}
                  <TableRow className="bg-transparent text-slate-900 font-bold border-t-2 border-b-2 border-slate-300">
                    <TableCell colSpan={4} className="font-bold text-slate-900">TOTAL</TableCell>
                    <TableCell className="text-right font-mono font-bold text-slate-900">{formatCurrency(totalDebit)}</TableCell>
                    <TableCell className="text-right font-mono font-bold text-slate-900">{formatCurrency(totalCredit)}</TableCell>
                    <TableCell className="text-right font-mono font-bold text-slate-900">—</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center text-slate-500 py-16 bg-transparent">
              No ledger entries found for the selected filters
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
