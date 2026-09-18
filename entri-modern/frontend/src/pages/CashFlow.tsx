import React, { useEffect, useState } from 'react'
import { api } from '@/utils/api'
import { exportToCSV, exportToPDF } from '@/utils/exportUtils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useCompany } from '@/context/CompanyContext'

export default function CashFlow() {
  const { formatCurrency } = useCompany()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  async function loadReport() {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (fromDate) params.from_date = fromDate
      if (toDate) params.to_date = toDate
      const res = await api.getReport('cash-flow', params)
      setData(res)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReport()
  }, [])

  function handleExportCSV() {
    if (!data) return
    const headers = ['Category / Item', 'Account Ref', 'Net Cash Flow ($)']
    const rows: (string | number)[][] = []

    // 1. Operating Activities
    rows.push(['1. CASH FLOWS FROM OPERATING ACTIVITIES', '', ''])
    rows.push(['   Net Profit / (Loss) for the Period', 'P&L', data.operating?.netProfit || 0])

    if (data.operating?.nonCashAdjustments?.length > 0) {
      rows.push(['   Adjustments for Non-Cash Items:', '', ''])
      data.operating.nonCashAdjustments.forEach((item: any) => {
        rows.push([`      ${item.item}`, item.account || '', item.amount])
      })
    }

    if (data.operating?.workingCapitalAdjustments?.length > 0) {
      rows.push(['   Working Capital Changes:', '', ''])
      data.operating.workingCapitalAdjustments.forEach((item: any) => {
        rows.push([`      ${item.item}`, item.account || '', item.amount])
      })
    }
    rows.push(['Net Cash Generated from / (Used in) Operating Activities', '', data.operating?.total || 0])
    rows.push(['', '', ''])

    // 2. Investing Activities
    rows.push(['2. CASH FLOWS FROM INVESTING ACTIVITIES', '', ''])
    if (data.investing?.items?.length > 0) {
      data.investing.items.forEach((item: any) => {
        rows.push([`   ${item.item}`, item.account || '', item.amount])
      })
    } else {
      rows.push(['   No investing activities recorded in this period', '', 0])
    }
    rows.push(['Net Cash Generated from / (Used in) Investing Activities', '', data.investing?.total || 0])
    rows.push(['', '', ''])

    // 3. Financing Activities
    rows.push(['3. CASH FLOWS FROM FINANCING ACTIVITIES', '', ''])
    if (data.financing?.items?.length > 0) {
      data.financing.items.forEach((item: any) => {
        rows.push([`   ${item.item}`, item.account || '', item.amount])
      })
    } else {
      rows.push(['   No financing activities recorded in this period', '', 0])
    }
    rows.push(['Net Cash Generated from / (Used in) Financing Activities', '', data.financing?.total || 0])
    rows.push(['', '', ''])

    // Summary
    rows.push(['4. SUMMARY OF CASH & CASH EQUIVALENTS', '', ''])
    rows.push(['   Net Increase / (Decrease) in Cash and Cash Equivalents', '', data.summary?.netIncreaseInCash || 0])
    rows.push(['   Cash and Cash Equivalents at Beginning of Period', '', data.summary?.beginningCash || 0])
    rows.push(['   Cash and Cash Equivalents at End of Period', '', data.summary?.endingCash || 0])

    exportToCSV('Cash_Flow_Statement', headers, rows)
  }

  const operatingTotal = data?.operating?.total || 0
  const investingTotal = data?.investing?.total || 0
  const financingTotal = data?.financing?.total || 0
  const netIncrease = data?.summary?.netIncreaseInCash || 0
  const beginningCash = data?.summary?.beginningCash || 0
  const endingCash = data?.summary?.endingCash || 0
  const isReconciled = data?.summary?.reconciled ?? true

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Cash Flow Statement</h1>
          <p className="text-sm text-gray-500 mt-1">
            IAS 7 Standard • Operating, Investing, and Financing Cash Activities
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            type="date"
            className="w-auto text-sm"
            placeholder="From Date"
          />
          <Input
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            type="date"
            className="w-auto text-sm"
            placeholder="To Date"
          />
          <Button
            size="sm"
            onClick={loadReport}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white border border-black font-semibold"
          >
            {loading ? 'Applying...' : 'Apply'}
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
            onClick={() => exportToPDF('Cash Flow Statement')}
            className="bg-blue-600 hover:bg-blue-700 text-white border border-black font-semibold"
          >
            Export PDF
          </Button>
        </div>
      </div>

      {/* KPI Cards (Shadow and padding removed) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 no-print">
        <div className="p-0 bg-transparent border-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Operating Activities
          </p>
          <p className="text-2xl font-bold text-black mt-1">
            {formatCurrency(operatingTotal)}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Net operating cash generation
          </p>
        </div>

        <div className="p-0 bg-transparent border-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Investing Activities
          </p>
          <p className="text-2xl font-bold text-black mt-1">
            {formatCurrency(investingTotal)}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Capital expenditures & investments
          </p>
        </div>

        <div className="p-0 bg-transparent border-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Financing Activities
          </p>
          <p className="text-2xl font-bold text-black mt-1">
            {formatCurrency(financingTotal)}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Equity & borrowings movements
          </p>
        </div>

        <div className="p-0 bg-transparent border-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Ending Cash Balance
          </p>
          <p className="text-2xl font-bold text-black mt-1">
            {formatCurrency(endingCash)}
          </p>
          <p className="text-xs text-slate-600 mt-1">
            Net Change: <span className="font-semibold text-black">
              {netIncrease >= 0 ? '+' : ''}{formatCurrency(netIncrease)}
            </span>
          </p>
        </div>
      </div>

      {/* Main Statement Table */}
      {data ? (
        <Card className="border-0 bg-transparent shadow-none p-0">
          <CardHeader className="border-0 px-0 py-4 bg-transparent">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <CardTitle className="text-xl font-bold text-black">
                  Statement of Cash Flows (IAS 7)
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 font-medium mt-1">
                  {fromDate ? `From ${fromDate} ` : 'All Prior Periods '} to {toDate || 'Present'} • Direct & Indirect Method
                </CardDescription>
              </div>
              <Badge
                variant={isReconciled ? 'default' : 'destructive'}
                className="w-fit text-xs px-3 py-1 font-semibold text-black bg-transparent border-0"
              >
                {isReconciled ? 'Reconciled to General Ledger' : 'Cash Discrepancy Detected'}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="p-0 bg-transparent">
            <div className="overflow-x-auto bg-transparent">
              <Table className="w-full bg-transparent border-0">
                <TableHeader>
                  <TableRow className="border-0 bg-transparent">
                    <TableHead className="w-[70%] pl-6 py-3 text-black font-bold text-xs uppercase tracking-wider">
                      Cash Flow Activity / Account
                    </TableHead>
                    <TableHead className="text-right pr-6 py-3 text-black font-bold text-xs uppercase tracking-wider">
                      Amount ({data.currency || 'USD'})
                    </TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody className="bg-transparent">
                  {/* SECTION 1: OPERATING ACTIVITIES */}
                  <TableRow className="font-bold text-black border-0 bg-transparent">
                    <TableCell colSpan={2} className="pl-6 py-3 uppercase tracking-wider text-xs font-bold text-black">
                      1. Cash Flows from Operating Activities
                    </TableCell>
                  </TableRow>

                  {/* Net Profit */}
                  <TableRow className="border-0 bg-transparent">
                    <TableCell className="pl-8 py-3 text-sm font-medium text-black">
                      Net Profit / (Loss) for the Period (from P&L)
                    </TableCell>
                    <TableCell className="text-right pr-6 py-3 font-mono text-sm font-semibold text-black">
                      {formatCurrency(data.operating?.netProfit || 0)}
                    </TableCell>
                  </TableRow>

                  {/* Non-cash Adjustments */}
                  {data.operating?.nonCashAdjustments?.length > 0 && (
                    <>
                      <TableRow className="border-0 bg-transparent">
                        <TableCell colSpan={2} className="pl-10 py-2.5 text-xs font-semibold text-black uppercase tracking-wide">
                          Adjustments for Non-Cash Items:
                        </TableCell>
                      </TableRow>
                      {data.operating.nonCashAdjustments.map((adj: any, idx: number) => (
                        <TableRow key={`adj-${idx}`} className="border-0 bg-transparent">
                          <TableCell className="pl-12 py-3 text-sm text-black">
                            {adj.item}
                          </TableCell>
                          <TableCell className="text-right pr-6 py-3 font-mono text-sm text-black">
                            {formatCurrency(adj.amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </>
                  )}

                  {/* Working Capital Adjustments */}
                  {data.operating?.workingCapitalAdjustments?.length > 0 && (
                    <>
                      <TableRow className="border-0 bg-transparent">
                        <TableCell colSpan={2} className="pl-10 py-2.5 text-xs font-semibold text-black uppercase tracking-wide">
                          Adjustments for Working Capital Changes:
                        </TableCell>
                      </TableRow>
                      {data.operating.workingCapitalAdjustments.map((wc: any, idx: number) => (
                        <TableRow key={`wc-${idx}`} className="border-0 bg-transparent">
                          <TableCell className="pl-12 py-3 text-sm text-black">
                            {wc.item}
                          </TableCell>
                          <TableCell className="text-right pr-6 py-3 font-mono text-sm font-medium text-black">
                            {wc.amount < 0 ? `(${formatCurrency(Math.abs(wc.amount))})` : formatCurrency(wc.amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </>
                  )}

                  {/* Operating Subtotal - TOTAL BALANCE ROW HAS GREY BG */}
                  <TableRow className="border-0 bg-slate-200 font-semibold text-black">
                    <TableCell className="pl-6 py-3 text-sm font-bold text-black">
                      Net Cash Generated from / (Used in) Operating Activities
                    </TableCell>
                    <TableCell className="text-right pr-6 py-3 font-mono text-sm font-bold text-black">
                      {operatingTotal < 0 ? `(${formatCurrency(Math.abs(operatingTotal))})` : formatCurrency(operatingTotal)}
                    </TableCell>
                  </TableRow>


                  {/* SECTION 2: INVESTING ACTIVITIES */}
                  <TableRow className="font-bold text-black border-0 bg-transparent">
                    <TableCell colSpan={2} className="pl-6 pt-5 pb-3 uppercase tracking-wider text-xs font-bold text-black">
                      2. Cash Flows from Investing Activities
                    </TableCell>
                  </TableRow>

                  {data.investing?.items?.length > 0 ? (
                    data.investing.items.map((item: any, idx: number) => (
                      <TableRow key={`inv-${idx}`} className="border-0 bg-transparent">
                        <TableCell className="pl-8 py-3 text-sm text-black">
                          {item.item}
                        </TableCell>
                        <TableCell className="text-right pr-6 py-3 font-mono text-sm font-medium text-black">
                          {item.amount < 0 ? `(${formatCurrency(Math.abs(item.amount))})` : formatCurrency(item.amount)}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow className="border-0 bg-transparent">
                      <TableCell className="pl-8 py-3 text-sm text-black italic">
                        No property, equipment, or investment cash flows in this period
                      </TableCell>
                      <TableCell className="text-right pr-6 py-3 font-mono text-sm text-black">
                        {formatCurrency(0)}
                      </TableCell>
                    </TableRow>
                  )}

                  {/* Investing Subtotal - TOTAL BALANCE ROW HAS GREY BG */}
                  <TableRow className="border-0 bg-slate-200 font-semibold text-black">
                    <TableCell className="pl-6 py-3 text-sm font-bold text-black">
                      Net Cash Generated from / (Used in) Investing Activities
                    </TableCell>
                    <TableCell className="text-right pr-6 py-3 font-mono text-sm font-bold text-black">
                      {investingTotal < 0 ? `(${formatCurrency(Math.abs(investingTotal))})` : formatCurrency(investingTotal)}
                    </TableCell>
                  </TableRow>


                  {/* SECTION 3: FINANCING ACTIVITIES */}
                  <TableRow className="font-bold text-black border-0 bg-transparent">
                    <TableCell colSpan={2} className="pl-6 pt-5 pb-3 uppercase tracking-wider text-xs font-bold text-black">
                      3. Cash Flows from Financing Activities
                    </TableCell>
                  </TableRow>

                  {data.financing?.items?.length > 0 ? (
                    data.financing.items.map((item: any, idx: number) => (
                      <TableRow key={`fin-${idx}`} className="border-0 bg-transparent">
                        <TableCell className="pl-8 py-3 text-sm text-black">
                          {item.item}
                        </TableCell>
                        <TableCell className="text-right pr-6 py-3 font-mono text-sm font-medium text-black">
                          {item.amount < 0 ? `(${formatCurrency(Math.abs(item.amount))})` : formatCurrency(item.amount)}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow className="border-0 bg-transparent">
                      <TableCell className="pl-8 py-3 text-sm text-black italic">
                        No equity, dividend, or loan borrowings cash flows in this period
                      </TableCell>
                      <TableCell className="text-right pr-6 py-3 font-mono text-sm text-black">
                        {formatCurrency(0)}
                      </TableCell>
                    </TableRow>
                  )}

                  {/* Financing Subtotal - TOTAL BALANCE ROW HAS GREY BG */}
                  <TableRow className="border-0 bg-slate-200 font-semibold text-black">
                    <TableCell className="pl-6 py-3 text-sm font-bold text-black">
                      Net Cash Generated from / (Used in) Financing Activities
                    </TableCell>
                    <TableCell className="text-right pr-6 py-3 font-mono text-sm font-bold text-black">
                      {financingTotal < 0 ? `(${formatCurrency(Math.abs(financingTotal))})` : formatCurrency(financingTotal)}
                    </TableCell>
                  </TableRow>


                  {/* SECTION 4: SUMMARY & RECONCILIATION */}
                  <TableRow className="font-bold text-black border-0 bg-transparent">
                    <TableCell colSpan={2} className="pl-6 pt-5 pb-3 uppercase tracking-wider text-xs font-bold text-black">
                      4. Net Increase / (Decrease) in Cash and Cash Equivalents
                    </TableCell>
                  </TableRow>

                  <TableRow className="border-0 bg-transparent">
                    <TableCell className="pl-8 py-3 text-sm font-semibold text-black">
                      Net Increase / (Decrease) in Cash and Cash Equivalents
                    </TableCell>
                    <TableCell className="text-right pr-6 py-3 font-mono text-sm font-bold text-black">
                      {netIncrease < 0 ? `(${formatCurrency(Math.abs(netIncrease))})` : formatCurrency(netIncrease)}
                    </TableCell>
                  </TableRow>

                  <TableRow className="border-0 bg-transparent">
                    <TableCell className="pl-8 py-3 text-sm text-black">
                      Cash and Cash Equivalents at Beginning of Period
                    </TableCell>
                    <TableCell className="text-right pr-6 py-3 font-mono text-sm text-black">
                      {formatCurrency(beginningCash)}
                    </TableCell>
                  </TableRow>

                  {/* Ending Cash Grand Total - WITH TOP MARGIN & GREY BG */}
                  <TableRow className="border-0 bg-transparent">
                    <TableCell colSpan={2} className="p-0">
                      <div className="mt-4 bg-slate-200 flex items-center justify-between pl-6 pr-6 py-3 font-bold text-black">
                        <span className="text-base font-bold text-black">
                          Cash and Cash Equivalents at End of Period
                        </span>
                        <span className="font-mono text-base font-bold text-black">
                          {formatCurrency(endingCash)}
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
        <div className="flex flex-col items-center justify-center p-12 text-black">
          <p className="text-sm">Calculating Cash Flow Statement from general ledger...</p>
        </div>
      )}
    </div>
  )
}
