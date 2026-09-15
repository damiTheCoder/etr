import React, { useEffect, useMemo, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, ChevronDown } from 'lucide-react'
import {
  BarChart,
  Bar,
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
  target: number
}

type Period = 'month' | 'year'

// Raw data stored for recomputation on period change
interface RawData {
  sales: any[]
  purchases: any[]
  entries: any[]
}

// Period selector dropdown component (Month & Year)
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

  const labels: Record<Period, string> = { month: 'Month', year: 'Year' }

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
          {(['month', 'year'] as Period[]).map((p) => (
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

// Helper to extract item date string safely
const getItemDate = (item: any) => String(item?.date || item?.posting_date || item?.postingDate || '')

// Helper to check if an account is a Cash or Bank account
const isCashAccount = (accountName: string) => {
  if (!accountName) return false
  const lower = String(accountName).toLowerCase()
  return lower.includes('bank') || lower.includes('cash') || lower.includes('petty')
}

// Build chart data for a given metric across all historical dates
function buildChartData(
  rawData: RawData,
  metric: 'cash' | 'revenue' | 'expenses' | 'profit' | 'ar' | 'ap',
  period: Period
): ChartPoint[] {
  const sales = Array.isArray(rawData?.sales) ? rawData.sales : []
  const purchases = Array.isArray(rawData?.purchases) ? rawData.purchases : []
  const entries = Array.isArray(rawData?.entries) ? rawData.entries : []
  const isSubmitted = (item: any) => Boolean(item && (item.submitted === 1 || item.submitted === true || item.docstatus === 1) && !item.cancelled)

  const now = new Date()
  const dates: string[] = []

  for (const s of sales) if (getItemDate(s)) dates.push(getItemDate(s))
  for (const p of purchases) if (getItemDate(p)) dates.push(getItemDate(p))
  for (const e of entries) if (getItemDate(e)) dates.push(getItemDate(e))

  dates.sort()

  const points: ChartPoint[] = []

  if (period === 'month') {
    let startYear = now.getFullYear()
    let startMonth = now.getMonth()

    if (dates.length > 0) {
      const earliest = dates[0].slice(0, 7)
      const [ey, em] = earliest.split('-').map(Number)
      if (ey && em) {
        startYear = ey
        startMonth = em - 1
      }
    }

    // Generate 12 consecutive months starting from the month of the first transaction
    for (let step = 0; step < 12; step++) {
      const monthObj = new Date(startYear, startMonth + step, 1)
      const dateStrFilter = monthObj.toISOString().slice(0, 7)
      const label = monthObj.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })

      let val = 0
      let targetVal = 0

      if (metric === 'cash') {
        const periodEntries = entries.filter((e: any) => e && getItemDate(e).startsWith(dateStrFilter))
        for (const e of periodEntries) {
          if (isCashAccount(e.account)) {
            val += Number(e.debit || 0)
            targetVal += Number(e.credit || 0)
          }
        }
      } else if (metric === 'revenue') {
        const periodSales = sales.filter((s: any) => s && getItemDate(s).startsWith(dateStrFilter))
        for (const s of periodSales) {
          const grand = Number(s.grandTotal || s.baseGrandTotal || 0)
          const outstanding = Number(s.outstandingAmount || 0)
          val += grand
          targetVal += Math.max(0, grand - outstanding)
        }
      } else if (metric === 'expenses') {
        const periodPurchases = purchases.filter((p: any) => p && getItemDate(p).startsWith(dateStrFilter))
        for (const p of periodPurchases) {
          const grand = Number(p.grandTotal || p.baseGrandTotal || 0)
          const outstanding = Number(p.outstandingAmount || 0)
          val += grand
          targetVal += Math.max(0, grand - outstanding)
        }
      } else if (metric === 'profit') {
        const periodSales = sales.filter((s: any) => s && getItemDate(s).startsWith(dateStrFilter))
        const periodPurchases = purchases.filter((p: any) => p && getItemDate(p).startsWith(dateStrFilter))
        val = periodSales.reduce((sum: number, s: any) => sum + Number(s.grandTotal || s.baseGrandTotal || 0), 0)
        targetVal = periodPurchases.reduce((sum: number, p: any) => sum + Number(p.grandTotal || p.baseGrandTotal || 0), 0)
      } else if (metric === 'ar') {
        const periodSales = sales.filter((s: any) => s && getItemDate(s).startsWith(dateStrFilter)).filter(isSubmitted)
        val = periodSales.reduce((sum: number, s: any) => sum + Number(s.grandTotal || s.baseGrandTotal || 0), 0)
        targetVal = periodSales.reduce((sum: number, s: any) => sum + Number(s.outstandingAmount || 0), 0)
      } else if (metric === 'ap') {
        const periodPurchases = purchases.filter((p: any) => p && getItemDate(p).startsWith(dateStrFilter)).filter(isSubmitted)
        val = periodPurchases.reduce((sum: number, p: any) => sum + Number(p.grandTotal || p.baseGrandTotal || 0), 0)
        targetVal = periodPurchases.reduce((sum: number, p: any) => sum + Number(p.outstandingAmount || 0), 0)
      }

      points.push({ label, value: Math.round(val), target: Math.round(targetVal) })
    }
  } else {
    // Year view: start from year of first transaction, count 6 years forward
    let startYear = now.getFullYear() - 5
    if (dates.length > 0) {
      const ey = Number(dates[0].slice(0, 4))
      if (ey) startYear = ey
    }

    for (let step = 0; step < 6; step++) {
      const y = startYear + step
      const dateStrFilter = String(y)
      const label = String(y)

      let val = 0
      let targetVal = 0

      if (metric === 'cash') {
        const periodEntries = entries.filter((e: any) => e && getItemDate(e).startsWith(dateStrFilter))
        for (const e of periodEntries) {
          if (isCashAccount(e.account)) {
            val += Number(e.debit || 0)
            targetVal += Number(e.credit || 0)
          }
        }
      } else if (metric === 'revenue') {
        const periodSales = sales.filter((s: any) => s && getItemDate(s).startsWith(dateStrFilter))
        for (const s of periodSales) {
          const grand = Number(s.grandTotal || s.baseGrandTotal || 0)
          const outstanding = Number(s.outstandingAmount || 0)
          val += grand
          targetVal += Math.max(0, grand - outstanding)
        }
      } else if (metric === 'expenses') {
        const periodPurchases = purchases.filter((p: any) => p && getItemDate(p).startsWith(dateStrFilter))
        for (const p of periodPurchases) {
          const grand = Number(p.grandTotal || p.baseGrandTotal || 0)
          const outstanding = Number(p.outstandingAmount || 0)
          val += grand
          targetVal += Math.max(0, grand - outstanding)
        }
      } else if (metric === 'profit') {
        const periodSales = sales.filter((s: any) => s && getItemDate(s).startsWith(dateStrFilter))
        const periodPurchases = purchases.filter((p: any) => p && getItemDate(p).startsWith(dateStrFilter))
        val = periodSales.reduce((sum: number, s: any) => sum + Number(s.grandTotal || s.baseGrandTotal || 0), 0)
        targetVal = periodPurchases.reduce((sum: number, p: any) => sum + Number(p.grandTotal || p.baseGrandTotal || 0), 0)
      } else if (metric === 'ar') {
        const periodSales = sales.filter((s: any) => s && getItemDate(s).startsWith(dateStrFilter)).filter(isSubmitted)
        val = periodSales.reduce((sum: number, s: any) => sum + Number(s.grandTotal || s.baseGrandTotal || 0), 0)
        targetVal = periodSales.reduce((sum: number, s: any) => sum + Number(s.outstandingAmount || 0), 0)
      } else if (metric === 'ap') {
        const periodPurchases = purchases.filter((p: any) => p && getItemDate(p).startsWith(dateStrFilter)).filter(isSubmitted)
        val = periodPurchases.reduce((sum: number, p: any) => sum + Number(p.grandTotal || p.baseGrandTotal || 0), 0)
        targetVal = periodPurchases.reduce((sum: number, p: any) => sum + Number(p.outstandingAmount || 0), 0)
      }

      points.push({ label, value: Math.round(val), target: Math.round(targetVal) })
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

        const isSubmitted = (item: any) => Boolean(item && (item.submitted === 1 || item.submitted === true || item.docstatus === 1) && !item.cancelled)
        const submittedSales = Array.isArray(sales) ? sales.filter(isSubmitted) : []
        const submittedPurchases = Array.isArray(purchases) ? purchases.filter(isSubmitted) : []
        const allEntries = Array.isArray(ledger)
          ? ledger
          : Array.isArray((ledger as any)?.entries)
          ? (ledger as any).entries
          : []

        setRawData({
          sales: submittedSales,
          purchases: submittedPurchases,
          entries: allEntries,
        })

        const rev = (pl as any)?.income?.total ?? submittedSales.reduce((acc: number, item: any) => acc + Number(item.grandTotal || item.baseGrandTotal || 0), 0)
        const exp = (pl as any)?.expenses?.total ?? submittedPurchases.reduce((acc: number, item: any) => acc + Number(item.grandTotal || item.baseGrandTotal || 0), 0)
        const ar = submittedSales.reduce((acc: number, item: any) => acc + Number(item.outstandingAmount || 0), 0)
        const ap = submittedPurchases.reduce((acc: number, item: any) => acc + Number(item.outstandingAmount || 0), 0)

        setTotalRevenue(rev)
        setTotalExpenses(exp)
        setAccountsReceivable(ar)
        setAccountsPayable(ap)

        const netInc = (pl as any)?.netProfit ?? (pl as any)?.net_profit ?? (rev - exp)
        setNetProfit(netInc)

        let cashInflow = 0
        let cashOutflow = 0
        if (allEntries.length > 0) {
          for (const entry of allEntries) {
            if (isCashAccount(entry.account)) {
              cashInflow += Number(entry.debit || 0)
              cashOutflow += Number(entry.credit || 0)
            }
          }
        }

        let cashVal = cashInflow - cashOutflow
        if (bs?.totalCash !== undefined && bs?.totalCash !== null) {
          cashVal = Number(bs.totalCash)
        } else if (cashVal === 0 && tb?.rows && Array.isArray(tb.rows)) {
          for (const row of tb.rows) {
            if (row.account_type === 'Bank' || row.account_type === 'Cash' || isCashAccount(row.account)) {
              cashVal += Number(row.debit || 0) - Number(row.credit || 0)
            }
          }
        }
        setCashBalance(cashVal)

        let totalDebitVal = Number((tb as any)?.totalDebit || (tb as any)?.total_debit || 0)
        let totalCreditVal = Number((tb as any)?.totalCredit || (tb as any)?.total_credit || 0)
        if (!totalDebitVal && (tb as any)?.rows && Array.isArray((tb as any).rows)) {
          for (const row of (tb as any).rows) {
            totalDebitVal += Number(row.debit || 0)
            totalCreditVal += Number(row.credit || 0)
          }
        }

        const totalAssetsVal = Number((bs as any)?.totalAssets || (bs as any)?.total_assets || cashVal)
        const totalLiabilitiesVal = Number((bs as any)?.totalLiabilities || (bs as any)?.total_liabilities || ap)
        const totalEquityVal = Number((bs as any)?.totalEquity || (bs as any)?.total_equity || (totalAssetsVal - totalLiabilitiesVal))

        setBannerMetrics({
          cashInflow,
          cashOutflow,
          cashNet: cashVal,
          revenue: rev,
          expenses: exp,
          netProfit: netInc,
          totalAssets: totalAssetsVal,
          totalLiabilities: totalLiabilitiesVal,
          totalEquity: totalEquityVal,
          totalDebit: totalDebitVal,
          totalCredit: totalCreditVal,
        })

        setRecentSales(submittedSales.slice(0, 5))
        setRecentEntries(allEntries.slice(0, 10))
      } catch (err) {
        console.error('Error loading dashboard data:', err)
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

  const getTrend = (chartData: ChartPoint[]) => {
    if (chartData.length < 2) return { percent: 0, isUp: true }
    const curr = chartData[chartData.length - 1]?.value || 0
    const prev = chartData[chartData.length - 2]?.value || 0
    if (prev === 0) return { percent: curr > 0 ? 100 : 0, isUp: curr >= 0 }
    const diff = ((curr - prev) / Math.abs(prev)) * 100
    return { percent: Math.abs(Math.round(diff * 10) / 10), isUp: diff >= 0 }
  }

  const cashTrend = getTrend(cashChartData)
  const revenueTrend = getTrend(revenueChartData)
  const expensesTrend = getTrend(expensesChartData)

  function renderChart(
    data: ChartPoint[],
    color: string,
    valueLabel: string = 'Metric Total',
    targetLabel: string = 'Settled Total'
  ) {
    const totalPoints = data.length
    const widthPercentage = totalPoints > 6 ? (totalPoints / 6) * 100 : 100

    // Compute max domain to ensure left fixed Y-Axis renders price levels matching right chart
    const maxVal = Math.max(0, ...data.flatMap(d => [d.value || 0, d.target || 0]))
    const upperDomain = maxVal > 0 ? Math.ceil(maxVal * 1.08) : 100
    const domain: [number, number] = [0, upperDomain]

    return (
      <div className="flex w-full h-[180px] relative">
        {/* Fixed Y-Axis Panel on Left */}
        <div className="w-[45px] h-full flex-none z-10 bg-slate-50 flex items-center">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 0, left: -4, bottom: 0 }}>
              <YAxis
                domain={domain}
                axisLine={false}
                tickLine={false}
                tickFormatter={formatYAxis}
                tick={{ fontFamily: "'Glacial Indifference', 'GlacialIndifference', sans-serif", fill: '#94a3b8', fontSize: 11 }}
                width={45}
              />
              <Bar dataKey="value" fill="transparent" stroke="transparent" />
              <Bar dataKey="target" fill="transparent" stroke="transparent" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Scrollable Chart Body (Bars & X-Axis) on Right */}
        <div className="flex-1 h-full overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden pb-1">
          <div style={{ width: `${widthPercentage}%`, minWidth: '100%', height: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 0 }} barGap={3} barCategoryGap="22%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontFamily: "'Glacial Indifference', 'GlacialIndifference', sans-serif", fill: '#64748b', fontSize: 11, fontWeight: 500 }}
                  dy={8}
                  interval={0}
                />
                <YAxis domain={domain} hide width={0} />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    formatCurrency(value),
                    name === 'value' ? valueLabel : targetLabel
                  ]}
                  contentStyle={{
                    fontFamily: "'Glacial Indifference', 'GlacialIndifference', sans-serif",
                    borderRadius: '12px',
                    border: 'none',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                    fontSize: '13px',
                    padding: '8px 14px',
                  }}
                />
                {/* Main Colour Bar with Black Border */}
                <Bar
                  dataKey="value"
                  fill={color}
                  stroke="#000000"
                  strokeWidth={1.5}
                  radius={[4, 4, 0, 0]}
                />
                {/* Black Bar with White Border */}
                <Bar
                  dataKey="target"
                  fill="#000000"
                  stroke="#ffffff"
                  strokeWidth={1.5}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 pb-8">
      {/* Embedded Brand Integrations Banner */}
      <BrandBanner metrics={bannerMetrics} />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
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
            <CardDescription className="text-xs text-slate-500">Inflows (debits) vs Outflows (credits)</CardDescription>
            <div className="text-3xl font-semibold text-slate-900 pt-1">{formatCurrency(cashBalance)}</div>
            <div className={`flex items-center gap-1.5 font-medium text-xs pt-1 ${cashTrend.isUp ? 'text-emerald-600' : 'text-rose-600'}`}>
              {cashTrend.isUp ? 'Trending up' : 'Trending down'} by {cashTrend.percent}% this period {cashTrend.isUp ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
            </div>
            <div className="text-slate-400 text-[11px]">Verified against ledger bank & cash accounts</div>
          </CardHeader>
          <CardContent className="px-4 pb-5 pt-2">
            <div className="h-[180px] w-full">
              {renderChart(cashChartData, '#2563eb', 'Cash Inflow (Debit)', 'Cash Outflow (Credit)')}
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
            <CardDescription className="text-xs text-slate-500">Gross sales invoiced vs Paid & collected</CardDescription>
            <div className="text-3xl font-semibold text-slate-900 pt-1">{formatCurrency(totalRevenue)}</div>
            <div className={`flex items-center gap-1.5 font-medium text-xs pt-1 ${revenueTrend.isUp ? 'text-emerald-600' : 'text-rose-600'}`}>
              {revenueTrend.isUp ? 'Trending up' : 'Trending down'} by {revenueTrend.percent}% this period {revenueTrend.isUp ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
            </div>
            <div className="text-slate-400 text-[11px]">Cumulative sales invoice totals</div>
          </CardHeader>
          <CardContent className="px-4 pb-5 pt-2">
            <div className="h-[180px] w-full">
              {renderChart(revenueChartData, '#10b981', 'Gross Sales Invoiced', 'Paid & Collected Revenue')}
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
            <CardDescription className="text-xs text-slate-500">Gross purchase cost vs Settled & paid</CardDescription>
            <div className="text-3xl font-semibold text-slate-900 pt-1">{formatCurrency(totalExpenses)}</div>
            <div className={`flex items-center gap-1.5 font-medium text-xs pt-1 ${expensesTrend.isUp ? 'text-amber-600' : 'text-emerald-600'}`}>
              {expensesTrend.isUp ? 'Increased' : 'Decreased'} by {expensesTrend.percent}% this period {expensesTrend.isUp ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
            </div>
            <div className="text-slate-400 text-[11px]">Outlays from purchase invoices & vouchers</div>
          </CardHeader>
          <CardContent className="px-4 pb-5 pt-2">
            <div className="h-[180px] w-full">
              {renderChart(expensesChartData, '#f59e0b', 'Gross Operational Cost', 'Paid & Settled Expenses')}
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
            <CardDescription className="text-xs text-slate-500">Period revenue vs Period expenses</CardDescription>
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
              {renderChart(profitChartData, '#6366f1', 'Revenue', 'Expenses')}
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
            <CardDescription className="text-xs text-slate-500">Total invoiced vs Outstanding receivables</CardDescription>
            <div className="text-3xl font-semibold text-sky-600 pt-1">{formatCurrency(accountsReceivable)}</div>
            <div className="flex items-center gap-1.5 font-medium text-sky-600 text-xs pt-1">
              {accountsReceivable > 0 ? 'Pending customer payments' : 'All receivables collected'}
              <ArrowUpRight className="h-3.5 w-3.5" />
            </div>
            <div className="text-slate-400 text-[11px]">Sum of outstanding amounts on submitted sales invoices</div>
          </CardHeader>
          <CardContent className="px-4 pb-5 pt-2">
            <div className="h-[180px] w-full">
              {renderChart(arChartData, '#0ea5e9', 'Total Sales Invoiced', 'Outstanding Receivable')}
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
            <CardDescription className="text-xs text-slate-500">Total invoiced vs Outstanding payables</CardDescription>
            <div className="text-3xl font-semibold text-rose-600 pt-1">{formatCurrency(accountsPayable)}</div>
            <div className="flex items-center gap-1.5 font-medium text-rose-600 text-xs pt-1">
              {accountsPayable > 0 ? 'Pending vendor payments' : 'All payables settled'}
              <ArrowDownRight className="h-3.5 w-3.5" />
            </div>
            <div className="text-slate-400 text-[11px]">Sum of outstanding amounts on submitted purchase invoices</div>
          </CardHeader>
          <CardContent className="px-4 pb-5 pt-2">
            <div className="h-[180px] w-full">
              {renderChart(apChartData, '#e11d48', 'Total Purchases Invoiced', 'Outstanding Payable')}
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
