import React, { useEffect, useState } from 'react'
import { api } from '@/utils/api'
import { exportToCSV, exportToPDF } from '@/utils/exportUtils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useCompany } from '@/context/CompanyContext'

export default function ARAging() {
  const { formatCurrency, currencySymbol } = useCompany()
  const [aging, setAging] = useState<any>({})

  useEffect(() => {
    async function load() {
      try {
        const res = await api.getReport('ar-aging')
        setAging(res)
      } catch (e) {
        console.error(e)
      }
    }
    load()
  }, [])

  function handleExportCSV() {
    const headers = ['Account Name', 'Current', '0-30 Days', '31-60 Days', '61-90 Days', '90+ Days', 'Total']
    const rows = [
      [
        'Debtors (Accounts Receivable)',
        aging.current || 0,
        aging.periods?.['0-30'] || 0,
        aging.periods?.['31-60'] || 0,
        aging.periods?.['61-90'] || 0,
        aging.periods?.['90+'] || 0,
        aging.total || 0,
      ],
      [
        'TOTAL',
        aging.current || 0,
        aging.periods?.['0-30'] || 0,
        aging.periods?.['31-60'] || 0,
        aging.periods?.['61-90'] || 0,
        aging.periods?.['90+'] || 0,
        aging.total || 0,
      ]
    ]
    exportToCSV('AR_Aging_Report', headers, rows)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Accounts Receivable Aging</h1>
          <p className="text-sm text-gray-500 mt-1">Outstanding customer receivables categorized by age</p>
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
            onClick={() => exportToPDF('Accounts Receivable Aging')}
            className="bg-blue-600 hover:bg-blue-700 text-white border border-black font-semibold"
          >
            Export PDF
          </Button>
        </div>
      </div>

      <Card className="border-0 bg-transparent shadow-none p-0">
        <CardHeader className="border-0 px-0 py-4 bg-transparent">
          <CardTitle className="text-black font-bold">AR Aging Breakdown</CardTitle>
          <CardDescription className="text-slate-500 font-medium">
            Active Debtors Account Summary
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 bg-transparent">
          <div className="overflow-x-auto bg-transparent">
            <Table className="w-full bg-transparent border-0">
              <TableHeader>
                <TableRow className="border-0 bg-transparent">
                  <TableHead className="text-black font-bold">Account Name</TableHead>
                  <TableHead className="text-right text-black font-bold">Current ({currencySymbol})</TableHead>
                  <TableHead className="text-right text-black font-bold">0-30 Days ({currencySymbol})</TableHead>
                  <TableHead className="text-right text-black font-bold">31-60 Days ({currencySymbol})</TableHead>
                  <TableHead className="text-right text-black font-bold">61-90 Days ({currencySymbol})</TableHead>
                  <TableHead className="text-right text-black font-bold">90+ Days ({currencySymbol})</TableHead>
                  <TableHead className="text-right text-black font-bold">Total ({currencySymbol})</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="bg-transparent">
                <TableRow className="border-0 bg-transparent">
                  <TableCell className="font-semibold text-black">Debtors (Accounts Receivable)</TableCell>
                  <TableCell className="text-right font-mono text-sm text-black">{formatCurrency(aging.current)}</TableCell>
                  <TableCell className="text-right font-mono text-sm text-black">{formatCurrency(aging.periods?.['0-30'])}</TableCell>
                  <TableCell className="text-right font-mono text-sm text-black">{formatCurrency(aging.periods?.['31-60'])}</TableCell>
                  <TableCell className="text-right font-mono text-sm text-black">{formatCurrency(aging.periods?.['61-90'])}</TableCell>
                  <TableCell className="text-right font-mono text-sm text-black">{formatCurrency(aging.periods?.['90+'])}</TableCell>
                  <TableCell className="text-right font-mono text-sm font-bold text-black">{formatCurrency(aging.total)}</TableCell>
                </TableRow>
                {/* Totals Summary Row - HAS GREY BG */}
                <TableRow className="bg-slate-200 text-black font-bold border-0">
                  <TableCell className="font-bold text-black">TOTAL</TableCell>
                  <TableCell className="text-right font-mono font-bold text-black">{formatCurrency(aging.current)}</TableCell>
                  <TableCell className="text-right font-mono font-bold text-black">{formatCurrency(aging.periods?.['0-30'])}</TableCell>
                  <TableCell className="text-right font-mono font-bold text-black">{formatCurrency(aging.periods?.['31-60'])}</TableCell>
                  <TableCell className="text-right font-mono font-bold text-black">{formatCurrency(aging.periods?.['61-90'])}</TableCell>
                  <TableCell className="text-right font-mono font-bold text-black">{formatCurrency(aging.periods?.['90+'])}</TableCell>
                  <TableCell className="text-right font-mono font-bold text-black">{formatCurrency(aging.total)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
