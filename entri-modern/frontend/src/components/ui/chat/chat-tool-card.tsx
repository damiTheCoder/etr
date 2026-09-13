import * as React from "react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge/Badge"
import {
  Users,
  FileText,
  TrendingUp,
  CheckCircle2,
  Clock,
  CreditCard,
  BookOpen,
  Package,
  FolderTree,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from "lucide-react"

export interface ToolExecution {
  name: string
  arguments: any
  result: any
}

interface ToolCardWrapperProps {
  title: string
  icon: React.ElementType
  isSuccess?: boolean
  children: React.ReactNode
}

const ToolCardWrapper: React.FC<ToolCardWrapperProps> = ({
  title,
  icon: Icon,
  isSuccess = true,
  children,
}) => {
  const [expanded, setExpanded] = React.useState(true)

  return (
    <div className="mt-3.5 overflow-hidden rounded-2xl border-none bg-slate-200/60 shadow-2xs transition-all">
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-300/40 transition-colors select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <Icon className="w-4 h-4 text-slate-600 shrink-0" />
          <span className="font-semibold text-xs sm:text-sm text-slate-800 truncate">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] py-0.5 px-2 flex items-center gap-1 font-medium border-none bg-emerald-500/15 text-emerald-700">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>Success</span>
          </Badge>
          <button type="button" className="text-slate-400 hover:text-slate-700 transition-colors">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>
      {expanded && (
        <div className="p-3.5 pt-0 border-none text-xs sm:text-sm">
          {children}
        </div>
      )}
    </div>
  )
}

export const renderShadcnToolCard = (tool: ToolExecution) => {
  if (!tool.result) return null

  // 1. Customers / Parties
  if (tool.name === "get_customers" || tool.name === "get_parties") {
    const list = tool.result.customers || tool.result.parties || []
    const isCustomer = tool.name === "get_customers" || tool.arguments?.party_type === "Customer"
    return (
      <ToolCardWrapper title={`${isCustomer ? "Customers" : "Parties"} (${tool.result.total || list.length})`} icon={Users}>
        {list.length === 0 ? (
          <p className="text-slate-500 italic text-xs">No records found.</p>
        ) : (
          <div className="flex flex-col gap-2 max-h-60 overflow-y-auto no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden pr-1">
            {list.map((c: any, idx: number) => (
              <div key={idx} className="flex justify-between items-center bg-white/90 p-3 rounded-xl border-none shadow-2xs">
                <span className="font-medium text-slate-900 text-xs">{c.name}</span>
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-slate-200/70 text-slate-600 font-medium border-none">
                  {c.partyType || (isCustomer ? "Customer" : "Supplier")}
                </span>
              </div>
            ))}
          </div>
        )}
      </ToolCardWrapper>
    )
  }

  // 2. Invoices
  if (tool.name === "get_sales_invoices" || tool.name === "get_purchase_invoices") {
    const invoices = tool.result.invoices || []
    const isSales = tool.name === "get_sales_invoices"
    return (
      <ToolCardWrapper title={`${isSales ? "Sales Invoices" : "Purchase Invoices"} (${tool.result.total || invoices.length})`} icon={FileText}>
        {invoices.length === 0 ? (
          <p className="text-slate-500 italic text-xs">No invoices found.</p>
        ) : (
          <div className="flex flex-col gap-2 max-h-60 overflow-y-auto no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden pr-1">
            {invoices.map((inv: any, idx: number) => (
              <div key={idx} className="flex justify-between items-center bg-white/90 p-3 rounded-xl border-none shadow-2xs">
                <div>
                  <div className="font-medium text-slate-900 text-xs">{inv.name}</div>
                  <div className="text-slate-500 text-[11px]">
                    {inv.customer || inv.supplier || inv.party} &bull; {inv.date}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-slate-900 text-xs">${(inv.grandTotal || 0).toLocaleString()}</div>
                  <span className="text-[10px] text-emerald-600 font-medium">
                    {inv.status || "Submitted"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </ToolCardWrapper>
    )
  }

  // 3. Document Creation Result
  if (tool.name === "create_sales_invoice" || tool.name === "create_purchase_invoice" || tool.name === "create_party") {
    const r = tool.result
    return (
      <ToolCardWrapper title="Document Created" icon={CheckCircle2}>
        <div className="space-y-2 text-slate-900 bg-white/90 p-3 rounded-xl border-none text-xs shadow-2xs">
          {r.invoice_name && <div className="flex justify-between"><span className="text-slate-500">ID:</span> <span className="font-medium">{r.invoice_name}</span></div>}
          {r.party_name && <div className="flex justify-between"><span className="text-slate-500">Party Name:</span> <span className="font-medium">{r.party_name}</span></div>}
          {r.customer && <div className="flex justify-between"><span className="text-slate-500">Customer:</span> <span className="font-medium">{r.customer}</span></div>}
          {r.grand_total !== undefined && <div className="flex justify-between"><span className="text-slate-500">Grand Total:</span> <span className="font-semibold text-emerald-600">${r.grand_total.toLocaleString()}</span></div>}
        </div>
      </ToolCardWrapper>
    )
  }

  // 4. Payments
  if (tool.name === "get_payments") {
    const payments = tool.result.payments || []
    return (
      <ToolCardWrapper title={`Payments (${tool.result.total || payments.length})`} icon={CreditCard}>
        {payments.length === 0 ? (
          <p className="text-slate-500 italic text-xs">No payments found.</p>
        ) : (
          <div className="flex flex-col gap-2 max-h-60 overflow-y-auto no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden pr-1">
            {payments.map((p: any, idx: number) => (
              <div key={idx} className="flex justify-between items-center bg-white/90 p-3 rounded-xl border-none shadow-2xs">
                <div>
                  <div className="font-medium text-slate-900 text-xs">{p.name} ({p.paymentType})</div>
                  <div className="text-slate-500 text-[11px]">{p.party} &bull; {p.date}</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-emerald-600 text-xs">${(p.amount || 0).toLocaleString()}</div>
                  <span className="text-[10px] text-slate-500">{p.account}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </ToolCardWrapper>
    )
  }

  // 5. Financial Overview (P&L, Balance Sheet, Dashboard Metrics)
  if (
    tool.name === "get_dashboard_metrics" ||
    tool.name === "get_profit_and_loss" ||
    tool.name === "get_balance_sheet" ||
    tool.name === "get_trial_balance"
  ) {
    const m = tool.result
    const totalInc = m.income?.total ?? m.totalIncome ?? 0
    const totalExp = m.expenses?.total ?? m.totalExpenses ?? 0
    const netProf = m.netProfit ?? (totalInc - totalExp)

    return (
      <ToolCardWrapper title="Financial Performance Overview" icon={TrendingUp}>
        <div className="grid grid-cols-3 gap-2.5">
          <div className="bg-white/90 p-3 rounded-xl border-none text-center shadow-2xs">
            <div className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider mb-1">Income</div>
            <div className="font-semibold text-xs sm:text-sm text-slate-900">${totalInc.toLocaleString()}</div>
          </div>
          <div className="bg-white/90 p-3 rounded-xl border-none text-center shadow-2xs">
            <div className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider mb-1">Expenses</div>
            <div className="font-semibold text-xs sm:text-sm text-slate-900">${totalExp.toLocaleString()}</div>
          </div>
          <div className="bg-white/90 p-3 rounded-xl border-none text-center shadow-2xs">
            <div className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider mb-1">Net Profit</div>
            <div className={cn("font-semibold text-xs sm:text-sm", netProf >= 0 ? "text-emerald-600" : "text-rose-600")}>
              ${netProf.toLocaleString()}
            </div>
          </div>
        </div>
      </ToolCardWrapper>
    )
  }

  // 6. Navigation
  if (tool.name === "navigate_to_page") {
    const route = tool.result.route || tool.arguments?.page_route
    return (
      <ToolCardWrapper title={`Navigating to ${route}`} icon={ExternalLink}>
        <p className="text-slate-500 text-xs">Redirecting user to page view...</p>
      </ToolCardWrapper>
    )
  }

  return null
}
