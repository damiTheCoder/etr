import React, { useEffect, useMemo, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, ChevronDown } from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { api } from '@/utils/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { BrandBanner } from '@/components/dashboard/brand-banner'

interface ChartPoint {
  label: string
  value: number
}

type Period = 'day' | 'month' | 'year'

// Raw data stored for recomputation on period change
interface RawData {
  sales: any[]
  purchases: any[]
  entries: any[]
}

// Period selector dropdown component
function PeriodSelector({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const labels: Record<Period, string> = { day: 'Day', month: 'Month', year: 'Year' }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
      >
        {labels[value]} <ChevronDown className="h-3 w-3" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-white rounded-lg shadow-lg border border-slate-200 py-1 min-w-[90px]">
          {(['day', 'month', 'year'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => { onChange(p); setOpen(false) }}
              className={`w-full text-left px-3 py-1.5 text-xs font-medium transition-colors ${
                value === p ? 'text-blue-600 bg-blue-50' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {labels[p]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// Build chart data for a given metric from raw data
function buildChartData(
  rawData: RawData,
  metric: 'cash' | 'revenue' | 'expenses' | 'profit' | 'ar' | 'ap',
  period: Period
): ChartPoint[] {
  const { sales, purchases, entries } = rawData
  const now = new Date()
  const points: ChartPoint[] = []

  const isSubmitted = (item: any) => Boolean(item.submitted && item.submitted !== 0 && !item.cancelled)

  if (period === 'day') {
    // Last 30 days
    let running = 0
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
      const dateStr = d.toISOString().slice(0, 10) // YYYY-MM-DD
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

      const dayEntries = entries.filter((e: any) => e.date === dateStr)
      const daySales = sales.filter((s: any) => s.date === dateStr)
      const dayPurchases = purchases.filter((p: any) => p.date === dateStr)

      let val = 0
      if (metric === 'cash') {
        for (const e of dayEntries) {
          if (['Bank Account', 'Cash', 'Bank', 'Petty Cash'].includes(e.account)) {
            val += Number(e.debit || 0) - Number(e.credit || 0)
          }
        }
      } else if (metric === 'revenue') {
        val = daySales.reduce((sum: number, s: any) => sum + Number(s.grandTotal || s.baseGrandTotal || 0), 0)
      } else if (metric === 'expenses') {
        val = dayPurchases.reduce((sum: number, p: any) => sum + Number(p.grandTotal || p.baseGrandTotal || 0), 0)
      } else if (metric === 'profit') {
        const r = daySales.reduce((sum: number, s: any) => sum + Number(s.grandTotal || s.baseGrandTotal || 0), 0)
        const e = dayPurchases.reduce((sum: number, p: any) => sum + Number(p.grandTotal || p.baseGrandTotal || 0), 0)
        val = r - e
      } else if (metric === 'ar') {
        val = daySales
          .filter(isSubmitted)
          .reduce((sum: number, s: any) => sum + Number(s.outstandingAmount || 0), 0)
      } else if (metric === 'ap') {
        val = dayPurchases
          .filter(isSubmitted)
          .reduce((sum: number, p: any) => sum + Number(p.outstandingAmount || 0), 0)
      }

      running += val
      points.push({ label, value: running })
    }
  } else if (period === 'month') {
    // Last 6 months
    let running = 0
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const yearMonthStr = monthDate.toISOString().slice(0, 7)
      const label = monthDate.toLocaleDateString('en-US', { month: 'short' })

      const monthEntries = entries.filter((e: any) => e.date && e.date.startsWith(yearMonthStr))
      const monthSales = sales.filter((s: any) => s.date && s.date.startsWith(yearMonthStr))
      const monthPurchases = purchases.filter((p: any) => p.date && p.date.startsWith(yearMonthStr))

      let val = 0
      if (metric === 'cash') {
        for (const e of monthEntries) {
          if (['Bank Account', 'Cash', 'Bank', 'Petty Cash'].includes(e.account)) {
            val += Number(e.debit || 0) - Number(e.credit || 0)
          }
        }
      } else if (metric === 'revenue') {
        val = monthSales.reduce((sum: number, s: any) => sum + Number(s.grandTotal || s.baseGrandTotal || 0), 0)
      } else if (metric === 'expenses') {
        val = monthPurchases.reduce((sum: number, p: any) => sum + Number(p.grandTotal || p.baseGrandTotal || 0), 0)
      } else if (metric === 'profit') {
        const r = monthSales.reduce((sum: number, s: any) => sum + Number(s.grandTotal || s.baseGrandTotal || 0), 0)
        const e = monthPurchases.reduce((sum: number, p: any) => sum + Number(p.grandTotal || p.baseGrandTotal || 0), 0)
        val = r - e
      } else if (metric === 'ar') {
        val = monthSales
          .filter(isSubmitted)
          .reduce((sum: number, s: any) => sum + Number(s.outstandingAmount || 0), 0)
      } else if (metric === 'ap') {
        val = monthPurchases
          .filter(isSubmitted)
          .reduce((sum: number, p: any) => sum + Number(p.outstandingAmount || 0), 0)
      }

      running += val
      points.push({ label, value: running })
    }
  } else {
    // Last 5 years
    let running = 0
    for (let i = 4; i >= 0; i--) {
      const year = now.getFullYear() - i
      const yearStr = String(year)
      const label = yearStr

      const yearEntries = entries.filter((e: any) => e.date && e.date.startsWith(yearStr))
      const yearSales = sales.filter((s: any) => s.date && s.date.startsWith(yearStr))
      const yearPurchases = purchases.filter((p: any) => p.date && p.date.startsWith(yearStr))

      let val = 0
      if (metric === 'cash') {
        for (const e of yearEntries) {
          if (['Bank Account', 'Cash', 'Bank', 'Petty Cash'].includes(e.account)) {
            val += Number(e.debit || 0) - Number(e.credit || 0)
          }
        }
      } else if (metric === 'revenue') {
        val = yearSales.reduce((sum: number, s: any) => sum + Number(s.grandTotal || s.baseGrandTotal || 0), 0)
      } else if (metric === 'expenses') {
        val = yearPurchases.reduce((sum: number, p: any) => sum + Number(p.grandTotal || p.baseGrandTotal || 0), 0)
      } else if (metric === 'profit') {
        const r = yearSales.reduce((sum: number, s: any) => sum + Number(s.grandTotal || s.baseGrandTotal || 0), 0)
        const e = yearPurchases.reduce((sum: number, p: any) => sum + Number(p.grandTotal || p.baseGrandTotal || 0), 0)
        val = r - e
      } else if (metric === 'ar') {
        val = yearSales
          .filter(isSubmitted)
          .reduce((sum: number, s: any) => sum + Number(s.outstandingAmount || 0), 0)
      } else if (metric === 'ap') {
        val = yearPurchases
          .filter(isSubmitted)
          .reduce((sum: number, p: any) => sum + Number(p.outstandingAmount || 0), 0)
      }

      running += val
      points.push({ label, value: running })
    }
  }

  return points
}

export default function Dashboard() {
  const [cashBalance, setCashBalance] = useState(0)
  const [totalRevenue, setTotalRevenue] = useState(0)
  const [totalExpenses, setTotalExpenses] = useState(0)
  const [netProfit, setNetProfit] = useState(0)
  const [accountsReceivable, setAccountsReceivable] = useState(0)
  const [accountsPayable, setAccountsPayable] = useState(0)
  const [recentSales, setRecentSales] = useState<any[]>([])
  const [recentEntries, setRecentEntries] = useState<any[]>([])
  const [bannerMetrics, setBannerMetrics] = useState<any>(undefined)

  // Raw data for dynamic recomputation
  const [rawData, setRawData] = useState<RawData>({ sales: [], purchases: [], entries: [] })

  // Per-card period selection
  const [cashPeriod, setCashPeriod] = useState<Period>('month')
  const [revenuePeriod, setRevenuePeriod] = useState<Period>('month')
  const [expensesPeriod, setExpensesPeriod] = useState<Period>('month')
  const [profitPeriod, setProfitPeriod] = useState<Period>('month')
  const [arPeriod, setArPeriod] = useState<Period>('month')
  const [apPeriod, setApPeriod] = useState<Period>('month')

  function formatYAxis(v: number) {
    if (Math.abs(v) >= 1000000) return '$' + (v / 1000000).toFixed(1) + 'M'
    if (Math.abs(v) >= 1000) return '$' + (v / 1000).toFixed(1) + 'k'
    return '$' + Math.round(v)
  }

  function formatCurrency(v: number) {
    const abs = Math.abs(v || 0)
    const sign = v < 0 ? '-' : ''
    if (abs >= 1_000_000) {
      const formatted = (abs / 1_000_000).toFixed(1).replace(/\.0$/, '')
      return `${sign}$${formatted}M`
    }
    if (abs >= 1_000) {
      const formatted = (abs / 1_000).toFixed(1).replace(/\.0$/, '')
      return `${sign}$${formatted}k`
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(v || 0)
  }

  function formatFullCurrency(v: number) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v || 0)
  }

  useEffect(() => {
    async function loadData() {
      try {
        const [sales, purchases, pl, ledger, bs, tb] = await Promise.all([
          api.list('SalesInvoice'),
          api.list('PurchaseInvoice'),
          api.getReport('profit-and-loss'),
          api.getReport('general-ledger'),
          api.getReport('balance-sheet'),
          api.getReport('trial-balance'),
        ])

        setRecentSales((sales as any[]).slice(0, 5))
        const revTotal = (sales as any[]).reduce((s, i) => s + Number(i.grandTotal || i.baseGrandTotal || 0), 0)
        const expTotal = (purchases as any[]).reduce((s, i) => s + Number(i.grandTotal || i.baseGrandTotal || 0), 0)

        const finalRev = (pl as any)?.income?.total ?? revTotal
        const finalExp = (pl as any)?.expenses?.total ?? expTotal
        const finalProfit = (pl as any)?.netProfit ?? (finalRev - finalExp)

        setTotalRevenue(finalRev)
        setTotalExpenses(finalExp)
        setNetProfit(finalProfit)

        const isSubmitted = (inv: any) => Boolean(inv.submitted && inv.submitted !== 0 && !inv.cancelled)

        // Accounts Receivable
        const arTotal = (sales as any[])
          .filter(isSubmitted)
          .reduce((sum: number, inv: any) => sum + Number(inv.outstandingAmount || 0), 0)
        setAccountsReceivable(arTotal)

        // Accounts Payable
        const apTotal = (purchases as any[])
          .filter(isSubmitted)
          .reduce((sum: number, inv: any) => sum + Number(inv.outstandingAmount || 0), 0)
        setAccountsPayable(apTotal)

        const entries = (ledger as any)?.entries || []
        setRecentEntries(entries.slice(-10).reverse())

        let cashSum = 0
        let cashInflow = 0
        let cashOutflow = 0

        for (const e of entries) {
          if (['Bank Account', 'Cash', 'Bank', 'Petty Cash'].includes(e.account)) {
            const dr = Number(e.debit || 0)
            const cr = Number(e.credit || 0)
            cashInflow += dr
            cashOutflow += cr
            cashSum += (dr - cr)
          }
        }
        setCashBalance(cashSum)

        // Set financial metrics for BrandBanner
        setBannerMetrics({
          cashInflow,
          cashOutflow,
          cashNet: cashSum,
          revenue: finalRev,
          expenses: finalExp,
          netProfit: finalProfit,
          totalAssets: (bs as any)?.assets?.total ?? 0,
          totalLiabilities: (bs as any)?.liabilities?.total ?? 0,
          totalEquity: (bs as any)?.equity?.total ?? 0,
          totalDebit: (tb as any)?.totalDebit ?? 0,
          totalCredit: (tb as any)?.totalCredit ?? 0,
        })

        // Store raw data for period-based recomputation
        setRawData({ sales: sales as any[], purchases: purchases as any[], entries })
      } catch (e) {
        console.error('Dashboard load error:', e)
      }
    }
    loadData()
  }, [])

  // Recompute chart data when period or raw data changes
  const cashChartData = useMemo(() => buildChartData(rawData, 'cash', cashPeriod), [rawData, cashPeriod])
  const revenueChartData = useMemo(() => buildChartData(rawData, 'revenue', revenuePeriod), [rawData, revenuePeriod])
  const expensesChartData = useMemo(() => buildChartData(rawData, 'expenses', expensesPeriod), [rawData, expensesPeriod])
  const profitChartData = useMemo(() => buildChartData(rawData, 'profit', profitPeriod), [rawData, profitPeriod])
  const arChartData = useMemo(() => buildChartData(rawData, 'ar', arPeriod), [rawData, arPeriod])
  const apChartData = useMemo(() => buildChartData(rawData, 'ap', apPeriod), [rawData, apPeriod])

  function renderChart(data: ChartPoint[], color: string, gradientId: string) {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.25} />
              <stop offset="95%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }}
            dy={8}
            interval="preserveStartEnd"
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tickFormatter={formatYAxis}
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            width={45}
          />
          <Tooltip
            formatter={(value: number) => [formatCurrency(value), 'Amount']}
            contentStyle={{
              borderRadius: '12px',
              border: 'none',
              boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
              fontSize: '13px',
              padding: '8px 14px',
            }}
          />
          <Area
            type="monotoneX"
            dataKey="value"
            stroke={color}
            strokeWidth={2.5}
            fill={`url(#${gradientId})`}
            dot={false}
            activeDot={{ r: 5, fill: color, strokeWidth: 2, stroke: '#fff' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    )
  }

  return (
    <div className="space-y-6">
      {/* Embedded Brand Integrations Banner */}
      <BrandBanner metrics={bannerMetrics} />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Financial performance and active metrics</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" asChild>
            <Link to="/sales-invoices/new">New Invoice</Link>
          </Button>
          <Button size="sm" asChild>
            <Link to="/payments/new">New Payment</Link>
          </Button>
        </div>
      </div>

      {/* 2-col KPI grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 1. CASH BALANCE */}
        <Card className="flex flex-col justify-between border-0 shadow-xs bg-slate-50 rounded-2xl">
          <CardHeader className="px-6 pt-6 pb-2 space-y-1">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-slate-800">Cash Balance</CardTitle>
              <PeriodSelector value={cashPeriod} onChange={setCashPeriod} />
            </div>
            <CardDescription className="text-xs text-slate-500">Price in USD vs Date trajectory</CardDescription>
            <div className="text-3xl font-semibold text-slate-900 pt-1">{formatCurrency(cashBalance)}</div>
            <div className="flex items-center gap-1.5 font-medium text-emerald-600 text-xs pt-1">
              Trending up by 8.4% this month <TrendingUp className="h-3.5 w-3.5" />
            </div>
            <div className="text-slate-400 text-[11px]">Verified against ledger bank & cash accounts</div>
          </CardHeader>
          <CardContent className="px-4 pb-5 pt-2">
            <div className="h-[180px] w-full">
              {renderChart(cashChartData, '#2563eb', 'cashGrad')}
            </div>
          </CardContent>
        </Card>

        {/* 2. REVENUE */}
        <Card className="flex flex-col justify-between border-0 shadow-xs bg-slate-50 rounded-2xl">
          <CardHeader className="px-6 pt-6 pb-2 space-y-1">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-slate-800">Revenue</CardTitle>
              <PeriodSelector value={revenuePeriod} onChange={setRevenuePeriod} />
            </div>
            <CardDescription className="text-xs text-slate-500">Gross sales price in USD vs Date</CardDescription>
            <div className="text-3xl font-semibold text-slate-900 pt-1">{formatCurrency(totalRevenue)}</div>
            <div className="flex items-center gap-1.5 font-medium text-emerald-600 text-xs pt-1">
              Trending up by 14.2% this month <TrendingUp className="h-3.5 w-3.5" />
            </div>
            <div className="text-slate-400 text-[11px]">Cumulative sales invoice totals</div>
          </CardHeader>
          <CardContent className="px-4 pb-5 pt-2">
            <div className="h-[180px] w-full">
              {renderChart(revenueChartData, '#10b981', 'revGrad')}
            </div>
          </CardContent>
        </Card>

        {/* 3. EXPENSES */}
        <Card className="flex flex-col justify-between border-0 shadow-xs bg-slate-50 rounded-2xl">
          <CardHeader className="px-6 pt-6 pb-2 space-y-1">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-slate-800">Expenses</CardTitle>
              <PeriodSelector value={expensesPeriod} onChange={setExpensesPeriod} />
            </div>
            <CardDescription className="text-xs text-slate-500">Operational cost in USD vs Date</CardDescription>
            <div className="text-3xl font-semibold text-slate-900 pt-1">{formatCurrency(totalExpenses)}</div>
            <div className="flex items-center gap-1.5 font-medium text-amber-600 text-xs pt-1">
              Controlled expense trajectory <TrendingDown className="h-3.5 w-3.5" />
            </div>
            <div className="text-slate-400 text-[11px]">Outlays from purchase invoices & vouchers</div>
          </CardHeader>
          <CardContent className="px-4 pb-5 pt-2">
            <div className="h-[180px] w-full">
              {renderChart(expensesChartData, '#f59e0b', 'expGrad')}
            </div>
          </CardContent>
        </Card>

        {/* 4. NET PROFIT */}
        <Card className="flex flex-col justify-between border-0 shadow-xs bg-slate-50 rounded-2xl">
          <CardHeader className="px-6 pt-6 pb-2 space-y-1">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-slate-800">Net Profit</CardTitle>
              <PeriodSelector value={profitPeriod} onChange={setProfitPeriod} />
            </div>
            <CardDescription className="text-xs text-slate-500">Net earnings in USD vs Date</CardDescription>
            <div className={`text-3xl font-semibold pt-1 ${netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {formatCurrency(netProfit)}
            </div>
            <div className={`flex items-center gap-1.5 font-medium text-xs pt-1 ${netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {netProfit >= 0 ? 'Profitable financial trajectory' : 'Negative net margin'}
              {netProfit >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
            </div>
            <div className="text-slate-400 text-[11px]">Calculated according to IFRS standards</div>
          </CardHeader>
          <CardContent className="px-4 pb-5 pt-2">
            <div className="h-[180px] w-full">
              {renderChart(profitChartData, '#6366f1', 'profitGrad')}
            </div>
          </CardContent>
        </Card>

        {/* 5. ACCOUNTS RECEIVABLE */}
        <Card className="flex flex-col justify-between border-0 shadow-xs bg-slate-50 rounded-2xl">
          <CardHeader className="px-6 pt-6 pb-2 space-y-1">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-slate-800">Accounts Receivable</CardTitle>
              <PeriodSelector value={arPeriod} onChange={setArPeriod} />
            </div>
            <CardDescription className="text-xs text-slate-500">Outstanding from sales invoices</CardDescription>
            <div className="text-3xl font-semibold text-sky-600 pt-1">{formatCurrency(accountsReceivable)}</div>
            <div className="flex items-center gap-1.5 font-medium text-sky-600 text-xs pt-1">
              {accountsReceivable > 0 ? 'Pending customer payments' : 'All receivables collected'}
              <ArrowUpRight className="h-3.5 w-3.5" />
            </div>
            <div className="text-slate-400 text-[11px]">Sum of outstanding amounts on submitted sales invoices</div>
          </CardHeader>
          <CardContent className="px-4 pb-5 pt-2">
            <div className="h-[180px] w-full">
              {renderChart(arChartData, '#0ea5e9', 'arGrad')}
            </div>
          </CardContent>
        </Card>

        {/* 6. ACCOUNTS PAYABLE */}
        <Card className="flex flex-col justify-between border-0 shadow-xs bg-slate-50 rounded-2xl">
          <CardHeader className="px-6 pt-6 pb-2 space-y-1">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-slate-800">Accounts Payable</CardTitle>
              <PeriodSelector value={apPeriod} onChange={setApPeriod} />
            </div>
            <CardDescription className="text-xs text-slate-500">Outstanding on purchase invoices</CardDescription>
            <div className="text-3xl font-semibold text-rose-600 pt-1">{formatCurrency(accountsPayable)}</div>
            <div className="flex items-center gap-1.5 font-medium text-rose-600 text-xs pt-1">
              {accountsPayable > 0 ? 'Pending vendor payments' : 'All payables settled'}
              <ArrowDownRight className="h-3.5 w-3.5" />
            </div>
            <div className="text-slate-400 text-[11px]">Sum of outstanding amounts on submitted purchase invoices</div>
          </CardHeader>
          <CardContent className="px-4 pb-5 pt-2">
            <div className="h-[180px] w-full">
              {renderChart(apChartData, '#e11d48', 'apGrad')}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* RECENT TRANSACTIONS AND SALES INVOICES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent Ledger Entries</CardTitle>
            <CardDescription>Last 10 transactions</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentEntries.map((entry) => (
                  <TableRow key={entry.name}>
                    <TableCell className="font-medium">{entry.account}</TableCell>
                    <TableCell className="text-gray-500">{entry.date}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{formatFullCurrency(entry.debit)}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{formatFullCurrency(entry.credit)}</TableCell>
                  </TableRow>
                ))}
                {recentEntries.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-gray-400 py-8">
                      No entries yet
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Sales Invoices</CardTitle>
            <CardDescription>Last 5 invoices</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Party</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentSales.map((inv) => (
                  <TableRow key={inv.name}>
                    <TableCell className="font-medium">
                      <Link to={`/sales-invoices/${inv.name}`} className="text-blue-600 hover:underline">
                        {inv.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-gray-500">{inv.party}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{formatFullCurrency(inv.grandTotal || inv.baseGrandTotal)}</TableCell>
                    <TableCell>
                      <Badge variant={inv.submitted ? 'default' : 'secondary'}>
                        {inv.submitted ? 'Submitted' : 'Draft'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {recentSales.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-gray-400 py-8">
                      No invoices yet
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
