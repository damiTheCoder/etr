import React, { useEffect, useState } from 'react'
import { Download, Printer } from 'lucide-react'
import { api } from '@/utils/api'
import { exportToCSV, exportToPDF } from '@/utils/exportUtils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useCompany } from '@/context/CompanyContext'

export default function APAging() {
  const { formatCurrency, currencySymbol } = useCompany()
  const [aging, setAging] = useState<any>({ current: 0, periods: { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 }, total: 0 })

  useEffect(() => {
    async function loadData() {
      try {
        const data = await api.getReport('ap-aging')
        setAging(data || { current: 0, periods: { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 }, total: 0 })
      } catch (e) {
        console.error('Failed to load AP aging:', e)
      }
    }
    loadData()
  }, [])

  function handleExportCSV() {
    const headers = [`Account`, `Current (${currencySymbol})`, `0-30 Days (${currencySymbol})`, `31-60 Days (${currencySymbol})`, `61-90 Days (${currencySymbol})`, `90+ Days (${currencySymbol})`, `Total (${currencySymbol})`]
    const rows = [
      [
        'Creditors (Accounts Payable)',
        aging.current || 0,
        aging.periods?.['0-30'] || 0,
        aging.periods?.['31-60'] || 0,
        aging.periods?.['61-90'] || 0,
        aging.periods?.['90+'] || 0,
        aging.total || 0,
      ]
    ]
    exportToCSV('AP_Aging_Report', headers, rows)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Accounts Payable Aging</h1>
          <p className="text-sm text-gray-500 mt-1">Outstanding vendor payables categorized by age</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="border-slate-300">
            <Download className="w-4 h-4 mr-1.5" /> Export Excel / CSV
          </Button>
          <Button size="sm" onClick={() => exportToPDF('Accounts Payable Aging')} className="bg-blue-600 hover:bg-blue-700 text-white">
            <Printer className="w-4 h-4 mr-1.5" /> Export PDF
          </Button>
        </div>
      </div>

      <Card className="border-none bg-transparent shadow-none p-0">
        <CardHeader className="border-none px-0 py-4 bg-transparent">
          <CardTitle className="text-slate-900 font-bold">AP Aging Breakdown</CardTitle>
          <CardDescription className="text-slate-500 font-medium">
            Active Creditors Account Summary
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 bg-transparent">
          <div className="overflow-x-auto">
            <Table className="w-full bg-transparent">
              <TableHeader>
                <TableRow className="border-b border-slate-300 bg-slate-100">
                  <TableHead className="text-slate-900 font-bold">Account Name</TableHead>
                  <TableHead className="text-right text-slate-900 font-bold">Current ({currencySymbol})</TableHead>
                  <TableHead className="text-right text-slate-900 font-bold">0-30 Days ({currencySymbol})</TableHead>
                  <TableHead className="text-right text-slate-900 font-bold">31-60 Days ({currencySymbol})</TableHead>
                  <TableHead className="text-right text-slate-900 font-bold">61-90 Days ({currencySymbol})</TableHead>
                  <TableHead className="text-right text-slate-900 font-bold">90+ Days ({currencySymbol})</TableHead>
                  <TableHead className="text-right text-slate-900 font-bold">Total ({currencySymbol})</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="bg-transparent">
                <TableRow className="hover:bg-slate-50 border-b border-slate-100 bg-transparent">
                  <TableCell className="font-semibold text-slate-900">Creditors (Accounts Payable)</TableCell>
                  <TableCell className="text-right font-mono text-sm text-slate-900">{formatCurrency(aging.current)}</TableCell>
                  <TableCell className="text-right font-mono text-sm text-slate-900">{formatCurrency(aging.periods?.['0-30'])}</TableCell>
                  <TableCell className="text-right font-mono text-sm text-slate-900">{formatCurrency(aging.periods?.['31-60'])}</TableCell>
                  <TableCell className="text-right font-mono text-sm text-slate-900">{formatCurrency(aging.periods?.['61-90'])}</TableCell>
                  <TableCell className="text-right font-mono text-sm text-slate-900">{formatCurrency(aging.periods?.['90+'])}</TableCell>
                  <TableCell className="text-right font-mono text-sm font-bold text-slate-900">{formatCurrency(aging.total)}</TableCell>
                </TableRow>
                {/* Totals Summary Row */}
                <TableRow className="bg-transparent text-slate-900 font-bold border-t-2 border-b-2 border-slate-300">
                  <TableCell className="font-bold text-slate-900">TOTAL AP PAYABLES</TableCell>
                  <TableCell className="text-right font-mono font-bold text-slate-900">{formatCurrency(aging.current)}</TableCell>
                  <TableCell className="text-right font-mono font-bold text-slate-900">{formatCurrency(aging.periods?.['0-30'])}</TableCell>
                  <TableCell className="text-right font-mono font-bold text-slate-900">{formatCurrency(aging.periods?.['31-60'])}</TableCell>
                  <TableCell className="text-right font-mono font-bold text-slate-900">{formatCurrency(aging.periods?.['61-90'])}</TableCell>
                  <TableCell className="text-right font-mono font-bold text-slate-900">{formatCurrency(aging.periods?.['90+'])}</TableCell>
                  <TableCell className="text-right font-mono font-bold text-slate-900">{formatCurrency(aging.total)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

