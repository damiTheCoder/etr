import React, { useEffect, useState } from 'react'
import { Download, Printer } from 'lucide-react'
import { api } from '@/utils/api'
import { exportToCSV, exportToPDF } from '@/utils/exportUtils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export default function BalanceSheet() {
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
      const res = await api.getReport('balance-sheet', params)
      setData(res)
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    loadReport()
  }, [])

  function handleExportCSV() {
    if (!data) return
    const headers = ['Category / Account', 'Balance ($)']
    const rows: (string | number)[][] = []

    rows.push(['1. ASSETS', ''])
    data.assets?.accounts?.forEach((a: any) => rows.push([`   ${a.name}`, a.balance]))
    rows.push(['Total Assets', data.assets?.total || 0])
    rows.push(['', ''])

    rows.push(['2. LIABILITIES', ''])
    data.liabilities?.accounts?.forEach((a: any) => rows.push([`   ${a.name}`, a.balance]))
    rows.push(['Total Liabilities', data.liabilities?.total || 0])
    rows.push(['', ''])

    rows.push(['3. EQUITY', ''])
    data.equity?.accounts?.forEach((a: any) => rows.push([`   ${a.name}`, a.balance]))
    rows.push(['   Current Period Net Profit / (Loss)', data.netProfit || 0])
    rows.push(['Total Equity', data.equity?.total || 0])
    rows.push(['', ''])

    rows.push(['TOTAL LIABILITIES & EQUITY', (data.liabilities?.total || 0) + (data.equity?.total || 0)])

    exportToCSV('Balance_Sheet', headers, rows)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Balance Sheet</h1>
          <p className="text-sm text-gray-500 mt-1">Assets, liabilities, and equity financial position</p>
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
          <Button size="sm" onClick={() => exportToPDF('Balance Sheet')} className="bg-blue-600 hover:bg-blue-700 text-white">
            <Printer className="w-4 h-4 mr-1.5" /> Export PDF
          </Button>
        </div>
      </div>

      {data ? (
        <Card className="border-none bg-slate-100/60 shadow-2xs rounded-2xl overflow-hidden p-0">
          <CardHeader className="border-none px-6 py-4 bg-transparent">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <CardTitle className="text-xl font-bold text-slate-900">Statement of Financial Position (Balance Sheet)</CardTitle>
                <CardDescription className="text-xs text-slate-500 font-medium mt-1">
                  As of {toDate || new Date().toISOString().split('T')[0]} • Double-Entry Balanced
                </CardDescription>
              </div>
              <Badge variant={data.balanced ? 'default' : 'destructive'} className="w-fit text-xs px-3 py-1 font-semibold">
                {data.balanced ? '✓ Balanced' : '⚠️ Out of Balance'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table className="w-full">
                <TableHeader>
                  <TableRow className="border-b border-slate-200/40 bg-slate-200/30">
                    <TableHead className="w-[60%] pl-6 text-slate-900 font-bold">Account Name & Category</TableHead>
                    <TableHead className="text-right pr-6 text-slate-900 font-bold">Amount (USD)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* ASSETS SECTION */}
                  <TableRow className="font-bold text-slate-900 border-b border-slate-200/40 bg-slate-200/40">
                    <TableCell colSpan={2} className="pl-6 py-2.5 uppercase tracking-wider text-xs font-bold text-slate-900">
                      1. ASSETS
                    </TableCell>
                  </TableRow>
                  {data.assets?.accounts?.map((a: any) => (
                    <TableRow key={a.name} className="hover:bg-slate-200/30 border-b border-slate-200/30 bg-transparent">
                      <TableCell className="pl-10 font-semibold text-slate-800">{a.name}</TableCell>
                      <TableCell className="text-right pr-6 font-mono text-slate-900">{formatCurrency(a.balance)}</TableCell>
                    </TableRow>
                  ))}
                  {(!data.assets?.accounts || data.assets.accounts.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={2} className="pl-10 text-slate-500 py-3 italic border-b border-slate-200/30 bg-transparent">
                        No asset accounts recorded
                      </TableCell>
                    </TableRow>
                  )}
                  <TableRow className="bg-slate-200/60 font-bold border-t border-b border-slate-200/50">
                    <TableCell className="pl-6 font-bold text-slate-900">Total Assets</TableCell>
                    <TableCell className="text-right pr-6 font-mono font-bold text-slate-900 text-base">
                      {formatCurrency(data.assets?.total)}
                    </TableCell>
                  </TableRow>

                  {/* LIABILITIES SECTION */}
                  <TableRow className="font-bold text-slate-900 border-b border-slate-200/40 bg-slate-200/40">
                    <TableCell colSpan={2} className="pl-6 py-2.5 uppercase tracking-wider text-xs font-bold text-slate-900">
                      2. LIABILITIES
                    </TableCell>
                  </TableRow>
                  {data.liabilities?.accounts?.map((a: any) => (
                    <TableRow key={a.name} className="hover:bg-slate-200/30 border-b border-slate-200/30 bg-transparent">
                      <TableCell className="pl-10 font-semibold text-slate-800">{a.name}</TableCell>
                      <TableCell className="text-right pr-6 font-mono text-slate-900">{formatCurrency(a.balance)}</TableCell>
                    </TableRow>
                  ))}
                  {(!data.liabilities?.accounts || data.liabilities.accounts.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={2} className="pl-10 text-slate-500 py-3 italic border-b border-slate-200/30 bg-transparent">
                        No liability accounts recorded
                      </TableCell>
                    </TableRow>
                  )}
                  <TableRow className="bg-slate-200/60 font-bold border-t border-b border-slate-200/50">
                    <TableCell className="pl-6 font-bold text-slate-900">Total Liabilities</TableCell>
                    <TableCell className="text-right pr-6 font-mono font-bold text-slate-900">
                      {formatCurrency(data.liabilities?.total)}
                    </TableCell>
                  </TableRow>

                  {/* EQUITY SECTION */}
                  <TableRow className="font-bold text-slate-900 border-b border-slate-200/40 bg-slate-200/40">
                    <TableCell colSpan={2} className="pl-6 py-2.5 uppercase tracking-wider text-xs font-bold text-slate-900">
                      3. EQUITY
                    </TableCell>
                  </TableRow>
                  {data.equity?.accounts?.map((a: any) => (
                    <TableRow key={a.name} className="hover:bg-slate-200/30 border-b border-slate-200/30 bg-transparent">
                      <TableCell className="pl-10 font-semibold text-slate-800">{a.name}</TableCell>
                      <TableCell className="text-right pr-6 font-mono text-slate-900">{formatCurrency(a.balance)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="hover:bg-slate-200/30 border-b border-slate-200/30 bg-transparent">
                    <TableCell className="pl-10 font-semibold text-slate-800">Current Period Net Profit / (Loss)</TableCell>
                    <TableCell className={`text-right pr-6 font-mono font-semibold ${data.netProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {formatCurrency(data.netProfit)}
                    </TableCell>
                  </TableRow>
                  <TableRow className="bg-slate-200/60 font-bold border-t border-b border-slate-200/50">
                    <TableCell className="pl-6 font-bold text-slate-900">Total Equity</TableCell>
                    <TableCell className="text-right pr-6 font-mono font-bold text-slate-900">
                      {formatCurrency(data.equity?.total)}
                    </TableCell>
                  </TableRow>

                  {/* GRAND TOTAL SECTION */}
                  <TableRow className="bg-slate-200/80 font-bold border-t border-slate-300/60 text-base">
                    <TableCell className="pl-6 font-bold text-slate-900">TOTAL LIABILITIES & EQUITY</TableCell>
                    <TableCell className="text-right pr-6 font-mono font-bold text-slate-900 text-base">
                      {formatCurrency((data.liabilities?.total || 0) + (data.equity?.total || 0))}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-slate-100 border-0">
          <CardContent className="py-16 text-center text-slate-500">Loading Balance Sheet...</CardContent>
        </Card>
      )}
    </div>
  )
}
