import * as React from "react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge/Badge"
import {
  Users,
  FileText,
  TrendingUp,
  BarChart3,
  CheckCircle2,
  AlertCircle,
  Clock,
  CreditCard,
  BookOpen,
  Package,
  FolderTree,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { useCompany } from "@/context/CompanyContext"

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
          {isSuccess ? (
            <Badge variant="outline" className="text-[10px] py-0.5 px-2 flex items-center gap-1 font-medium border-none bg-emerald-500/15 text-emerald-700">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span>Success</span>
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] py-0.5 px-2 flex items-center gap-1 font-medium border-none bg-rose-500/15 text-rose-700">
              <AlertCircle className="w-3 h-3 text-rose-600" />
              <span>Failed</span>
            </Badge>
          )}
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

const DocActionCard: React.FC<{ tool: ToolExecution }> = ({ tool }) => {
  const { formatCurrency } = useCompany()
  const r = tool.result
  if (!r || r.error) {
    return (
      <ToolCardWrapper title="Transaction Failed" icon={AlertCircle} isSuccess={false}>
        <div className="p-3 bg-white/90 rounded-xl text-xs text-rose-600 font-medium">
          {r?.error || "Transaction could not be processed."}
        </div>
      </ToolCardWrapper>
    )
  }
  const schemaName = r.schema_name || (tool.name.includes("sales") ? "SalesInvoice" : tool.name.includes("purchase") ? "PurchaseInvoice" : tool.name.includes("payment") ? "Payment" : "JournalEntry")
  const docName = r.doc_name || r.invoice_name || r.payment_name || r.jv_name

  const [status, setStatus] = React.useState<string>(r.status || "Draft")
  const [submitting, setSubmitting] = React.useState<boolean>(false)
  const [feedbackMsg, setFeedbackMsg] = React.useState<string | null>(null)

  const handleAction = async (actionType: "submit" | "draft") => {
    if (!docName || submitting) return
    setSubmitting(true)
    try {
      const res = await fetch("/api/ai/submit-doc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schema_name: schemaName,
          doc_name: docName,
          action: actionType,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setStatus(data.status)
        setFeedbackMsg(data.message)
      }
    } catch (e: any) {
      console.error("Doc submission action error:", e)
    } finally {
      setSubmitting(false)
    }
  }

  const isSubmitted = status === "Submitted"

  return (
    <ToolCardWrapper title={`${schemaName} Created`} icon={CheckCircle2}>
      <div className="space-y-3 bg-white/90 p-3.5 rounded-xl border-none text-xs shadow-2xs">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-slate-800 text-sm">{docName}</span>
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] px-2 py-0.5 font-semibold border-none",
              isSubmitted ? "bg-emerald-500/15 text-emerald-700" : "bg-amber-500/15 text-amber-700"
            )}
          >
            {isSubmitted ? "Submitted & Posted to Ledger" : "Draft"}
          </Badge>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white">
          <table className="w-full text-left text-xs border-collapse font-sans">
            <tbody className="divide-y divide-slate-100">
              {r.customer && (
                <tr className="hover:bg-slate-50/50">
                  <td className="py-2 px-3 text-slate-500 font-medium">Customer</td>
                  <td className="py-2 px-3 text-right font-semibold text-slate-900">{r.customer}</td>
                </tr>
              )}
              {r.supplier && (
                <tr className="hover:bg-slate-50/50">
                  <td className="py-2 px-3 text-slate-500 font-medium">Supplier</td>
                  <td className="py-2 px-3 text-right font-semibold text-slate-900">{r.supplier}</td>
                </tr>
              )}
              {r.party && (
                <tr className="hover:bg-slate-50/50">
                  <td className="py-2 px-3 text-slate-500 font-medium">Party</td>
                  <td className="py-2 px-3 text-right font-semibold text-slate-900">{r.party}</td>
                </tr>
              )}
              {r.grand_total !== undefined && (
                <tr className="hover:bg-slate-50/50">
                  <td className="py-2 px-3 text-slate-500 font-medium">Grand Total</td>
                  <td className="py-2 px-3 text-right font-semibold text-slate-900 tabular-nums">{formatCurrency(r.grand_total)}</td>
                </tr>
              )}
              {r.amount !== undefined && (
                <tr className="hover:bg-slate-50/50">
                  <td className="py-2 px-3 text-slate-500 font-medium">Amount</td>
                  <td className="py-2 px-3 text-right font-semibold text-slate-900 tabular-nums">{formatCurrency(r.amount)}</td>
                </tr>
              )}
              {r.total_debit !== undefined && (
                <tr className="hover:bg-slate-50/50">
                  <td className="py-2 px-3 text-slate-500 font-medium">Total Debit / Credit</td>
                  <td className="py-2 px-3 text-right font-semibold text-slate-900 tabular-nums">{formatCurrency(r.total_debit)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {feedbackMsg ? (
          <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-800 text-[11px] font-medium flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>{feedbackMsg}</span>
          </div>
        ) : (
          !isSubmitted && (
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleAction("submit")}
                className="flex-1 py-1.5 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-semibold text-xs transition-all shadow-xs disabled:opacity-50 cursor-pointer border-none"
              >
                {submitting ? "Submitting..." : "Submit to Ledger"}
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleAction("draft")}
                className="flex-1 py-1.5 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs transition-all border border-slate-200 disabled:opacity-50 cursor-pointer"
              >
                Keep as Draft
              </button>
            </div>
          )
        )}
      </div>
    </ToolCardWrapper>
  )
}

const ShadcnToolCardComponent: React.FC<{ tool: ToolExecution }> = ({ tool }) => {
  const { formatCurrency } = useCompany()
  if (!tool.result) return null

  if (tool.result.error) {
    return (
      <ToolCardWrapper title={`Action Failed: ${tool.name}`} icon={AlertCircle} isSuccess={false}>
        <div className="p-3 bg-white/90 rounded-xl text-xs text-rose-600 font-medium">
          {tool.result.error}
        </div>
      </ToolCardWrapper>
    )
  }

  // 1. Customers / Parties
  if (tool.name === "get_customers" || tool.name === "get_parties") {
    const list = tool.result.customers || tool.result.parties || []
    const isCustomer = tool.name === "get_customers" || tool.arguments?.party_type === "Customer"
    return (
      <ToolCardWrapper title={`${isCustomer ? "Customers" : "Parties"} (${tool.result.total || list.length})`} icon={Users}>
        {list.length === 0 ? (
          <p className="text-slate-500 italic text-xs">No records found.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white/90 shadow-2xs">
            <table className="w-full text-left text-xs border-collapse font-sans">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-100/70 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3.5 font-semibold">Name</th>
                  <th className="py-2.5 px-3.5 text-right font-semibold">Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
                {list.map((c: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-2.5 px-3.5 font-medium text-slate-900">{c.name}</td>
                    <td className="py-2.5 px-3.5 text-right">
                      <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium border border-slate-200/60">
                        {c.partyType || (isCustomer ? "Customer" : "Supplier")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
          <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white/90 shadow-2xs">
            <table className="w-full text-left text-xs border-collapse font-sans">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-100/70 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3.5 font-semibold">Invoice No</th>
                  <th className="py-2.5 px-3.5 font-semibold">Party & Date</th>
                  <th className="py-2.5 px-3.5 text-right font-semibold">Grand Total</th>
                  <th className="py-2.5 px-3.5 text-right font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((inv: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-2.5 px-3.5 font-semibold text-slate-900">{inv.name}</td>
                    <td className="py-2.5 px-3.5 text-slate-600">
                      <div>{inv.customer || inv.supplier || inv.party}</div>
                      <div className="text-[10px] text-slate-400">{inv.date}</div>
                    </td>
                    <td className="py-2.5 px-3.5 text-right font-semibold text-slate-900 tabular-nums">{formatCurrency(inv.grandTotal || 0)}</td>
                    <td className="py-2.5 px-3.5 text-right">
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-medium">
                        {inv.status || "Submitted"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ToolCardWrapper>
    )
  }

  // 3. Document Creation Result
  if (
    tool.name === "create_sales_invoice" ||
    tool.name === "create_purchase_invoice" ||
    tool.name === "create_payment" ||
    tool.name === "create_journal_entry"
  ) {
    return <DocActionCard tool={tool} />
  }

  if (tool.name === "create_party") {
    const r = tool.result
    return (
      <ToolCardWrapper title="Party Created" icon={CheckCircle2}>
        <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white/90 shadow-2xs">
          <table className="w-full text-left text-xs border-collapse font-sans">
            <tbody className="divide-y divide-slate-100">
              {r.party_name && (
                <tr className="hover:bg-slate-50/50">
                  <td className="py-2.5 px-3.5 text-slate-500 font-medium">Party Name</td>
                  <td className="py-2.5 px-3.5 text-right font-semibold text-slate-900">{r.party_name}</td>
                </tr>
              )}
              {r.party_type && (
                <tr className="hover:bg-slate-50/50">
                  <td className="py-2.5 px-3.5 text-slate-500 font-medium">Party Type</td>
                  <td className="py-2.5 px-3.5 text-right font-semibold text-slate-900">{r.party_type}</td>
                </tr>
              )}
            </tbody>
          </table>
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
          <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white/90 shadow-2xs">
            <table className="w-full text-left text-xs border-collapse font-sans">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-100/70 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3.5 font-semibold">Payment ID</th>
                  <th className="py-2.5 px-3.5 font-semibold">Party</th>
                  <th className="py-2.5 px-3.5 text-right font-semibold">Amount</th>
                  <th className="py-2.5 px-3.5 text-right font-semibold">Account</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((p: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-2.5 px-3.5 font-semibold text-slate-900">
                      <div>{p.name}</div>
                      <div className="text-[10px] text-slate-400 font-normal">{p.paymentType}</div>
                    </td>
                    <td className="py-2.5 px-3.5 text-slate-600">
                      <div>{p.party}</div>
                      <div className="text-[10px] text-slate-400">{p.date}</div>
                    </td>
                    <td className="py-2.5 px-3.5 text-right font-semibold text-emerald-600 tabular-nums">{formatCurrency(p.amount || 0)}</td>
                    <td className="py-2.5 px-3.5 text-right text-slate-500 text-[11px]">{p.account}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ToolCardWrapper>
    )
  }

  // 5. Profit & Loss / Dashboard Metrics
  if (tool.name === "get_dashboard_metrics" || tool.name === "get_profit_and_loss") {
    const m = tool.result
    const totalInc = m.income?.total ?? m.totalIncome ?? m.total_revenue ?? 0
    const totalExp = m.expenses?.total ?? m.totalExpenses ?? m.total_expenses ?? 0
    const netProf = m.netProfit ?? m.net_profit ?? (totalInc - totalExp)

    return (
      <ToolCardWrapper title="Profit & Loss Overview" icon={BarChart3}>
        <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white/90 shadow-2xs">
          <table className="w-full text-left text-xs border-collapse font-sans">
            <thead>
              <tr className="border-b border-slate-200/80 bg-slate-100/70 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-4 font-semibold">Category</th>
                <th className="py-2.5 px-4 text-right font-semibold">Amount</th>
                <th className="py-2.5 px-4 text-right font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr className="hover:bg-slate-50/50 transition-colors">
                <td className="py-2.5 px-4 font-medium text-slate-800">Total Income</td>
                <td className="py-2.5 px-4 text-right font-semibold text-slate-900 tabular-nums">{formatCurrency(totalInc)}</td>
                <td className="py-2.5 px-4 text-right">
                  <Badge variant="outline" className="text-[10px] px-2 py-0.5 border-none bg-emerald-500/15 text-emerald-700 font-semibold">
                    Revenue
                  </Badge>
                </td>
              </tr>
              <tr className="hover:bg-slate-50/50 transition-colors">
                <td className="py-2.5 px-4 font-medium text-slate-800">Total Expenses</td>
                <td className="py-2.5 px-4 text-right font-semibold text-slate-900 tabular-nums">{formatCurrency(totalExp)}</td>
                <td className="py-2.5 px-4 text-right">
                  <Badge variant="outline" className="text-[10px] px-2 py-0.5 border-none bg-amber-500/15 text-amber-700 font-semibold">
                    Operating
                  </Badge>
                </td>
              </tr>
              <tr className="bg-slate-50/80 font-semibold">
                <td className="py-2.5 px-4 font-semibold text-slate-900">Net Profit</td>
                <td className={cn("py-2.5 px-4 text-right font-semibold text-xs sm:text-sm tabular-nums", netProf >= 0 ? "text-emerald-600" : "text-rose-600")}>
                  {formatCurrency(netProf)}
                </td>
                <td className="py-2.5 px-4 text-right">
                  <Badge variant="outline" className={cn("text-[10px] px-2 py-0.5 border-none font-semibold", netProf >= 0 ? "bg-emerald-500/15 text-emerald-700" : "bg-rose-500/15 text-rose-700")}>
                    {netProf >= 0 ? "Profitable" : "Deficit"}
                  </Badge>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </ToolCardWrapper>
    )
  }

  // 6. Balance Sheet
  if (tool.name === "get_balance_sheet") {
    const bs = tool.result
    const ast = bs.assets?.total ?? 0
    const liab = bs.liabilities?.total ?? 0
    const eq = bs.equity?.total ?? 0

    return (
      <ToolCardWrapper title="Balance Sheet Overview" icon={BarChart3}>
        <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white/90 shadow-2xs">
          <table className="w-full text-left text-xs border-collapse font-sans">
            <thead>
              <tr className="border-b border-slate-200/80 bg-slate-100/70 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-4 font-semibold">Classification</th>
                <th className="py-2.5 px-4 text-right font-semibold">Total Amount</th>
                <th className="py-2.5 px-4 text-right font-semibold">Section</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr className="hover:bg-slate-50/50 transition-colors">
                <td className="py-2.5 px-4 font-medium text-slate-800">Total Assets</td>
                <td className="py-2.5 px-4 text-right font-semibold text-slate-900 tabular-nums">{formatCurrency(ast)}</td>
                <td className="py-2.5 px-4 text-right">
                  <Badge variant="outline" className="text-[10px] px-2 py-0.5 border-none bg-blue-500/15 text-blue-700 font-semibold">
                    Assets
                  </Badge>
                </td>
              </tr>
              <tr className="hover:bg-slate-50/50 transition-colors">
                <td className="py-2.5 px-4 font-medium text-slate-800">Total Liabilities</td>
                <td className="py-2.5 px-4 text-right font-semibold text-slate-900 tabular-nums">{formatCurrency(liab)}</td>
                <td className="py-2.5 px-4 text-right">
                  <Badge variant="outline" className="text-[10px] px-2 py-0.5 border-none bg-amber-500/15 text-amber-700 font-semibold">
                    Liabilities
                  </Badge>
                </td>
              </tr>
              <tr className="hover:bg-slate-50/50 transition-colors">
                <td className="py-2.5 px-4 font-medium text-slate-800">Total Equity</td>
                <td className="py-2.5 px-4 text-right font-semibold text-slate-900 tabular-nums">{formatCurrency(eq)}</td>
                <td className="py-2.5 px-4 text-right">
                  <Badge variant="outline" className="text-[10px] px-2 py-0.5 border-none bg-purple-500/15 text-purple-700 font-semibold">
                    Equity
                  </Badge>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </ToolCardWrapper>
    )
  }

  // 7. Trial Balance
  if (tool.name === "get_trial_balance") {
    const tb = tool.result
    const deb = tb.totalDebit ?? tb.total_debit ?? 0
    const cred = tb.totalCredit ?? tb.total_credit ?? 0
    const balanced = tb.balanced ?? (deb === cred)

    return (
      <ToolCardWrapper title="Trial Balance Statement" icon={BarChart3}>
        <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white/90 shadow-2xs">
          <table className="w-full text-left text-xs border-collapse font-sans">
            <thead>
              <tr className="border-b border-slate-200/80 bg-slate-100/70 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-4 font-semibold">Ledger Totals</th>
                <th className="py-2.5 px-4 text-right font-semibold">Amount</th>
                <th className="py-2.5 px-4 text-right font-semibold">State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr className="hover:bg-slate-50/50 transition-colors">
                <td className="py-2.5 px-4 font-medium text-slate-800">Total Debits</td>
                <td className="py-2.5 px-4 text-right font-semibold text-slate-900 tabular-nums">{formatCurrency(deb)}</td>
                <td className="py-2.5 px-4 text-right">
                  <Badge variant="outline" className="text-[10px] px-2 py-0.5 border-none bg-blue-500/15 text-blue-700 font-semibold">
                    Debit
                  </Badge>
                </td>
              </tr>
              <tr className="hover:bg-slate-50/50 transition-colors">
                <td className="py-2.5 px-4 font-medium text-slate-800">Total Credits</td>
                <td className="py-2.5 px-4 text-right font-semibold text-slate-900 tabular-nums">{formatCurrency(cred)}</td>
                <td className="py-2.5 px-4 text-right">
                  <Badge variant="outline" className="text-[10px] px-2 py-0.5 border-none bg-purple-500/15 text-purple-700 font-semibold">
                    Credit
                  </Badge>
                </td>
              </tr>
              <tr className="bg-slate-50/80 font-semibold">
                <td className="py-2.5 px-4 font-semibold text-slate-900">Ledger Balance</td>
                <td className={cn("py-2.5 px-4 text-right font-semibold text-xs sm:text-sm tabular-nums", balanced ? "text-emerald-600" : "text-rose-600")}>
                  {balanced ? "Balanced" : `Difference: ${formatCurrency(Math.abs(deb - cred))}`}
                </td>
                <td className="py-2.5 px-4 text-right">
                  <Badge variant="outline" className={cn("text-[10px] px-2 py-0.5 border-none font-semibold", balanced ? "bg-emerald-500/15 text-emerald-700" : "bg-rose-500/15 text-rose-700")}>
                    {balanced ? "Equal" : "Out of Balance"}
                  </Badge>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </ToolCardWrapper>
    )
  }

  // 8. Journal Entries
  if (tool.name === "get_journal_entries") {
    const entries = tool.result.journal_entries || tool.result.entries || []
    return (
      <ToolCardWrapper title={`Journal Entries (${tool.result.total || entries.length})`} icon={BookOpen}>
        {entries.length === 0 ? (
          <p className="text-slate-500 italic text-xs">No journal entries found.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white/90 shadow-2xs">
            <table className="w-full text-left text-xs border-collapse font-sans">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-100/70 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3.5 font-semibold">Voucher</th>
                  <th className="py-2.5 px-3.5 font-semibold">Remark & Date</th>
                  <th className="py-2.5 px-3.5 text-right font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {entries.map((j: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-2.5 px-3.5 font-semibold text-slate-900">{j.name}</td>
                    <td className="py-2.5 px-3.5 text-slate-600">
                      <div>{j.remark || "Journal Entry"}</div>
                      <div className="text-[10px] text-slate-400">{j.date}</div>
                    </td>
                    <td className="py-2.5 px-3.5 text-right">
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-medium">
                        {j.status || (j.submitted ? "Submitted" : "Draft")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ToolCardWrapper>
    )
  }

  // 9. Accounts Tree / List
  if (tool.name === "get_accounts") {
    const count = tool.result.total_accounts || (Array.isArray(tool.result) ? tool.result.length : 0)
    return (
      <ToolCardWrapper title={`Chart of Accounts (${count})`} icon={FolderTree}>
        <p className="text-slate-600 text-xs">Successfully retrieved hierarchical Chart of Accounts.</p>
      </ToolCardWrapper>
    )
  }

  // 10. Navigation
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

export const renderShadcnToolCard = (tool: ToolExecution) => {
  return <ShadcnToolCardComponent tool={tool} />
}
