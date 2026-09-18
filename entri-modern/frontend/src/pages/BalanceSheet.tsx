import React, { useEffect, useState } from 'react'
import { api } from '@/utils/api'
import { exportToCSV, exportToPDF } from '@/utils/exportUtils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useCompany } from '@/context/CompanyContext'

export default function BalanceSheet() {
  const { formatCurrency } = useCompany()
  const [data, setData] = useState<any>(null)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

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
            onClick={() => exportToPDF('Balance Sheet')}
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
                <CardTitle className="text-xl font-bold text-black">Statement of Financial Position (Balance Sheet)</CardTitle>
                <CardDescription className="text-xs text-slate-500 font-medium mt-1">
                  As of {toDate || new Date().toISOString().split('T')[0]} • Double-Entry Balanced
                </CardDescription>
              </div>
              <Badge variant="default" className="w-fit text-xs px-3 py-1 font-semibold text-black bg-transparent border-0">
                {data.balanced ? 'Balanced' : 'Out of Balance'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0 bg-transparent">
            <div className="overflow-x-auto bg-transparent">
              <Table className="w-full bg-transparent border-0">
                <TableHeader>
                  <TableRow className="border-0 bg-transparent">
                    <TableHead className="w-[60%] pl-6 py-3 text-black font-bold">Account Name & Category</TableHead>
                    <TableHead className="text-right pr-6 py-3 text-black font-bold">Amount (USD)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="bg-transparent">
                  {/* ASSETS SECTION */}
                  <TableRow className="font-bold text-black border-0 bg-transparent">
                    <TableCell colSpan={2} className="pl-6 py-3 uppercase tracking-wider text-xs font-bold text-black">
                      1. ASSETS
                    </TableCell>
                  </TableRow>
                  {data.assets?.accounts?.map((a: any) => (
                    <TableRow key={a.name} className="border-0 bg-transparent">
                      <TableCell className="pl-10 py-3 font-semibold text-black">{a.name}</TableCell>
                      <TableCell className="text-right pr-6 py-3 font-mono text-black">{formatCurrency(a.balance)}</TableCell>
                    </TableRow>
                  ))}
                  {(!data.assets?.accounts || data.assets.accounts.length === 0) && (
                    <TableRow className="border-0 bg-transparent">
                      <TableCell colSpan={2} className="pl-10 py-3 text-slate-500 italic border-0 bg-transparent">
                        No asset accounts recorded
                      </TableCell>
                    </TableRow>
                  )}
                  {/* Total Assets Row - HAS GREY BG */}
                  <TableRow className="bg-slate-200 font-bold border-0 text-black">
                    <TableCell className="pl-6 py-3 font-bold text-black">Total Assets</TableCell>
                    <TableCell className="text-right pr-6 py-3 font-mono font-bold text-black text-base">
                      {formatCurrency(data.assets?.total)}
                    </TableCell>
                  </TableRow>

                  {/* LIABILITIES SECTION */}
                  <TableRow className="font-bold text-black border-0 bg-transparent">
                    <TableCell colSpan={2} className="pl-6 pt-5 pb-3 uppercase tracking-wider text-xs font-bold text-black">
                      2. LIABILITIES
                    </TableCell>
                  </TableRow>
                  {data.liabilities?.accounts?.map((a: any) => (
                    <TableRow key={a.name} className="border-0 bg-transparent">
                      <TableCell className="pl-10 py-3 font-semibold text-black">{a.name}</TableCell>
                      <TableCell className="text-right pr-6 py-3 font-mono text-black">{formatCurrency(a.balance)}</TableCell>
                    </TableRow>
                  ))}
                  {(!data.liabilities?.accounts || data.liabilities.accounts.length === 0) && (
                    <TableRow className="border-0 bg-transparent">
                      <TableCell colSpan={2} className="pl-10 py-3 text-slate-500 italic border-0 bg-transparent">
                        No liability accounts recorded
                      </TableCell>
                    </TableRow>
                  )}
                  {/* Total Liabilities Row - HAS GREY BG */}
                  <TableRow className="bg-slate-200 font-bold border-0 text-black">
                    <TableCell className="pl-6 py-3 font-bold text-black">Total Liabilities</TableCell>
                    <TableCell className="text-right pr-6 py-3 font-mono font-bold text-black">
                      {formatCurrency(data.liabilities?.total)}
                    </TableCell>
                  </TableRow>

                  {/* EQUITY SECTION */}
                  <TableRow className="font-bold text-black border-0 bg-transparent">
                    <TableCell colSpan={2} className="pl-6 pt-5 pb-3 uppercase tracking-wider text-xs font-bold text-black">
                      3. EQUITY
                    </TableCell>
                  </TableRow>
                  {data.equity?.accounts?.map((a: any) => (
                    <TableRow key={a.name} className="border-0 bg-transparent">
                      <TableCell className="pl-10 py-3 font-semibold text-black">{a.name}</TableCell>
                      <TableCell className="text-right pr-6 py-3 font-mono text-black">{formatCurrency(a.balance)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-0 bg-transparent">
                    <TableCell className="pl-10 py-3 font-semibold text-black">Current Period Net Profit / (Loss)</TableCell>
                    <TableCell className="text-right pr-6 py-3 font-mono font-semibold text-black">
                      {formatCurrency(data.netProfit)}
                    </TableCell>
                  </TableRow>
                  {/* Total Equity Row - HAS GREY BG */}
                  <TableRow className="bg-slate-200 font-bold border-0 text-black">
                    <TableCell className="pl-6 py-3 font-bold text-black">Total Equity</TableCell>
                    <TableCell className="text-right pr-6 py-3 font-mono font-bold text-black">
                      {formatCurrency(data.equity?.total)}
                    </TableCell>
                  </TableRow>

                  {/* GRAND TOTAL SECTION - WITH TOP MARGIN & GREY BG */}
                  <TableRow className="border-0 bg-transparent">
                    <TableCell colSpan={2} className="p-0">
                      <div className="mt-4 bg-slate-200 flex items-center justify-between pl-6 pr-6 py-3 font-bold text-base text-black">
                        <span className="font-bold text-black">TOTAL LIABILITIES & EQUITY</span>
                        <span className="font-mono font-bold text-base text-black">
                          {formatCurrency((data.liabilities?.total || 0) + (data.equity?.total || 0))}
                        </span>
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
          <CardContent className="py-16 text-center text-slate-500">Loading Balance Sheet...</CardContent>
        </Card>
      )}
    </div>
  )
}
