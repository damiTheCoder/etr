import React, { useEffect, useState } from 'react'
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
  const [entries, setEntries] = useState<any[]>([])
  const [accounts, setAccounts] = useState<any[]>([])
  const [filterAccount, setFilterAccount] = useState<string>('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  async function loadAccounts() {
    try {
      const res = await api.list('Account')
      setAccounts(res)
    } catch (e) {
      console.error(e)
    }
  }

  async function loadReport() {
    try {
      const params: Record<string, string> = {}
      if (filterAccount && filterAccount !== 'all') params.account = filterAccount
      if (fromDate) params.from_date = fromDate
      if (toDate) params.to_date = toDate
      const res = await api.getReport('general-ledger', params)
      setEntries(res.entries || [])
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    loadAccounts()
    loadReport()
  }, [])

  const totalDebit = entries.reduce((acc, e) => acc + (e.debit || 0), 0)
  const totalCredit = entries.reduce((acc, e) => acc + (e.credit || 0), 0)

  function handleExportCSV() {
    const headers = ['Date', 'Account', 'Party', 'Reference', 'Debit ($)', 'Credit ($)', 'Running Balance']
    const rows = entries.map(e => [
      e.date,
      e.account,
      e.party || '',
      `${e.reference_type}: ${e.reference_name}`,
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
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="bg-blue-600 hover:bg-blue-700 text-white border border-black font-semibold"
          >
            Export Excel / CSV
          </Button>
          <Button
            size="sm"
            onClick={() => exportToPDF('General Ledger')}
            className="bg-blue-600 hover:bg-blue-700 text-white border border-black font-semibold"
          >
            Export PDF
          </Button>
        </div>
      </div>

      <Card className="no-print border-0 bg-transparent shadow-none">
        <CardHeader className="px-0">
          <CardTitle className="text-black">Filters</CardTitle>
          <CardDescription>Refine ledger entries by account or date range</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <Label className="mb-1.5 block text-black font-medium">Account</Label>
              <NativeSelect value={filterAccount} onChange={(e) => setFilterAccount(e.target.value)}>
                <option value="all">All Accounts</option>
                {accounts.map(a => (
                  <option key={a.name} value={a.name}>{a.name}</option>
                ))}
              </NativeSelect>
            </div>
            <div>
              <Label className="mb-1.5 block text-black font-medium">From Date</Label>
              <Input
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                type="date"
                className="w-auto text-sm"
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-black font-medium">To Date</Label>
              <Input
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                type="date"
                className="w-auto text-sm"
              />
            </div>
            <Button
              size="sm"
              onClick={loadReport}
              className="bg-blue-600 hover:bg-blue-700 text-white border border-black font-semibold"
            >
              Apply
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Main Container */}
      <Card className="border-0 bg-transparent shadow-none p-0">
        <CardHeader className="border-0 px-0 py-4 bg-transparent">
          <CardTitle className="text-black font-bold">General Ledger Statement</CardTitle>
          <CardDescription className="text-slate-500 font-medium">
            {filterAccount !== 'all' ? `Filtered by ${filterAccount}` : 'All accounts'} • {entries.length} transactions recorded
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 bg-transparent">
          {entries.length > 0 ? (
            <div className="overflow-x-auto bg-transparent">
              <Table className="w-full bg-transparent border-0">
                <TableHeader>
                  <TableRow className="border-0 bg-transparent">
                    <TableHead className="w-[100px] py-3 text-black font-bold">Date</TableHead>
                    <TableHead className="py-3 text-black font-bold">Account</TableHead>
                    <TableHead className="py-3 text-black font-bold">Party</TableHead>
                    <TableHead className="py-3 text-black font-bold">Reference</TableHead>
                    <TableHead className="text-right py-3 text-black font-bold">Debit ($)</TableHead>
                    <TableHead className="text-right py-3 text-black font-bold">Credit ($)</TableHead>
                    <TableHead className="text-right py-3 text-black font-bold">Running Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="bg-transparent">
                  {entries.map((entry: any, i: number) => (
                    <TableRow key={i} className="border-0 bg-transparent">
                      <TableCell className="py-3 text-sm text-black">{entry.date}</TableCell>
                      <TableCell className="py-3 font-semibold text-black">{entry.account}</TableCell>
                      <TableCell className="py-3 text-sm text-black">{entry.party || '—'}</TableCell>
                      <TableCell className="py-3 text-sm text-black">
                        {entry.reference_type}: {entry.reference_name}
                      </TableCell>
                      <TableCell className="py-3 text-right font-mono text-sm text-black">
                        {entry.debit > 0 ? formatCurrency(entry.debit) : '—'}
                      </TableCell>
                      <TableCell className="py-3 text-right font-mono text-sm text-black">
                        {entry.credit > 0 ? formatCurrency(entry.credit) : '—'}
                      </TableCell>
                      <TableCell className="py-3 text-right font-mono text-sm font-semibold text-black">
                        {formatCurrency(entry.balance)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Totals Summary Row - WITH TOP MARGIN & GREY BG */}
                  <TableRow className="border-0 bg-transparent">
                    <TableCell colSpan={7} className="p-0">
                      <div className="mt-4 bg-slate-200 flex items-center justify-between pl-6 pr-6 py-3 font-bold text-black">
                        <span className="font-bold text-black">TOTAL</span>
                        <div className="flex items-center gap-12">
                          <span className="font-mono font-bold text-black">
                            Debit: {formatCurrency(totalDebit)}
                          </span>
                          <span className="font-mono font-bold text-black">
                            Credit: {formatCurrency(totalCredit)}
                          </span>
                        </div>
                      </div>
                    </TableCell>
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
