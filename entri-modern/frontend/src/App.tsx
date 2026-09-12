import React, { useState } from 'react'
import { BrowserRouter, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  FileText,
  Receipt,
  CreditCard,
  BookOpen,
  ShoppingBag,
  ArrowLeftRight,
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
  PanelLeft,
  X,
} from 'lucide-react'

import Dashboard from './pages/Dashboard'
import AIChat from './pages/AIChat'
import SalesInvoices from './pages/SalesInvoices'
import SalesInvoiceForm from './pages/SalesInvoiceForm'
import PurchaseInvoices from './pages/PurchaseInvoices'
import PurchaseInvoiceForm from './pages/PurchaseInvoiceForm'
import Payments from './pages/Payments'
import PaymentForm from './pages/PaymentForm'
import JournalEntries from './pages/JournalEntries'
import JournalEntryForm from './pages/JournalEntryForm'
import PurchaseOrders from './pages/PurchaseOrders'
import PurchaseOrderForm from './pages/PurchaseOrderForm'
import Reconciliations from './pages/Reconciliations'
import ReconciliationForm from './pages/ReconciliationForm'
import ProfitAndLoss from './pages/ProfitAndLoss'
import BalanceSheet from './pages/BalanceSheet'
import GeneralLedger from './pages/GeneralLedger'
import TrialBalance from './pages/TrialBalance'
import ARAging from './pages/ARAging'
import APAging from './pages/APAging'
import TaxSummary from './pages/TaxSummary'
import CloseChecklist from './pages/CloseChecklist'
import Approvals from './pages/Approvals'
import Accounts from './pages/Accounts'
import Parties from './pages/Parties'
import PartyForm from './pages/PartyForm'
import Items from './pages/Items'
import ItemForm from './pages/ItemForm'
import SettingsPage from './pages/Settings'
import GlobalSearch from './components/GlobalSearch'

function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [isAIModalOpen, setIsAIModalOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const path = location.pathname

  React.useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'NAVIGATE_PAGE' && event.data?.route) {
        navigate(event.data.route)
        setIsAIModalOpen(false)
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [navigate])

  const isLinkActive = (target: string, exact = false) => {
    if (exact) return path === target
    if (target === '/') return path === '/'
    return path.startsWith(target)
  }

  return (
    <div className="flex h-screen overflow-hidden bg-white relative">
      {/* Blurry Glass Backdrop Overlay over full app when AI Modal is open */}
      {isAIModalOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-md transition-all duration-300 animate-in fade-in"
          onClick={() => setIsAIModalOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile sidebar backdrop overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-gray-900/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar navigation */}
      <aside
        id="app-sidebar"
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-white border-r border-slate-200/80 transition-all duration-200 ease-in-out md:static md:translate-x-0 h-full max-h-screen overflow-hidden ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } ${sidebarCollapsed ? 'md:w-16' : 'md:w-64'} ${
          isAIModalOpen ? 'blur-[3px] opacity-75 pointer-events-none' : ''
        }`}
      >
        <div className={`flex h-14 shrink-0 items-center justify-between px-4 ${sidebarCollapsed ? 'md:justify-center md:px-0' : ''}`}>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2.5">
            <img src="/logo.png" alt="entri logo" className="w-8 h-8 rounded-lg shadow-sm object-cover" />
            <span className={`tracking-tight text-blue-600 ${sidebarCollapsed ? 'md:hidden' : 'inline'}`}>entri</span>
          </h1>
          <button
            type="button"
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-200 hover:text-gray-700 md:hidden"
            aria-label="Close navigation"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 min-h-0 px-3 py-2 overflow-y-auto no-scrollbar">
          <nav className="space-y-1" aria-label="Primary navigation">
            <Link
              to="/"
              title="Dashboard"
              onClick={() => setSidebarOpen(false)}
              className={`sidebar-link ${isLinkActive('/', true) ? 'sidebar-link-active' : 'sidebar-link-inactive'} ${sidebarCollapsed ? 'sidebar-link-collapsed' : ''}`}
            >
              <LayoutDashboard className="w-5 h-5 shrink-0" />
              <span className={sidebarCollapsed ? 'md:hidden' : 'inline'}>Dashboard</span>
            </Link>
            <Link
              to="/sales-invoices"
              title="Sales Invoices"
              onClick={() => setSidebarOpen(false)}
              className={`sidebar-link ${isLinkActive('/sales-invoices') ? 'sidebar-link-active' : 'sidebar-link-inactive'} ${sidebarCollapsed ? 'sidebar-link-collapsed' : ''}`}
            >
              <FileText className="w-5 h-5 shrink-0" />
              <span className={sidebarCollapsed ? 'md:hidden' : 'inline'}>Sales Invoices</span>
            </Link>
            <Link
              to="/purchase-invoices"
              title="Purchase Invoices"
              onClick={() => setSidebarOpen(false)}
              className={`sidebar-link ${isLinkActive('/purchase-invoices') ? 'sidebar-link-active' : 'sidebar-link-inactive'} ${sidebarCollapsed ? 'sidebar-link-collapsed' : ''}`}
            >
              <Receipt className="w-5 h-5 shrink-0" />
              <span className={sidebarCollapsed ? 'md:hidden' : 'inline'}>Purchase Invoices</span>
            </Link>
            <Link
              to="/payments"
              title="Payments"
              onClick={() => setSidebarOpen(false)}
              className={`sidebar-link ${isLinkActive('/payments') ? 'sidebar-link-active' : 'sidebar-link-inactive'} ${sidebarCollapsed ? 'sidebar-link-collapsed' : ''}`}
            >
              <CreditCard className="w-5 h-5 shrink-0" />
              <span className={sidebarCollapsed ? 'md:hidden' : 'inline'}>Payments</span>
            </Link>
            <Link
              to="/journal-entries"
              title="Journal Entries"
              onClick={() => setSidebarOpen(false)}
              className={`sidebar-link ${isLinkActive('/journal-entries') ? 'sidebar-link-active' : 'sidebar-link-inactive'} ${sidebarCollapsed ? 'sidebar-link-collapsed' : ''}`}
            >
              <BookOpen className="w-5 h-5 shrink-0" />
              <span className={sidebarCollapsed ? 'md:hidden' : 'inline'}>Journal Entries</span>
            </Link>
            <Link
              to="/purchase-orders"
              title="Purchase Orders"
              onClick={() => setSidebarOpen(false)}
              className={`sidebar-link ${isLinkActive('/purchase-orders') ? 'sidebar-link-active' : 'sidebar-link-inactive'} ${sidebarCollapsed ? 'sidebar-link-collapsed' : ''}`}
            >
              <ShoppingBag className="w-5 h-5 shrink-0" />
              <span className={sidebarCollapsed ? 'md:hidden' : 'inline'}>Purchase Orders</span>
            </Link>
            <Link
              to="/reconciliations"
              title="Reconciliations"
              onClick={() => setSidebarOpen(false)}
              className={`sidebar-link ${isLinkActive('/reconciliations') ? 'sidebar-link-active' : 'sidebar-link-inactive'} ${sidebarCollapsed ? 'sidebar-link-collapsed' : ''}`}
            >
              <ArrowLeftRight className="w-5 h-5 shrink-0" />
              <span className={sidebarCollapsed ? 'md:hidden' : 'inline'}>Reconciliations</span>
            </Link>

            <div className={`pt-4 pb-2 ${sidebarCollapsed ? 'md:hidden' : 'block'}`}>
              <p className="px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Reports</p>
            </div>
            {sidebarCollapsed && <div className="hidden md:block my-2 border-t border-slate-200/80"></div>}

            <Link
              to="/reports/profit-and-loss"
              title="Profit & Loss"
              onClick={() => setSidebarOpen(false)}
              className={`sidebar-link ${isLinkActive('/reports/profit-and-loss') ? 'sidebar-link-active' : 'sidebar-link-inactive'} ${sidebarCollapsed ? 'sidebar-link-collapsed' : ''}`}
            >
              <TrendingUp className="w-5 h-5 shrink-0" />
              <span className={sidebarCollapsed ? 'md:hidden' : 'inline'}>Profit & Loss</span>
            </Link>
            <Link
              to="/reports/balance-sheet"
              title="Balance Sheet"
              onClick={() => setSidebarOpen(false)}
              className={`sidebar-link ${isLinkActive('/reports/balance-sheet') ? 'sidebar-link-active' : 'sidebar-link-inactive'} ${sidebarCollapsed ? 'sidebar-link-collapsed' : ''}`}
            >
              <Scale className="w-5 h-5 shrink-0" />
              <span className={sidebarCollapsed ? 'md:hidden' : 'inline'}>Balance Sheet</span>
            </Link>
            <Link
              to="/reports/general-ledger"
              title="General Ledger"
              onClick={() => setSidebarOpen(false)}
              className={`sidebar-link ${isLinkActive('/reports/general-ledger') ? 'sidebar-link-active' : 'sidebar-link-inactive'} ${sidebarCollapsed ? 'sidebar-link-collapsed' : ''}`}
            >
              <BookMarked className="w-5 h-5 shrink-0" />
              <span className={sidebarCollapsed ? 'md:hidden' : 'inline'}>General Ledger</span>
            </Link>
            <Link
              to="/reports/trial-balance"
              title="Trial Balance"
              onClick={() => setSidebarOpen(false)}
              className={`sidebar-link ${isLinkActive('/reports/trial-balance') ? 'sidebar-link-active' : 'sidebar-link-inactive'} ${sidebarCollapsed ? 'sidebar-link-collapsed' : ''}`}
            >
              <Calculator className="w-5 h-5 shrink-0" />
              <span className={sidebarCollapsed ? 'md:hidden' : 'inline'}>Trial Balance</span>
            </Link>
            <Link
              to="/reports/ar-aging"
              title="AR Aging"
              onClick={() => setSidebarOpen(false)}
              className={`sidebar-link ${isLinkActive('/reports/ar-aging') ? 'sidebar-link-active' : 'sidebar-link-inactive'} ${sidebarCollapsed ? 'sidebar-link-collapsed' : ''}`}
            >
              <Clock className="w-5 h-5 shrink-0" />
              <span className={sidebarCollapsed ? 'md:hidden' : 'inline'}>AR Aging</span>
            </Link>
            <Link
              to="/reports/ap-aging"
              title="AP Aging"
              onClick={() => setSidebarOpen(false)}
              className={`sidebar-link ${isLinkActive('/reports/ap-aging') ? 'sidebar-link-active' : 'sidebar-link-inactive'} ${sidebarCollapsed ? 'sidebar-link-collapsed' : ''}`}
            >
              <Hourglass className="w-5 h-5 shrink-0" />
              <span className={sidebarCollapsed ? 'md:hidden' : 'inline'}>AP Aging</span>
            </Link>
            <Link
              to="/reports/tax-summary"
              title="Tax Summary"
              onClick={() => setSidebarOpen(false)}
              className={`sidebar-link ${isLinkActive('/reports/tax-summary') ? 'sidebar-link-active' : 'sidebar-link-inactive'} ${sidebarCollapsed ? 'sidebar-link-collapsed' : ''}`}
            >
              <Landmark className="w-5 h-5 shrink-0" />
              <span className={sidebarCollapsed ? 'md:hidden' : 'inline'}>Tax Summary</span>
            </Link>
            <Link
              to="/reports/close-checklist"
              title="Close Management"
              onClick={() => setSidebarOpen(false)}
              className={`sidebar-link ${isLinkActive('/reports/close-checklist') ? 'sidebar-link-active' : 'sidebar-link-inactive'} ${sidebarCollapsed ? 'sidebar-link-collapsed' : ''}`}
            >
              <CheckSquare className="w-5 h-5 shrink-0" />
              <span className={sidebarCollapsed ? 'md:hidden' : 'inline'}>Close Management</span>
            </Link>

            <div className={`pt-4 pb-2 ${sidebarCollapsed ? 'md:hidden' : 'block'}`}>
              <p className="px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Masters</p>
            </div>
            {sidebarCollapsed && <div className="hidden md:block my-2 border-t border-slate-200/80"></div>}

            <Link
              to="/approvals"
              title="Approvals"
              onClick={() => setSidebarOpen(false)}
              className={`sidebar-link ${isLinkActive('/approvals', true) ? 'sidebar-link-active' : 'sidebar-link-inactive'} ${sidebarCollapsed ? 'sidebar-link-collapsed' : ''}`}
            >
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <span className={sidebarCollapsed ? 'md:hidden' : 'inline'}>Approvals</span>
            </Link>
            <Link
              to="/accounts"
              title="Chart of Accounts"
              onClick={() => setSidebarOpen(false)}
              className={`sidebar-link ${isLinkActive('/accounts', true) ? 'sidebar-link-active' : 'sidebar-link-inactive'} ${sidebarCollapsed ? 'sidebar-link-collapsed' : ''}`}
            >
              <FolderTree className="w-5 h-5 shrink-0" />
              <span className={sidebarCollapsed ? 'md:hidden' : 'inline'}>Chart of Accounts</span>
            </Link>
            <Link
              to="/parties"
              title="Parties"
              onClick={() => setSidebarOpen(false)}
              className={`sidebar-link ${isLinkActive('/parties') ? 'sidebar-link-active' : 'sidebar-link-inactive'} ${sidebarCollapsed ? 'sidebar-link-collapsed' : ''}`}
            >
              <Users className="w-5 h-5 shrink-0" />
              <span className={sidebarCollapsed ? 'md:hidden' : 'inline'}>Parties</span>
            </Link>
            <Link
              to="/items"
              title="Items"
              onClick={() => setSidebarOpen(false)}
              className={`sidebar-link ${isLinkActive('/items') ? 'sidebar-link-active' : 'sidebar-link-inactive'} ${sidebarCollapsed ? 'sidebar-link-collapsed' : ''}`}
            >
              <Package className="w-5 h-5 shrink-0" />
              <span className={sidebarCollapsed ? 'md:hidden' : 'inline'}>Items</span>
            </Link>
            <Link
              to="/settings"
              title="Settings"
              onClick={() => setSidebarOpen(false)}
              className={`sidebar-link ${isLinkActive('/settings', true) ? 'sidebar-link-active' : 'sidebar-link-inactive'} ${sidebarCollapsed ? 'sidebar-link-collapsed' : ''}`}
            >
              <Settings className="w-5 h-5 shrink-0" />
              <span className={sidebarCollapsed ? 'md:hidden' : 'inline'}>Settings</span>
            </Link>
          </nav>
        </div>
      </aside>

      {/* Main Content Viewport */}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-white">
        {/* Top Header Bar with Top-Left Sidebar Toggle Icon */}
        <header className="flex h-14 shrink-0 items-center justify-between px-4 border-b border-slate-200/80 md:border-b-0 bg-white">
          <div className="flex items-center gap-3">
            {/* Desktop Toggle Icon */}
            <button
              type="button"
              className="hidden md:flex items-center justify-center p-2 rounded-lg text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors border-0 bg-transparent cursor-pointer"
              title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
              aria-label="Toggle sidebar collapse"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            >
              <PanelLeft className="w-5 h-5 text-slate-700" />
            </button>

            {/* Mobile Toggle Icon */}
            <button
              type="button"
              className="md:hidden flex items-center justify-center p-2 rounded-lg text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors border-0 bg-transparent cursor-pointer"
              aria-label="Open navigation"
              onClick={() => setSidebarOpen(true)}
            >
              <PanelLeft className="w-5 h-5 text-slate-700" />
            </button>

            <div className="h-5 w-[1px] bg-slate-200"></div>

            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="entri logo" className="w-6 h-6 rounded object-cover" />
              <span className="text-base font-bold tracking-tight text-blue-600">entri</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <GlobalSearch />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-8 max-w-7xl mx-auto">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/ai" element={<AIChat />} />
              <Route path="/sales-invoices" element={<SalesInvoices />} />
              <Route path="/sales-invoices/new" element={<SalesInvoiceForm />} />
              <Route path="/sales-invoices/:name" element={<SalesInvoiceForm />} />
              <Route path="/purchase-invoices" element={<PurchaseInvoices />} />
              <Route path="/purchase-invoices/new" element={<PurchaseInvoiceForm />} />
              <Route path="/purchase-invoices/:name" element={<PurchaseInvoiceForm />} />
              <Route path="/payments" element={<Payments />} />
              <Route path="/payments/new" element={<PaymentForm />} />
              <Route path="/journal-entries" element={<JournalEntries />} />
              <Route path="/journal-entries/new" element={<JournalEntryForm />} />
              <Route path="/purchase-orders" element={<PurchaseOrders />} />
              <Route path="/purchase-orders/new" element={<PurchaseOrderForm />} />
              <Route path="/reconciliations" element={<Reconciliations />} />
              <Route path="/reconciliations/new" element={<ReconciliationForm />} />
              <Route path="/reports/profit-and-loss" element={<ProfitAndLoss />} />
              <Route path="/reports/balance-sheet" element={<BalanceSheet />} />
              <Route path="/reports/general-ledger" element={<GeneralLedger />} />
              <Route path="/reports/trial-balance" element={<TrialBalance />} />
              <Route path="/reports/ar-aging" element={<ARAging />} />
              <Route path="/reports/ap-aging" element={<APAging />} />
              <Route path="/reports/tax-summary" element={<TaxSummary />} />
              <Route path="/reports/close-checklist" element={<CloseChecklist />} />
              <Route path="/approvals" element={<Approvals />} />
              <Route path="/accounts" element={<Accounts />} />
              <Route path="/parties" element={<Parties />} />
              <Route path="/parties/new" element={<PartyForm />} />
              <Route path="/parties/:name" element={<PartyForm />} />
              <Route path="/items" element={<Items />} />
              <Route path="/items/new" element={<ItemForm />} />
              <Route path="/items/:name" element={<ItemForm />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </div>
        </div>

        {/* Floating AI Vercel Chatbot Modal Container */}
        {/* Mobile: starts from top of page (top-2 h-[calc(100vh-5.5rem)]) */}
        {/* Desktop: centered and resizable (desktop-resizable-modal) */}
        {isAIModalOpen && (
          <div className="fixed z-50 bg-white rounded-2xl shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 top-2 inset-x-2 bottom-20 h-[calc(100vh-5.5rem)] md:top-auto md:bottom-20 md:left-1/2 md:-translate-x-1/2 md:inset-x-auto md:w-[840px] md:h-[650px] desktop-resizable-modal">
            {/* Top Desktop Resize Handle Indicator */}
            <div className="hidden md:flex items-center justify-center h-2 bg-slate-100/80 hover:bg-blue-100/80 cursor-ns-resize shrink-0 transition-colors">
              <div className="w-10 h-1 bg-slate-300 rounded-full" />
            </div>

            <iframe
              src="http://localhost:3001"
              className="w-full flex-1 border-0 rounded-b-2xl"
              title="entri Vercel AI Chatbot"
            />
          </div>
        )}

        {/* Floating AI Agent Button with Soft Glow Effect */}
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50">
          <button
            type="button"
            onClick={() => setIsAIModalOpen(!isAIModalOpen)}
            className="liquid-water-glow-btn flex items-center gap-2.5 px-6 py-3 rounded-full text-white font-semibold text-sm transition-all duration-300 cursor-pointer hover:scale-105 active:scale-95 border border-white/20"
          >
            {isAIModalOpen ? (
              <>
                <X className="w-5 h-5 text-white stroke-[2.5]" />
                <span className="text-white font-semibold text-sm tracking-wide">Close</span>
              </>
            ) : (
              <>
                <img
                  src="/AI.jpeg"
                  alt="AI Agent"
                  className="w-7 h-7 rounded-full object-cover ring-2 ring-white/70 shadow-sm"
                />
                <span className="text-white font-semibold text-sm tracking-wide">
                  Ask AI
                </span>
              </>
            )}
          </button>
        </div>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  )
}
