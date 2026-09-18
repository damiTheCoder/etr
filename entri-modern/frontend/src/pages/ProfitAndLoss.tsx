import React, { useEffect, useState } from 'react'
import { api } from '@/utils/api'
import { exportToCSV, exportToPDF } from '@/utils/exportUtils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useCompany } from '@/context/CompanyContext'

export default function ProfitAndLoss() {
  const { formatCurrency } = useCompany()
  const [data, setData] = useState<any>(null)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

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
          <Button
            size="sm"
            onClick={loadReport}
            className="bg-blue-600 hover:bg-blue-700 text-white border border-black font-semibold"
          >
            Apply
          </Button>
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
            onClick={() => exportToPDF('Profit & Loss Statement')}
            className="bg-blue-600 hover:bg-blue-700 text-white border border-black font-semibold"
          >
            Export PDF
          </Button>
        </div>
      </div>

      {data ? (
        <Card className="border-0 bg-transparent shadow-none p-0">
          <CardHeader className="border-0 px-0 py-4 bg-transparent">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <CardTitle className="text-xl font-bold text-black">Statement of Profit & Loss (Income Statement)</CardTitle>
                <CardDescription className="text-xs text-slate-500 font-medium mt-1">
                  Selected Financial Period • IFRS/GAAP Standard
                </CardDescription>
              </div>
              <Badge variant="default" className="w-fit text-xs px-3 py-1 font-semibold text-black bg-transparent border-0">
                Net Margin: {(data.netProfitMargin || 0).toFixed(1)}%
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0 bg-transparent">
            <div className="overflow-x-auto bg-transparent">
              <Table className="w-full bg-transparent border-0">
                <TableHeader>
                  <TableRow className="border-0 bg-transparent">
                    <TableHead className="w-[50%] pl-6 py-3 text-black font-bold">Account Category & Name</TableHead>
                    <TableHead className="text-right py-3 text-black font-bold">Margin %</TableHead>
                    <TableHead className="text-right pr-6 py-3 text-black font-bold">Amount (USD)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="bg-transparent">
                  {/* INCOME SECTION */}
                  <TableRow className="font-bold text-black border-0 bg-transparent">
                    <TableCell colSpan={3} className="pl-6 py-3 uppercase tracking-wider text-xs font-bold text-black">
                      1. REVENUE & INCOME
                    </TableCell>
                  </TableRow>
                  {data.income?.accounts?.map((a: any) => (
                    <TableRow key={a.name} className="border-0 bg-transparent">
                      <TableCell className="pl-10 py-3 font-semibold text-black">{a.name}</TableCell>
                      <TableCell className="text-right py-3 text-black text-sm font-mono">
                        {data.income.total ? ((a.balance / data.income.total) * 100).toFixed(1) + '%' : '0.0%'}
                      </TableCell>
                      <TableCell className="text-right pr-6 py-3 font-mono text-black">{formatCurrency(a.balance)}</TableCell>
                    </TableRow>
                  ))}
                  {(!data.income?.accounts || data.income.accounts.length === 0) && (
                    <TableRow className="border-0 bg-transparent">
                      <TableCell colSpan={3} className="pl-10 py-3 text-slate-500 italic border-0 bg-transparent">
                        No income accounts recorded
                      </TableCell>
                    </TableRow>
                  )}
                  {/* Total Income Row - HAS GREY BG */}
                  <TableRow className="bg-slate-200 font-bold border-0 text-black">
                    <TableCell className="pl-6 py-3 font-bold text-black">Total Income / Revenue</TableCell>
                    <TableCell className="text-right py-3 text-black font-bold">100.0%</TableCell>
                    <TableCell className="text-right pr-6 py-3 font-mono font-bold text-black text-base">
                      {formatCurrency(data.income?.total)}
                    </TableCell>
                  </TableRow>

                  {/* EXPENSES SECTION */}
                  <TableRow className="font-bold text-black border-0 bg-transparent">
                    <TableCell colSpan={3} className="pl-6 pt-5 pb-3 uppercase tracking-wider text-xs font-bold text-black">
                      2. OPERATING EXPENSES
                    </TableCell>
                  </TableRow>
                  {data.expenses?.accounts?.map((a: any) => (
                    <TableRow key={a.name} className="border-0 bg-transparent">
                      <TableCell className="pl-10 py-3 font-semibold text-black">{a.name}</TableCell>
                      <TableCell className="text-right py-3 text-black text-sm font-mono">
                        {data.income?.total ? ((a.balance / data.income.total) * 100).toFixed(1) + '%' : '—'}
                      </TableCell>
                      <TableCell className="text-right pr-6 py-3 font-mono text-black">{formatCurrency(a.balance)}</TableCell>
                    </TableRow>
                  ))}
                  {(!data.expenses?.accounts || data.expenses.accounts.length === 0) && (
                    <TableRow className="border-0 bg-transparent">
                      <TableCell colSpan={3} className="pl-10 py-3 text-slate-500 italic border-0 bg-transparent">
                        No expense accounts recorded
                      </TableCell>
                    </TableRow>
                  )}
                  {/* Total Operating Expenses - HAS GREY BG */}
                  <TableRow className="bg-slate-200 font-bold border-0 text-black">
                    <TableCell className="pl-6 py-3 font-bold text-black">Total Operating Expenses</TableCell>
                    <TableCell className="text-right py-3 text-black font-bold">{expenseMargin.toFixed(1)}%</TableCell>
                    <TableCell className="text-right pr-6 py-3 font-mono font-bold text-black">
                      {formatCurrency(data.expenses?.total)}
                    </TableCell>
                  </TableRow>

                  {/* NET PROFIT GRAND TOTAL - WITH TOP MARGIN & GREY BG */}
                  <TableRow className="border-0 bg-transparent">
                    <TableCell colSpan={3} className="p-0">
                      <div className="mt-4 bg-slate-200 flex items-center justify-between pl-6 pr-6 py-3 font-bold text-base text-black">
                        <span className="font-bold text-black">NET PROFIT / (LOSS)</span>
                        <div className="flex items-center gap-12">
                          <span className="font-bold text-black">
                            {(data.netProfitMargin || 0).toFixed(1)}%
                          </span>
                          <span className="font-mono font-bold text-base text-black">
                            {formatCurrency(data.netProfit)}
                          </span>
                        </div>
                      </div>
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
