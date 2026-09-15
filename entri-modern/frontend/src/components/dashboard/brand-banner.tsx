import React, { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, ChevronDown, Calendar, X, ExternalLink } from 'lucide-react'

export interface BrandItem {
  id: string
  name: string
  subtitle: string
  yieldRate: string
  image?: string
  color?: string
  initials?: string
}

export const brandList: BrandItem[] = [
  {
    id: 'piggyvest',
    name: 'Piggyvest',
    subtitle: 'Save & Invest',
    yieldRate: '13.00% p.a.',
    image: '/Piggyvest.png',
  },
  {
    id: 'cowrywise',
    name: 'Cowrywise',
    subtitle: 'Wealth Management',
    yieldRate: '15.00% p.a.',
    image: '/Cowrywise.png',
  },
  {
    id: 'risevest',
    name: 'Risevest',
    subtitle: 'Dollar Investments',
    yieldRate: '12.00% p.a.',
    image: '/rice.png',
  },
  {
    id: 'bamboo',
    name: 'Bamboo',
    subtitle: 'US Stocks',
    yieldRate: '10.50% p.a.',
    image: '/Bamboo.png',
  },
  {
    id: 'kuda',
    name: 'Kuda',
    subtitle: 'Digital Banking',
    yieldRate: '4.00% p.a.',
    color: 'bg-[#40196d]',
    initials: 'K',
  },
  {
    id: 'fairmoney',
    name: 'FairMoney',
    subtitle: 'Quick Loans',
    yieldRate: 'Instant Access',
    image: '/fairmoney.png',
  },
]

export interface FinancialStatementMetrics {
  cashInflow: number
  cashOutflow: number
  cashNet: number
  revenue: number
  expenses: number
  netProfit: number
  totalAssets: number
  totalLiabilities: number
  totalEquity: number
  totalDebit: number
  totalCredit: number
}

export interface BrandBannerProps {
  metrics?: FinancialStatementMetrics
}

export type StatementCategory = 'Cash Book' | 'Income Statement' | 'Balance Sheet' | 'Trial Balance'

export interface SubMetric {
  label: string
  key: keyof FinancialStatementMetrics
}

export interface StatementConfig {
  name: StatementCategory
  route: string
  subMetrics: SubMetric[]
}

const statementConfigs: Record<StatementCategory, StatementConfig> = {
  'Cash Book': {
    name: 'Cash Book',
    route: '/general-ledger',
    subMetrics: [
      { label: 'INFLOW', key: 'cashInflow' },
      { label: 'OUTFLOW', key: 'cashOutflow' },
      { label: 'NET CASH', key: 'cashNet' },
    ],
  },
  'Income Statement': {
    name: 'Income Statement',
    route: '/profit-and-loss',
    subMetrics: [
      { label: 'REVENUE', key: 'revenue' },
      { label: 'COST OF SALES / EXPENSES', key: 'expenses' },
      { label: 'NET PROFIT', key: 'netProfit' },
    ],
  },
  'Balance Sheet': {
    name: 'Balance Sheet',
    route: '/balance-sheet',
    subMetrics: [
      { label: 'TOTAL ASSETS', key: 'totalAssets' },
      { label: 'TOTAL LIABILITIES', key: 'totalLiabilities' },
      { label: 'TOTAL EQUITY', key: 'totalEquity' },
    ],
  },
  'Trial Balance': {
    name: 'Trial Balance',
    route: '/trial-balance',
    subMetrics: [
      { label: 'TOTAL DEBIT', key: 'totalDebit' },
      { label: 'TOTAL CREDIT', key: 'totalCredit' },
    ],
  },
}

export const BrandBanner: React.FC<BrandBannerProps> = ({ metrics }) => {
  const navigate = useNavigate()
  const [filterOpen, setFilterOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<StatementCategory>('Cash Book')
  const [subMetricIndex, setSubMetricIndex] = useState(0)
  const defaultMonthStr = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const [selectedMonth, setSelectedMonth] = useState(defaultMonthStr)
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setFilterOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const currentConfig = statementConfigs[selectedCategory] || statementConfigs['Cash Book']
  const activeSubMetrics = currentConfig.subMetrics
  const currentSubMetric = activeSubMetrics[subMetricIndex % activeSubMetrics.length]

  const rawValue = metrics ? metrics[currentSubMetric.key] || 0 : 0
  const formatAbbreviatedCurrency = (v: number): string => {
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
  const formattedValue = formatAbbreviatedCurrency(rawValue)

  const handleCycleMetric = () => {
    setSubMetricIndex((prev) => (prev + 1) % activeSubMetrics.length)
  }

  const handleSelectCategory = (cat: StatementCategory) => {
    setSelectedCategory(cat)
    setSubMetricIndex(0)
  }

  return (
    <div className="space-y-6 bg-transparent mb-6">
      {/* Top Bar: Inflow / Statement Header & Controls */}
      <div className="flex items-center justify-between relative mb-6 pb-2">
        <div className="space-y-1">
          {/* Dynamic Label */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 tracking-wider uppercase">
              {currentSubMetric.label}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-3xl font-semibold text-slate-900 tracking-tight">
              {formattedValue}
            </span>

            {/* Statement selector dropdown trigger */}
            <button
              type="button"
              onClick={() => setFilterOpen(!filterOpen)}
              className="flex items-center gap-1 px-3 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors cursor-pointer border-none select-none"
              title="Change financial statement view"
            >
              <span>/mo</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
            <span>For {selectedMonth}</span>
            <span>&bull;</span>
            <Link
              to={currentConfig.route}
              className="text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1"
            >
              Open Report <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Action Button: Click to cycle through sub-metrics (Inflow -> Outflow -> Net) */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCycleMetric}
            className="flex size-10 items-center justify-center rounded-full bg-blue-600 text-white shadow-md hover:bg-blue-700 active:scale-95 transition-all cursor-pointer border-none"
            title={`Cycle to next ${selectedCategory} metric`}
          >
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>

        {/* Interactive Month & Category Popover Card */}
        {filterOpen && (
          <div
            ref={popoverRef}
            className="absolute left-0 top-14 z-50 w-80 rounded-2xl border-none bg-slate-100 p-4 shadow-xl animate-in fade-in zoom-in-95 duration-150 backdrop-blur-md"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-700">Select statement & month</span>
              <button
                type="button"
                onClick={() => setFilterOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Category tabs - Horizontally Scrollable without scrollbar */}
            <div className="flex items-center gap-2 overflow-x-auto mb-3 pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden snap-x scroll-smooth">
              {(['Cash Book', 'Income Statement', 'Balance Sheet', 'Trial Balance'] as StatementCategory[]).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => handleSelectCategory(cat)}
                  className={`shrink-0 snap-start px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border-none ${
                    selectedCategory === cat
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-200/70 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Date Input */}
            <div className="relative mb-3">
              <input
                type="text"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full rounded-xl bg-slate-200/60 px-3 py-2 text-xs font-medium text-slate-900 border-none outline-none pr-8"
              />
              <Calendar className="absolute right-2.5 top-2.5 w-4 h-4 text-slate-500 pointer-events-none" />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-200/50">
              <button
                type="button"
                onClick={() => setSelectedMonth(defaultMonthStr)}
                className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
              >
                This month
              </button>
              <button
                type="button"
                onClick={() => setFilterOpen(false)}
                className="text-[11px] font-medium text-slate-500 hover:text-slate-700 cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Embedded Brands / Financial Integrations Carousel */}
      <div className="pt-1">
        <div className="mb-2.5 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">Embedded Integrations</h3>
            <p className="text-xs text-slate-500">Explore connected savings, investment, and banking accounts</p>
          </div>
        </div>

        <div className="flex items-center gap-5 overflow-x-auto no-scrollbar pb-1">
          {brandList.map((brand) => (
            <div
              key={brand.id}
              className="flex flex-col items-center text-center group cursor-pointer min-w-[90px] shrink-0"
            >
              {/* Circular Avatar */}
              <div className="size-14 rounded-full flex items-center justify-center bg-white shadow-2xs group-hover:scale-105 transition-transform duration-200 overflow-hidden mb-2 relative">
                {brand.image ? (
                  <img
                    src={brand.image}
                    alt={brand.name}
                    className="w-full h-full object-cover rounded-full"
                    onError={(e) => {
                      const target = e.currentTarget
                      if (target.src.includes('fairmoney.png')) {
                        target.src = '/fairmoney.svg'
                      } else if (target.src.includes('rice.png')) {
                        target.src = '/Risevest.png'
                      }
                    }}
                  />
                ) : (
                  <div className={`w-full h-full ${brand.color || 'bg-blue-600'} text-white flex items-center justify-center font-bold text-base rounded-full`}>
                    {brand.initials}
                  </div>
                )}
              </div>

              <span className="font-bold text-xs text-slate-900 group-hover:text-blue-600 transition-colors leading-tight">
                {brand.name}
              </span>
              <span className="text-[10px] text-slate-500 font-medium leading-tight truncate max-w-[100px]">
                {brand.subtitle}
              </span>
              <span className="text-[10px] font-semibold text-emerald-600 mt-0.5">
                {brand.yieldRate}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
