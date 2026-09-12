import React, { useEffect, useState } from 'react'
import { Download, Printer } from 'lucide-react'
import { api } from '@/utils/api'
import { exportToCSV, exportToPDF } from '@/utils/exportUtils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export default function APAging() {
  const [aging, setAging] = useState<any>({ current: 0, periods: { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 }, total: 0 })

  const formatNumber = (v: number) => Number(v || 0).toFixed(2)

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
    const headers = ['Account', 'Current ($)', '0-30 Days ($)', '31-60 Days ($)', '61-90 Days ($)', '90+ Days ($)', 'Total ($)']
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

      <Card className="border-0 bg-slate-50 shadow-sm rounded-2xl overflow-hidden p-0">
        <CardHeader className="border-0 px-6 py-4 bg-transparent">
          <CardTitle className="text-slate-900 font-bold">AP Aging Breakdown</CardTitle>
          <CardDescription className="text-slate-500 font-medium">
            Active Creditors Account Summary
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="w-full">
              <TableHeader>
                <TableRow className="border-b border-slate-200 bg-white">
                  <TableHead className="text-slate-900 font-bold">Account Name</TableHead>
                  <TableHead className="text-right text-slate-900 font-bold">Current ($)</TableHead>
                  <TableHead className="text-right text-slate-900 font-bold">0-30 Days ($)</TableHead>
                  <TableHead className="text-right text-slate-900 font-bold">31-60 Days ($)</TableHead>
                  <TableHead className="text-right text-slate-900 font-bold">61-90 Days ($)</TableHead>
                  <TableHead className="text-right text-slate-900 font-bold">90+ Days ($)</TableHead>
                  <TableHead className="text-right text-slate-900 font-bold">Total ($)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="hover:bg-slate-50 border-b border-slate-100 bg-white">
                  <TableCell className="font-semibold text-slate-900">Creditors (Accounts Payable)</TableCell>
                  <TableCell className="text-right font-mono text-sm text-slate-900">${formatNumber(aging.current)}</TableCell>
                  <TableCell className="text-right font-mono text-sm text-slate-900">${formatNumber(aging.periods?.['0-30'])}</TableCell>
                  <TableCell className="text-right font-mono text-sm text-slate-900">${formatNumber(aging.periods?.['31-60'])}</TableCell>
                  <TableCell className="text-right font-mono text-sm text-slate-900">${formatNumber(aging.periods?.['61-90'])}</TableCell>
                  <TableCell className="text-right font-mono text-sm text-slate-900">${formatNumber(aging.periods?.['90+'])}</TableCell>
                  <TableCell className="text-right font-mono text-sm font-bold text-slate-900">${formatNumber(aging.total)}</TableCell>
                </TableRow>
                {/* Grey Totals Summary Row */}
                <TableRow className="bg-slate-200 text-slate-900 font-bold border-t-2 border-slate-300">
                  <TableCell className="font-bold text-slate-900">TOTAL AP PAYABLES</TableCell>
                  <TableCell className="text-right font-mono font-bold text-slate-900">${formatNumber(aging.current)}</TableCell>
                  <TableCell className="text-right font-mono font-bold text-slate-900">${formatNumber(aging.periods?.['0-30'])}</TableCell>
                  <TableCell className="text-right font-mono font-bold text-slate-900">${formatNumber(aging.periods?.['31-60'])}</TableCell>
                  <TableCell className="text-right font-mono font-bold text-slate-900">${formatNumber(aging.periods?.['61-90'])}</TableCell>
                  <TableCell className="text-right font-mono font-bold text-slate-900">${formatNumber(aging.periods?.['90+'])}</TableCell>
                  <TableCell className="text-right font-mono font-bold text-slate-900">${formatNumber(aging.total)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

