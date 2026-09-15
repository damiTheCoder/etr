import React, { useEffect, useState } from 'react'
import { Download, Printer } from 'lucide-react'
import { api } from '@/utils/api'
import { exportToCSV, exportToPDF } from '@/utils/exportUtils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export default function ProfitAndLoss() {
  const [data, setData] = useState<any>(null)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  function formatCurrency(v: number) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v || 0)
  }

  async function loadReport() {
    try {
      const params: Record<string, string> = {}
      if (fromDate) params.from_date = fromDate
      if (toDate) params.to_date = toDate
      const res = await api.getReport('profit-and-loss', params)
      setData(res)
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    loadReport()
  }, [])

  const expenseMargin = data && data.income?.total ? (data.expenses.total / data.income.total) * 100 : 0

  function handleExportCSV() {
    if (!data) return
    const headers = ['Category / Account', 'Margin %', 'Amount ($)']
    const rows: (string | number)[][] = []

    rows.push(['1. REVENUE & INCOME', '', ''])
    data.income?.accounts?.forEach((a: any) => rows.push([
      `   ${a.name}`,
      data.income.total ? `${((a.balance / data.income.total) * 100).toFixed(1)}%` : '0%',
      a.balance
    ]))
    rows.push(['Total Income / Revenue', '100.0%', data.income?.total || 0])
    rows.push(['', '', ''])

    rows.push(['2. OPERATING EXPENSES', '', ''])
    data.expenses?.accounts?.forEach((a: any) => rows.push([
      `   ${a.name}`,
      data.income?.total ? `${((a.balance / data.income.total) * 100).toFixed(1)}%` : '0%',
      a.balance
    ]))
    rows.push(['Total Operating Expenses', `${expenseMargin.toFixed(1)}%`, data.expenses?.total || 0])
    rows.push(['', '', ''])

    rows.push(['NET PROFIT / (LOSS)', `${(data.netProfitMargin || 0).toFixed(1)}%`, data.netProfit || 0])

    exportToCSV('Profit_and_Loss', headers, rows)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Profit & Loss</h1>
          <p className="text-sm text-gray-500 mt-1">Income, expenses, and net profitability statement</p>
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
          <Button size="sm" onClick={() => exportToPDF('Profit & Loss Statement')} className="bg-blue-600 hover:bg-blue-700 text-white">
            <Printer className="w-4 h-4 mr-1.5" /> Export PDF
          </Button>
        </div>
      </div>

      {data ? (
        <Card className="border-none bg-transparent shadow-none p-0">
          <CardHeader className="border-none px-0 py-4 bg-transparent">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <CardTitle className="text-xl font-bold text-slate-900">Statement of Profit & Loss (Income Statement)</CardTitle>
                <CardDescription className="text-xs text-slate-500 font-medium mt-1">
                  Selected Financial Period • IFRS/GAAP Standard
                </CardDescription>
              </div>
              <Badge variant={data.netProfit >= 0 ? 'default' : 'destructive'} className="w-fit text-xs px-3 py-1 font-semibold">
                Net Margin: {(data.netProfitMargin || 0).toFixed(1)}%
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0 bg-transparent">
            <div className="overflow-x-auto">
              <Table className="w-full bg-transparent">
                <TableHeader>
                  <TableRow className="border-b border-slate-300 bg-slate-100">
                    <TableHead className="w-[50%] pl-6 text-slate-900 font-bold">Account Category & Name</TableHead>
                    <TableHead className="text-right text-slate-900 font-bold">Margin %</TableHead>
                    <TableHead className="text-right pr-6 text-slate-900 font-bold">Amount (USD)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="bg-transparent">
                  {/* INCOME SECTION */}
                  <TableRow className="font-bold text-slate-900 border-b border-slate-200 bg-slate-200/70">
                    <TableCell colSpan={3} className="pl-6 py-2.5 uppercase tracking-wider text-xs font-bold text-slate-900">
                      1. REVENUE & INCOME
                    </TableCell>
                  </TableRow>
                  {data.income?.accounts?.map((a: any) => (
                    <TableRow key={a.name} className="hover:bg-slate-50 border-b border-slate-100 bg-transparent">
                      <TableCell className="pl-10 font-semibold text-slate-800">{a.name}</TableCell>
                      <TableCell className="text-right text-slate-600 text-sm font-mono">
                        {data.income.total ? ((a.balance / data.income.total) * 100).toFixed(1) + '%' : '0.0%'}
                      </TableCell>
                      <TableCell className="text-right pr-6 font-mono text-slate-900">{formatCurrency(a.balance)}</TableCell>
                    </TableRow>
                  ))}
                  {(!data.income?.accounts || data.income.accounts.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={3} className="pl-10 text-slate-500 py-3 italic border-b border-slate-100 bg-transparent">
                        No income accounts recorded
                      </TableCell>
                    </TableRow>
                  )}
                  <TableRow className="bg-transparent font-bold border-t border-b border-slate-200">
                    <TableCell className="pl-6 font-bold text-slate-900">Total Income / Revenue</TableCell>
                    <TableCell className="text-right text-slate-900 font-bold">100.0%</TableCell>
                    <TableCell className="text-right pr-6 font-mono font-bold text-slate-900 text-base">
                      {formatCurrency(data.income?.total)}
                    </TableCell>
                  </TableRow>

                  {/* EXPENSES SECTION */}
                  <TableRow className="font-bold text-slate-900 border-b border-slate-200 bg-slate-200/70">
                    <TableCell colSpan={3} className="pl-6 py-2.5 uppercase tracking-wider text-xs font-bold text-slate-900">
                      2. OPERATING EXPENSES
                    </TableCell>
                  </TableRow>
                  {data.expenses?.accounts?.map((a: any) => (
                    <TableRow key={a.name} className="hover:bg-slate-50 border-b border-slate-100 bg-transparent">
                      <TableCell className="pl-10 font-semibold text-slate-800">{a.name}</TableCell>
                      <TableCell className="text-right text-slate-600 text-sm font-mono">
                        {data.income?.total ? ((a.balance / data.income.total) * 100).toFixed(1) + '%' : '—'}
                      </TableCell>
                      <TableCell className="text-right pr-6 font-mono text-slate-900">{formatCurrency(a.balance)}</TableCell>
                    </TableRow>
                  ))}
                  {(!data.expenses?.accounts || data.expenses.accounts.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={3} className="pl-10 text-slate-500 py-3 italic border-b border-slate-100 bg-transparent">
                        No expense accounts recorded
                      </TableCell>
                    </TableRow>
                  )}
                  <TableRow className="bg-transparent font-bold border-t border-b border-slate-200">
                    <TableCell className="pl-6 font-bold text-slate-900">Total Operating Expenses</TableCell>
                    <TableCell className="text-right text-slate-900 font-bold">{expenseMargin.toFixed(1)}%</TableCell>
                    <TableCell className="text-right pr-6 font-mono font-bold text-slate-900">
                      {formatCurrency(data.expenses?.total)}
                    </TableCell>
                  </TableRow>

                  {/* NET PROFIT GRAND TOTAL */}
                  <TableRow className="bg-transparent font-bold border-t-2 border-b-2 border-slate-300 text-base">
                    <TableCell className="pl-6 font-bold text-slate-900">NET PROFIT / (LOSS)</TableCell>
                    <TableCell className={`text-right font-bold ${data.netProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {(data.netProfitMargin || 0).toFixed(1)}%
                    </TableCell>
                    <TableCell className={`text-right pr-6 font-mono font-bold text-base ${data.netProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {formatCurrency(data.netProfit)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-transparent border-0 shadow-none">
          <CardContent className="py-16 text-center text-slate-500">Loading Profit & Loss Statement...</CardContent>
        </Card>
      )}
    </div>
  )
}
