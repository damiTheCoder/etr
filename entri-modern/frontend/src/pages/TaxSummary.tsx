import React, { useEffect, useState } from 'react'
import { Download, Printer } from 'lucide-react'
import { api } from '@/utils/api'
import { exportToCSV, exportToPDF } from '@/utils/exportUtils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export default function TaxSummary() {
  const [taxAccounts, setTaxAccounts] = useState<Record<string, any>>({})

  const formatNumber = (v: number) => Number(v || 0).toFixed(2)

  useEffect(() => {
    async function loadData() {
      try {
        const data = await api.getReport('tax-summary')
        setTaxAccounts(data?.accounts || {})
      } catch (e) {
        console.error('Failed to load tax summary:', e)
      }
    }
    loadData()
  }, [])

  const accountKeys = Object.keys(taxAccounts)

  const totalDebit = accountKeys.reduce((sum, k) => sum + (taxAccounts[k]?.debit || 0), 0)
  const totalCredit = accountKeys.reduce((sum, k) => sum + (taxAccounts[k]?.credit || 0), 0)
  const totalBalance = accountKeys.reduce((sum, k) => sum + (taxAccounts[k]?.balance || 0), 0)

  function handleExportCSV() {
    const headers = ['Account', 'Debit ($)', 'Credit ($)', 'Balance ($)']
    const rows = accountKeys.map((name) => [
      name,
      taxAccounts[name]?.debit || 0,
      taxAccounts[name]?.credit || 0,
      taxAccounts[name]?.balance || 0,
    ])
    rows.push(['TOTAL TAX SUMMARY', totalDebit, totalCredit, totalBalance])
    exportToCSV('Tax_Summary_Report', headers, rows)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Tax Summary</h1>
          <p className="text-sm text-gray-500 mt-1">Tax payable and receivable account breakdown</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="border-slate-300">
            <Download className="w-4 h-4 mr-1.5" /> Export Excel / CSV
          </Button>
          <Button size="sm" onClick={() => exportToPDF('Tax Summary')} className="bg-blue-600 hover:bg-blue-700 text-white">
            <Printer className="w-4 h-4 mr-1.5" /> Export PDF
          </Button>
        </div>
      </div>

      <Card className="border-none bg-transparent shadow-none p-0">
        <CardHeader className="border-none px-0 py-4 bg-transparent">
          <CardTitle className="text-slate-900 font-bold">Tax Ledger Accounts</CardTitle>
          <CardDescription className="text-slate-500 font-medium">
            Summary of accumulated debits, credits, and net balances
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 bg-transparent">
          <div className="overflow-x-auto">
            <Table className="w-full bg-transparent">
              <TableHeader>
                <TableRow className="border-b border-slate-300 bg-slate-100">
                  <TableHead className="text-slate-900 font-bold">Account Name</TableHead>
                  <TableHead className="text-right text-slate-900 font-bold">Debit ($)</TableHead>
                  <TableHead className="text-right text-slate-900 font-bold">Credit ($)</TableHead>
                  <TableHead className="text-right text-slate-900 font-bold">Balance ($)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="bg-transparent">
                {accountKeys.map((name) => {
                  const acct = taxAccounts[name]
                  return (
                    <TableRow key={name} className="hover:bg-slate-50 border-b border-slate-100 bg-transparent">
                      <TableCell className="font-semibold text-slate-900">{name}</TableCell>
                      <TableCell className="text-right font-mono text-sm text-slate-900">${formatNumber(acct.debit)}</TableCell>
                      <TableCell className="text-right font-mono text-sm text-slate-900">${formatNumber(acct.credit)}</TableCell>
                      <TableCell className="text-right font-mono text-sm font-bold text-slate-900">${formatNumber(acct.balance)}</TableCell>
                    </TableRow>
                  )
                })}
                {accountKeys.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-slate-500 py-8 bg-transparent">
                      No tax data recorded yet
                    </TableCell>
                  </TableRow>
                )}
                {/* Totals Summary Row */}
                <TableRow className="bg-transparent text-slate-900 font-bold border-t-2 border-b-2 border-slate-300">
                  <TableCell className="font-bold text-slate-900">TOTAL</TableCell>
                  <TableCell className="text-right font-mono font-bold text-slate-900">${formatNumber(totalDebit)}</TableCell>
                  <TableCell className="text-right font-mono font-bold text-slate-900">${formatNumber(totalCredit)}</TableCell>
                  <TableCell className="text-right font-mono font-bold text-slate-900">${formatNumber(totalBalance)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

