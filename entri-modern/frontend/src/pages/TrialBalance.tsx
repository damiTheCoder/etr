import React, { useEffect, useState } from 'react'
import { api } from '@/utils/api'
import { exportToCSV, exportToPDF } from '@/utils/exportUtils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useCompany } from '@/context/CompanyContext'

export default function TrialBalance() {
  const { formatCurrency } = useCompany()
  const [data, setData] = useState<any>(null)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

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

  function rootTypeBadge(type: string) {
    switch (type) {
      case 'Asset': return 'default'
      case 'Liability': return 'secondary'
      case 'Equity': return 'outline'
      case 'Income': return 'default'
      case 'Expense': return 'destructive'
      default: return 'outline'
    }
  }

  function handleExportCSV() {
    if (!data) return
    const headers = ['Account Number', 'Account Name', 'Root Type', 'Debit ($)', 'Credit ($)']
    const rows = (data.accounts || []).map((row: any) => [
      row.accountNumber || '',
      row.account || '',
      row.rootType || '',
      row.debit || 0,
      row.credit || 0
    ])

    rows.push(['', 'TOTAL', '', data.totalDebit || 0, data.totalCredit || 0])
    exportToCSV('Trial_Balance', headers, rows)
  }

  const accountsList = data?.accounts || []

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Trial Balance</h1>
          <p className="text-sm text-gray-500 mt-1">Debit & credit verification across all ledger accounts</p>
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
            onClick={() => exportToPDF('Trial Balance')}
            className="bg-blue-600 hover:bg-blue-700 text-white border border-black font-semibold"
          >
            Export PDF
          </Button>
        </div>
      </div>

      <Card className="border-0 bg-transparent shadow-none p-0">
        <CardHeader className="border-0 px-0 py-4 bg-transparent">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-black font-bold">Trial Balance Summary</CardTitle>
              <CardDescription className="text-slate-500 font-medium">
                {accountsList.length} active accounts evaluated
              </CardDescription>
            </div>
            {data && (
              <Badge variant="default" className="text-xs px-3 py-1 font-semibold text-black bg-transparent border-0">
                {data.balanced ? 'Balanced' : 'Unbalanced'}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0 bg-transparent">
          <div className="overflow-x-auto bg-transparent">
            <Table className="w-full bg-transparent border-0">
              <TableHeader>
                <TableRow className="border-0 bg-transparent">
                  <TableHead className="w-[100px] py-3 text-black font-bold">Number</TableHead>
                  <TableHead className="py-3 text-black font-bold">Account Name</TableHead>
                  <TableHead className="w-[110px] py-3 text-black font-bold">Root Type</TableHead>
                  <TableHead className="w-[140px] py-3 text-right text-black font-bold">Debit ($)</TableHead>
                  <TableHead className="w-[140px] py-3 text-right text-black font-bold">Credit ($)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="bg-transparent">
                {accountsList.map((row: any) => (
                  <TableRow key={row.account} className="border-0 bg-transparent">
                    <TableCell className="py-3 font-mono text-sm text-black">{row.accountNumber || '—'}</TableCell>
                    <TableCell className="py-3 font-semibold text-black">{row.account}</TableCell>
                    <TableCell className="py-3">
                      <Badge variant="outline" className="text-xs text-black border-slate-300">
                        {row.rootType}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-3 text-right font-mono text-sm text-black">
                      {row.debit > 0 ? formatCurrency(row.debit) : '—'}
                    </TableCell>
                    <TableCell className="py-3 text-right font-mono text-sm text-black">
                      {row.credit > 0 ? formatCurrency(row.credit) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
                {accountsList.length === 0 && (
                  <TableRow className="border-0 bg-transparent">
                    <TableCell colSpan={5} className="text-center text-slate-500 py-16 bg-transparent border-0">
                      No trial balance data available for the selected period
                    </TableCell>
                  </TableRow>
                )}
                {/* Total Row - WITH TOP MARGIN & GREY BG */}
                {data && (
                  <TableRow className="border-0 bg-transparent">
                    <TableCell colSpan={5} className="p-0">
                      <div className="mt-4 bg-slate-200 flex items-center justify-between pl-6 pr-6 py-3 font-bold text-black">
                        <span className="font-bold text-black">TOTAL</span>
                        <div className="flex items-center gap-16">
                          <span className="font-mono font-bold text-black">
                            {formatCurrency(data.totalDebit)}
                          </span>
                          <span className="font-mono font-bold text-black">
                            {formatCurrency(data.totalCredit)}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {data && (
            <div className="p-4 border-0 bg-transparent flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-black">
                  {data.balanced ? 'Trial Balance is in balance — Total Debits equal Total Credits' : 'Trial Balance Out of Balance — Check Journal Entries'}
                </span>
              </div>
              <div className="text-xs font-mono text-black font-semibold">
                Net Variance: {formatCurrency(Math.abs((data.totalDebit || 0) - (data.totalCredit || 0)))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
