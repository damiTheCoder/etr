import * as React from "react"
import { FileText, X, Loader2, CheckCircle2, AlertTriangle } from "lucide-react"

interface Transaction {
  date: string
  description: string
  amount: number
  direction: "debit" | "credit"
  account: string
  account_root_type?: string
  flagged_for_review: boolean
  flag_reason?: string | null
  line_index: number
  confidence: number
  categorization_confidence?: number
}

interface DocumentPreviewProps {
  transactions: Transaction[]
  docType: string
  fileId: string
  sessionToken: string
  totalMismatch: boolean
  flaggedCount: number
  onPostComplete?: (result: any) => void
}

export const DocumentPreview: React.FC<DocumentPreviewProps> = ({
  transactions,
  docType,
  fileId,
  sessionToken,
  totalMismatch,
  flaggedCount,
  onPostComplete,
}) => {
  const [posting, setPosting] = React.useState(false)
  const [posted, setPosted] = React.useState(false)
  const [postResult, setPostResult] = React.useState<any>(null)

  const confirmedCount = transactions.filter((t) => !t.flagged_for_review).length
  const totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0)

  const handlePostAll = async () => {
    if (posting || posted) return
    setPosting(true)
    try {
      const res = await fetch("/api/ai/post-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file_id: fileId,
          session_token: sessionToken,
        }),
      })
      const data = await res.json()
      setPostResult(data)
      setPosted(true)
      onPostComplete?.(data)
    } catch (err) {
      setPostResult({ success: false, message: "Failed to post transactions." })
    } finally {
      setPosting(false)
    }
  }

  const formatAmount = (amt: number) =>
    `₦${Math.abs(amt).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`

  return (
    <div className="w-full space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
        <FileText className="w-4 h-4" />
        <span>
          {docType === "bank_statement"
            ? "Bank Statement"
            : docType === "invoice"
            ? "Invoice"
            : docType === "voucher"
            ? "Voucher"
            : "Document"}{" "}
          — {transactions.length} transactions found
        </span>
      </div>

      {/* Mismatch warning */}
      {totalMismatch && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>
            Document total does not match sum of extracted transactions. Posting is blocked until this is resolved.
          </span>
        </div>
      )}

      {/* Transaction table */}
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-100 text-slate-600">
              <th className="text-left px-3 py-2 font-medium">Date</th>
              <th className="text-left px-3 py-2 font-medium">Description</th>
              <th className="text-right px-3 py-2 font-medium">Debit</th>
              <th className="text-right px-3 py-2 font-medium">Credit</th>
              <th className="text-left px-3 py-2 font-medium">Account</th>
              <th className="text-center px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((txn, i) => (
              <tr
                key={i}
                className={`border-t border-slate-100 ${
                  txn.flagged_for_review ? "bg-amber-50" : ""
                }`}
              >
                <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
                  {txn.date || "—"}
                </td>
                <td className="px-3 py-2 text-slate-800 max-w-[200px] truncate">
                  {txn.description}
                </td>
                <td className="px-3 py-2 text-right text-slate-800 whitespace-nowrap">
                  {txn.direction === "debit" ? formatAmount(txn.amount) : "—"}
                </td>
                <td className="px-3 py-2 text-right text-slate-800 whitespace-nowrap">
                  {txn.direction === "credit" ? formatAmount(txn.amount) : "—"}
                </td>
                <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
                  {txn.account}
                </td>
                <td className="px-3 py-2 text-center">
                  {txn.flagged_for_review ? (
                    <span className="inline-flex items-center gap-1 text-amber-600" title={txn.flag_reason || ""}>
                      <AlertTriangle className="w-3 h-3" />
                      Review
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-emerald-600">
                      <CheckCircle2 className="w-3 h-3" />
                      Ready
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div className="flex items-center justify-between text-xs text-slate-500 px-1">
        <span>
          {confirmedCount} ready to post • {flaggedCount} flagged for review
        </span>
        <span>Total: {formatAmount(totalAmount)}</span>
      </div>

      {/* Actions */}
      {posted && postResult ? (
        <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700">
          <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{postResult.message || "Transactions posted successfully."}</span>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button
            onClick={handlePostAll}
            disabled={posting || totalMismatch || confirmedCount === 0}
            className="px-4 py-2 text-xs font-medium text-white bg-blue-600 border border-black rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {posting ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin" />
                Posting...
              </span>
            ) : (
              `Post ${confirmedCount} Confirmed`
            )}
          </button>
          {flaggedCount > 0 && (
            <span className="text-xs text-slate-500">
              {flaggedCount} flagged transactions will be skipped
            </span>
          )}
        </div>
      )}
    </div>
  )
}
