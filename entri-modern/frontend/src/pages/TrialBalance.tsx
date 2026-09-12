import React, { useEffect, useState } from 'react'
import { Download, Printer, CheckCircle, AlertTriangle } from 'lucide-react'
import { api } from '@/utils/api'
import { exportToCSV, exportToPDF } from '@/utils/exportUtils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export default function TrialBalance() {
  const [data, setData] = useState<any>(null)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  function formatCurrency(v: number) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v || 0)
  }

  function rootTypeBadge(rt: string): 'default' | 'secondary' | 'destructive' | 'outline' {
    const map: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      Asset: 'default',
      Liability: 'secondary',
      Equity: 'outline',
      Income: 'outline',
      Expense: 'destructive',
    }
    return map[rt] || 'secondary'
  }

  async function loadReport() {
    try {
      const params: Record<string, string> = {}
      if (fromDate) params.from_date = fromDate
      if (toDate) params.to_date = toDate
      const res = await api.getReport('trial-balance', params)
      setData(res)
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    loadReport()
  }, [])

  const accountsList = data?.accounts || []

  function handleExportCSV() {
    const headers = ['Account Number', 'Account Name', 'Root Type', 'Debit ($)', 'Credit ($)']
    const rows = accountsList.map((row: any) => [
      row.accountNumber || '',
      row.account,
      row.rootType,
      row.debit || 0,
      row.credit || 0,
    ])
    rows.push(['', 'TOTAL', '', data?.totalDebit || 0, data?.totalCredit || 0])
    exportToCSV('Trial_Balance', headers, rows)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Trial Balance</h1>
          <p className="text-sm text-gray-500 mt-1">Verify that total debits equal total credits across all accounts</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            type="date"
            className="w-auto text-sm"
          />
          <Input
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            type="date"
            className="w-auto text-sm"
          />
          <Button size="sm" onClick={loadReport}>
            Apply
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="border-slate-300">
            <Download className="w-4 h-4 mr-1.5" /> Export Excel / CSV
          </Button>
          <Button size="sm" onClick={() => exportToPDF('Trial Balance')} className="bg-blue-600 hover:bg-blue-700 text-white">
            <Printer className="w-4 h-4 mr-1.5" /> Export PDF
          </Button>
        </div>
      </div>

      <Card className="border-0 bg-slate-50 shadow-sm rounded-2xl overflow-hidden p-0">
        <CardHeader className="border-0 px-6 py-4 bg-transparent">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-slate-900 font-bold">Trial Balance Summary</CardTitle>
              <CardDescription className="text-slate-500 font-medium">
                {accountsList.length} active accounts evaluated
              </CardDescription>
            </div>
            {data && (
              <Badge variant={data.balanced ? 'default' : 'destructive'} className="text-xs px-3 py-1 font-semibold">
                {data.balanced ? 'Balanced ✓' : 'Unbalanced ⚠️'}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="w-full">
              <TableHeader>
                <TableRow className="border-b border-slate-200 bg-white">
                  <TableHead className="w-[100px] text-slate-900 font-bold">Number</TableHead>
                  <TableHead className="text-slate-900 font-bold">Account Name</TableHead>
                  <TableHead className="w-[110px] text-slate-900 font-bold">Root Type</TableHead>
                  <TableHead className="w-[140px] text-right text-slate-900 font-bold">Debit ($)</TableHead>
                  <TableHead className="w-[140px] text-right text-slate-900 font-bold">Credit ($)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accountsList.map((row: any) => (
                  <TableRow key={row.account} className="hover:bg-slate-50 border-b border-slate-100 bg-white">
                    <TableCell className="font-mono text-sm text-slate-600">{row.accountNumber || '—'}</TableCell>
                    <TableCell className="font-semibold text-slate-900">{row.account}</TableCell>
                    <TableCell>
                      <Badge variant={rootTypeBadge(row.rootType)} className="text-xs">
                        {row.rootType}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm text-slate-900">
                      {row.debit > 0 ? formatCurrency(row.debit) : '—'}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm text-slate-900">
                      {row.credit > 0 ? formatCurrency(row.credit) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
                {accountsList.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-slate-500 py-16 bg-white">
                      No trial balance data available for the selected period
                    </TableCell>
                  </TableRow>
                )}
                {data && (
                  <TableRow className="bg-slate-200 text-slate-900 font-bold border-t-2 border-slate-300">
                    <TableCell colSpan={3} className="font-bold text-slate-900 text-right pr-4">TOTAL</TableCell>
                    <TableCell className="text-right font-mono font-bold text-slate-900">{formatCurrency(data.totalDebit)}</TableCell>
                    <TableCell className="text-right font-mono font-bold text-slate-900">{formatCurrency(data.totalCredit)}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {data && (
            <div className="p-4 border-0 bg-transparent flex items-center justify-between">
              <div className="flex items-center gap-2">
                {data.balanced ? (
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-rose-600" />
                )}
                <span className={`text-sm font-semibold ${data.balanced ? 'text-emerald-800' : 'text-rose-800'}`}>
                  {data.balanced ? 'Trial Balance is in balance — Total Debits equal Total Credits' : 'Trial Balance Out of Balance — Check Journal Entries'}
                </span>
              </div>
              <div className="text-xs font-mono text-slate-700 font-semibold">
                Net Variance: {formatCurrency(Math.abs((data.totalDebit || 0) - (data.totalCredit || 0)))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
