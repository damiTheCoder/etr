import React, { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search,
  Command,
  FileText,
  Receipt,
  CreditCard,
  BookOpen,
  ShoppingBag,
  TrendingUp,
  Scale,
  BookMarked,
  Calculator,
  Clock,
  Hourglass,
  Landmark,
  CheckSquare,
  CheckCircle2,
  FolderTree,
  Users,
  Package,
  Settings,
  LayoutDashboard,
  ArrowRight,
  X,
} from 'lucide-react'
import { api } from '@/utils/api'

interface SearchResultItem {
  id: string
  title: string
  subtitle?: string
  category: 'Pages' | 'Sales Invoices' | 'Purchase Invoices' | 'Payments' | 'Journal Entries' | 'Purchase Orders' | 'Parties' | 'Items' | 'Accounts'
  url: string
  icon: React.ReactNode
}

const STATIC_PAGES: SearchResultItem[] = [
  { id: 'p-dash', title: 'Dashboard', subtitle: 'Overview & Key Metrics', category: 'Pages', url: '/', icon: <LayoutDashboard className="w-4 h-4 text-blue-600" /> },
  { id: 'p-sinv', title: 'Sales Invoices', subtitle: 'Manage customer invoices & billing', category: 'Pages', url: '/sales-invoices', icon: <FileText className="w-4 h-4 text-blue-600" /> },
  { id: 'p-sinv-new', title: 'New Sales Invoice', subtitle: 'Create a new customer invoice', category: 'Pages', url: '/sales-invoices/new', icon: <FileText className="w-4 h-4 text-emerald-600" /> },
  { id: 'p-pinv', title: 'Purchase Invoices', subtitle: 'Manage vendor bills & expenses', category: 'Pages', url: '/purchase-invoices', icon: <Receipt className="w-4 h-4 text-purple-600" /> },
  { id: 'p-pinv-new', title: 'New Purchase Invoice', subtitle: 'Create a new vendor bill', category: 'Pages', url: '/purchase-invoices/new', icon: <Receipt className="w-4 h-4 text-emerald-600" /> },
  { id: 'p-pay', title: 'Payments', subtitle: 'Customer receipts & vendor payments', category: 'Pages', url: '/payments', icon: <CreditCard className="w-4 h-4 text-emerald-600" /> },
  { id: 'p-pay-new', title: 'New Payment', subtitle: 'Record payment entry', category: 'Pages', url: '/payments/new', icon: <CreditCard className="w-4 h-4 text-emerald-600" /> },
  { id: 'p-je', title: 'Journal Entries', subtitle: 'Double-entry manual journal vouchers', category: 'Pages', url: '/journal-entries', icon: <BookOpen className="w-4 h-4 text-indigo-600" /> },
  { id: 'p-je-new', title: 'New Journal Entry', subtitle: 'Create manual double-entry voucher', category: 'Pages', url: '/journal-entries/new', icon: <BookOpen className="w-4 h-4 text-emerald-600" /> },
  { id: 'p-po', title: 'Purchase Orders', subtitle: 'Vendor purchase orders', category: 'Pages', url: '/purchase-orders', icon: <ShoppingBag className="w-4 h-4 text-amber-600" /> },
  { id: 'p-recon', title: 'Bank Reconciliations', subtitle: 'Reconcile bank & cash statements', category: 'Pages', url: '/reconciliations', icon: <Landmark className="w-4 h-4 text-cyan-600" /> },
  { id: 'r-pnl', title: 'Profit & Loss Statement', subtitle: 'Income, expense, and net profit report', category: 'Pages', url: '/reports/profit-and-loss', icon: <TrendingUp className="w-4 h-4 text-blue-600" /> },
  { id: 'r-bs', title: 'Balance Sheet', subtitle: 'Assets, liabilities & equity statement', category: 'Pages', url: '/reports/balance-sheet', icon: <Scale className="w-4 h-4 text-blue-600" /> },
  { id: 'r-gl', title: 'General Ledger', subtitle: 'Detailed ledger entries view', category: 'Pages', url: '/reports/general-ledger', icon: <BookMarked className="w-4 h-4 text-blue-600" /> },
  { id: 'r-tb', title: 'Trial Balance', subtitle: 'Debit & credit balance verification', category: 'Pages', url: '/reports/trial-balance', icon: <Calculator className="w-4 h-4 text-blue-600" /> },
  { id: 'r-ar', title: 'Accounts Receivable Aging', subtitle: 'Customer aging analysis', category: 'Pages', url: '/reports/ar-aging', icon: <Clock className="w-4 h-4 text-blue-600" /> },
  { id: 'r-ap', title: 'Accounts Payable Aging', subtitle: 'Vendor aging analysis', category: 'Pages', url: '/reports/ap-aging', icon: <Hourglass className="w-4 h-4 text-blue-600" /> },
  { id: 'r-tax', title: 'Tax Summary', subtitle: 'Tax liabilities & receivables', category: 'Pages', url: '/reports/tax-summary', icon: <Landmark className="w-4 h-4 text-blue-600" /> },
  { id: 'r-close', title: 'Close Management', subtitle: 'Period end closing checklist', category: 'Pages', url: '/reports/close-checklist', icon: <CheckSquare className="w-4 h-4 text-blue-600" /> },
  { id: 'm-appr', title: 'Approvals Master', subtitle: 'Review & approve submitted documents', category: 'Pages', url: '/approvals', icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" /> },
  { id: 'm-acc', title: 'Chart of Accounts', subtitle: 'Manage ledger accounts hierarchy', category: 'Pages', url: '/accounts', icon: <FolderTree className="w-4 h-4 text-blue-600" /> },
  { id: 'm-party', title: 'Parties Master', subtitle: 'Customers & suppliers directory', category: 'Pages', url: '/parties', icon: <Users className="w-4 h-4 text-blue-600" /> },
  { id: 'm-party-new', title: 'New Party', subtitle: 'Add new customer or supplier', category: 'Pages', url: '/parties/new', icon: <Users className="w-4 h-4 text-emerald-600" /> },
  { id: 'm-item', title: 'Items Master', subtitle: 'Products & services catalog', category: 'Pages', url: '/items', icon: <Package className="w-4 h-4 text-blue-600" /> },
  { id: 'm-item-new', title: 'New Item', subtitle: 'Create product or service', category: 'Pages', url: '/items/new', icon: <Package className="w-4 h-4 text-emerald-600" /> },
  { id: 'm-set', title: 'Settings', subtitle: 'Company settings & preferences', category: 'Pages', url: '/settings', icon: <Settings className="w-4 h-4 text-slate-600" /> },
]

export default function GlobalSearch() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [dataResults, setDataResults] = useState<SearchResultItem[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)

  // Keyboard shortcut Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((prev) => !prev)
      } else if (e.key === 'Escape' && open) {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open])

  // Focus input when modal opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
      loadProjectData()
    } else {
      setQuery('')
      setSelectedIndex(0)
    }
  }, [open])

  async function loadProjectData() {
    setLoading(true)
    try {
      const [sales, purchases, payments, journals, parties, items, accounts] = await Promise.all([
        api.list('Sales Invoice', 500).catch(() => []),
        api.list('Purchase Invoice', 500).catch(() => []),
        api.list('Payment Entry', 500).catch(() => []),
        api.list('Journal Entry', 500).catch(() => []),
        api.list('Party', 500).catch(() => []),
        api.list('Item', 500).catch(() => []),
        api.list('Account', 500).catch(() => []),
      ])

      const results: SearchResultItem[] = []

      // Sales Invoices
      sales?.forEach((inv: any) => {
        results.push({
          id: `sinv-${inv.name}`,
          title: inv.name,
          subtitle: `Customer: ${inv.customer || 'N/A'} • $${Number(inv.grand_total || 0).toFixed(2)} (${inv.status || 'Draft'})`,
          category: 'Sales Invoices',
          url: `/sales-invoices/${encodeURIComponent(inv.name)}`,
          icon: <FileText className="w-4 h-4 text-blue-600" />,
        })
      })

      // Purchase Invoices
      purchases?.forEach((inv: any) => {
        results.push({
          id: `pinv-${inv.name}`,
          title: inv.name,
          subtitle: `Supplier: ${inv.supplier || 'N/A'} • $${Number(inv.grand_total || 0).toFixed(2)} (${inv.status || 'Draft'})`,
          category: 'Purchase Invoices',
          url: `/purchase-invoices/${encodeURIComponent(inv.name)}`,
          icon: <Receipt className="w-4 h-4 text-purple-600" />,
        })
      })

      // Payments
      payments?.forEach((pay: any) => {
        results.push({
          id: `pay-${pay.name}`,
          title: pay.name,
          subtitle: `${pay.payment_type || 'Payment'} • Party: ${pay.party || 'N/A'} • $${Number(pay.paid_amount || 0).toFixed(2)}`,
          category: 'Payments',
          url: `/payments`,
          icon: <CreditCard className="w-4 h-4 text-emerald-600" />,
        })
      })

      // Journal Entries
      journals?.forEach((je: any) => {
        results.push({
          id: `je-${je.name}`,
          title: je.name,
          subtitle: `Journal Voucher • ${je.user_remark || 'Double-entry transaction'}`,
          category: 'Journal Entries',
          url: `/journal-entries`,
          icon: <BookOpen className="w-4 h-4 text-indigo-600" />,
        })
      })

      // Parties
      parties?.forEach((p: any) => {
        results.push({
          id: `party-${p.name}`,
          title: p.name,
          subtitle: `${p.party_type || 'Party'} • ${p.email || 'No email recorded'}`,
          category: 'Parties',
          url: `/parties/${encodeURIComponent(p.name)}`,
          icon: <Users className="w-4 h-4 text-blue-600" />,
        })
      })

      // Items
      items?.forEach((it: any) => {
        results.push({
          id: `item-${it.name}`,
          title: it.name,
          subtitle: `Code: ${it.item_code || it.name} • Price: $${Number(it.standard_rate || 0).toFixed(2)}`,
          category: 'Items',
          url: `/items/${encodeURIComponent(it.name)}`,
          icon: <Package className="w-4 h-4 text-amber-600" />,
        })
      })

      // Accounts
      accounts?.forEach((acct: any) => {
        results.push({
          id: `acct-${acct.name}`,
          title: acct.name,
          subtitle: `Account Type: ${acct.root_type || 'Ledger Account'}`,
          category: 'Accounts',
          url: `/accounts`,
          icon: <FolderTree className="w-4 h-4 text-slate-600" />,
        })
      })

      setDataResults(results)
    } catch (e) {
      console.error('Failed to load global search data:', e)
    } finally {
      setLoading(false)
    }
  }

  // Filter combined results
  const allCandidates = [...STATIC_PAGES, ...dataResults]
  const filteredResults = query.trim() === ''
    ? STATIC_PAGES.slice(0, 8)
    : allCandidates.filter((item) => {
        const q = query.toLowerCase()
        return (
          item.title.toLowerCase().includes(q) ||
          (item.subtitle && item.subtitle.toLowerCase().includes(q)) ||
          item.category.toLowerCase().includes(q)
        );
      }).slice(0, 30)

  const handleSelect = (url: string) => {
    setOpen(false)
    navigate(url)
  }

  const handleKeyDownModal = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredResults.length))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev - 1 + filteredResults.length) % Math.max(1, filteredResults.length))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filteredResults[selectedIndex]) {
        handleSelect(filteredResults[selectedIndex].url)
      }
    }
  }

  return (
    <>
      {/* Mobile Search Icon Button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="md:hidden flex items-center justify-center p-2 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors border-0 bg-transparent cursor-pointer"
        aria-label="Open search"
        title="Search"
      >
        <Search className="w-5 h-5 text-slate-700" />
      </button>

      {/* Desktop Header Search Input Button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden md:flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-600 border-0 text-sm transition-all duration-150 w-64 lg:w-80 justify-between group cursor-pointer"
      >
        <div className="flex items-center gap-2 truncate">
          <Search className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors shrink-0" />
          <span className="truncate text-xs text-slate-500 font-medium">Search pages, invoices, accounts...</span>
        </div>
        <kbd className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 bg-white rounded border-0 shadow-2xs font-mono">
          <Command className="w-3 h-3" />K
        </kbd>
      </button>

      {/* Global Search Modal Overlay */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-slate-900/40 backdrop-blur-xs transition-all animate-in fade-in-0">
          <div
            className="fixed inset-0"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          <div
            onKeyDown={handleKeyDownModal}
            className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200/80 overflow-hidden flex flex-col max-h-[80vh] z-10"
          >
            {/* Search Input Bar */}
            <div className="flex items-center px-4 py-3 border-b border-slate-200 bg-white gap-3">
              <Search className="w-5 h-5 text-blue-600 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setSelectedIndex(0)
                }}
                placeholder="Search anything (e.g. Sales, SINV-0001, Debtors, Item)..."
                className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none font-medium"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1 rounded-md bg-slate-100 border border-slate-200"
              >
                ESC
              </button>
            </div>

            {/* Results List Area */}
            <div className="flex-1 overflow-y-auto p-2 divide-y divide-slate-100">
              {loading && filteredResults.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-400 flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  Searching project transactions & entries...
                </div>
              ) : filteredResults.length > 0 ? (
                <div className="space-y-1 py-1">
                  {filteredResults.map((item, index) => {
                    const isSelected = index === selectedIndex
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleSelect(item.url)}
                        onMouseEnter={() => setSelectedIndex(index)}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all duration-150 border-0 cursor-pointer ${
                          isSelected
                            ? 'bg-blue-50 text-blue-900 font-medium border-l-4 border-blue-600 shadow-2xs'
                            : 'hover:bg-slate-50 text-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="p-2 rounded-lg bg-slate-100 shrink-0">
                            {item.icon}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-900 truncate flex items-center gap-2">
                              {item.title}
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 uppercase tracking-wider">
                                {item.category}
                              </span>
                            </div>
                            {item.subtitle && (
                              <div className="text-xs text-slate-500 truncate mt-0.5">
                                {item.subtitle}
                              </div>
                            )}
                          </div>
                        </div>
                        <ArrowRight className={`w-4 h-4 shrink-0 transition-transform ${isSelected ? 'text-blue-600 translate-x-0.5' : 'text-slate-300'}`} />
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="py-12 text-center text-slate-500">
                  <p className="text-sm font-semibold text-slate-700">No matching entries found</p>
                  <p className="text-xs text-slate-400 mt-1">Try searching for invoice numbers, party names, or report names</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-400 font-medium">
              <div className="flex items-center gap-3">
                <span><kbd className="px-1.5 py-0.5 text-[10px] bg-white rounded border border-slate-200 font-mono">↑↓</kbd> Navigate</span>
                <span><kbd className="px-1.5 py-0.5 text-[10px] bg-white rounded border border-slate-200 font-mono">↵</kbd> Select</span>
              </div>
              <div>
                <span><kbd className="px-1.5 py-0.5 text-[10px] bg-white rounded border border-slate-200 font-mono">ESC</kbd> Close</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
