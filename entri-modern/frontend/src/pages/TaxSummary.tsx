import React, { useEffect, useState } from 'react'
import { api } from '@/utils/api'
import { exportToCSV, exportToPDF } from '@/utils/exportUtils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useCompany } from '@/context/CompanyContext'

export default function TaxSummary() {
  const { formatCurrency, currencySymbol } = useCompany()
  const [taxAccounts, setTaxAccounts] = useState<Record<string, any>>({})

  useEffect(() => {
    async function load() {
      try {
        const res = await api.getReport('tax-summary')
        setTaxAccounts(res.accounts || {})
      } catch (e) {
        console.error(e)
      }
    }
    load()
  }, [])

  const accountKeys = Object.keys(taxAccounts)
  const totalDebit = accountKeys.reduce((acc, k) => acc + (taxAccounts[k]?.debit || 0), 0)
  const totalCredit = accountKeys.reduce((acc, k) => acc + (taxAccounts[k]?.credit || 0), 0)
  const totalBalance = accountKeys.reduce((acc, k) => acc + (taxAccounts[k]?.balance || 0), 0)

  function handleExportCSV() {
    const headers = ['Account Name', 'Debit', 'Credit', 'Balance']
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
            onClick={() => exportToPDF('Tax Summary')}
            className="bg-blue-600 hover:bg-blue-700 text-white border border-black font-semibold"
          >
            Export PDF
          </Button>
        </div>
      </div>

      <Card className="border-0 bg-transparent shadow-none p-0">
        <CardHeader className="border-0 px-0 py-4 bg-transparent">
          <CardTitle className="text-black font-bold">Tax Ledger Accounts</CardTitle>
          <CardDescription className="text-slate-500 font-medium">
            Summary of accumulated debits, credits, and net balances
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 bg-transparent">
          <div className="overflow-x-auto bg-transparent">
            <Table className="w-full bg-transparent border-0">
              <TableHeader>
                <TableRow className="border-0 bg-transparent">
                  <TableHead className="text-black font-bold">Account Name</TableHead>
                  <TableHead className="text-right text-black font-bold">Debit ({currencySymbol})</TableHead>
                  <TableHead className="text-right text-black font-bold">Credit ({currencySymbol})</TableHead>
                  <TableHead className="text-right text-black font-bold">Balance ({currencySymbol})</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="bg-transparent">
                {accountKeys.map((name) => {
                  const acct = taxAccounts[name]
                  return (
                    <TableRow key={name} className="border-0 bg-transparent">
                      <TableCell className="font-semibold text-black">{name}</TableCell>
                      <TableCell className="text-right font-mono text-sm text-black">{formatCurrency(acct.debit)}</TableCell>
                      <TableCell className="text-right font-mono text-sm text-black">{formatCurrency(acct.credit)}</TableCell>
                      <TableCell className="text-right font-mono text-sm font-bold text-black">{formatCurrency(acct.balance)}</TableCell>
                    </TableRow>
                  )
                })}
                {accountKeys.length === 0 && (
                  <TableRow className="border-0 bg-transparent">
                    <TableCell colSpan={4} className="text-center text-slate-500 py-8 bg-transparent border-0">
                      No tax data recorded yet
                    </TableCell>
                  </TableRow>
                )}
                {/* Totals Summary Row - HAS GREY BG */}
                <TableRow className="bg-slate-200 text-black font-bold border-0">
                  <TableCell className="font-bold text-black">TOTAL</TableCell>
                  <TableCell className="text-right font-mono font-bold text-black">{formatCurrency(totalDebit)}</TableCell>
                  <TableCell className="text-right font-mono font-bold text-black">{formatCurrency(totalCredit)}</TableCell>
                  <TableCell className="text-right font-mono font-bold text-black">{formatCurrency(totalBalance)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
