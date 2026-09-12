import React, { useState, useEffect, useRef } from 'react'
import {
  Sparkles,
  Send,
  User,
  Bot,
  FileText,
  Users,
  TrendingUp,
  PlusCircle,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
} from 'lucide-react'

interface ToolExecution {
  name: string
  arguments: any
  result: any
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  executedTools?: ToolExecution[]
  createdAt: string
}

export default function AIChat() {
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem('entri_ai_messages')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch (e) {
        /* ignore */
      }
    }
    return [
      {
        id: 'welcome',
        role: 'assistant',
        content:
          "Hello! I am **entri AI**, your natural-language accounting assistant. You can ask me to fetch customer data, check invoice statuses, review financial reports, or post new transactions.",
        createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]
  })

  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    localStorage.setItem('entri_ai_messages', JSON.stringify(messages))
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async (promptText?: string) => {
    const textToSend = promptText || input
    if (!textToSend.trim() || loading) return

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: textToSend,
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }

    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    if (!promptText) setInput('')
    setLoading(true)

    try {
      // Map to payload format expected by backend
      const apiMessages = newMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }))

      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages: apiMessages }),
      })

      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`)
      }

      const data = await response.json()

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.content || 'Action executed successfully.',
        executedTools: data.executed_tools,
        createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }

      setMessages((prev) => [...prev, assistantMsg])
    } catch (err: any) {
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Sorry, an error occurred while processing your request: ${err.message || err}`,
        createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
      setMessages((prev) => [...prev, errorMsg])
    } finally {
      setLoading(false)
    }
  }

  const clearHistory = () => {
    const initial: Message[] = [
      {
        id: 'welcome',
        role: 'assistant',
        content:
          "History cleared. How can I assist you with your accounting operations today?",
        createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]
    setMessages(initial)
    localStorage.removeItem('entri_ai_messages')
  }

  const renderToolResultCard = (tool: ToolExecution) => {
    if (!tool.result) return null

    if (tool.name === 'get_customers') {
      const customers = tool.result.customers || []
      return (
        <div className="mt-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
          <div className="flex items-center gap-2 mb-2 font-semibold text-slate-800 text-sm">
            <Users className="w-4 h-4 text-blue-600" />
            <span>Customers Found ({tool.result.total || customers.length})</span>
          </div>
          {customers.length === 0 ? (
            <p className="text-xs text-slate-500 italic">No customers found in database.</p>
          ) : (
            <div className="divide-y divide-slate-200/60 max-h-48 overflow-y-auto">
              {customers.map((c: any, idx: number) => (
                <div key={idx} className="py-1.5 flex justify-between items-center text-xs">
                  <span className="font-medium text-slate-700">{c.name}</span>
                  <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-mono">Customer</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )
    }

    if (tool.name === 'get_sales_invoices') {
      const invoices = tool.result.invoices || []
      return (
        <div className="mt-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
          <div className="flex items-center gap-2 mb-2 font-semibold text-slate-800 text-sm">
            <FileText className="w-4 h-4 text-blue-600" />
            <span>Sales Invoices ({tool.result.total || invoices.length})</span>
          </div>
          {invoices.length === 0 ? (
            <p className="text-xs text-slate-500 italic">No sales invoices found.</p>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {invoices.map((inv: any, idx: number) => (
                <div key={idx} className="p-2.5 bg-white border border-slate-200 rounded-lg flex justify-between items-center text-xs">
                  <div>
                    <div className="font-bold text-slate-800">{inv.name}</div>
                    <div className="text-slate-500">{inv.customer} &bull; {inv.date}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-slate-900">₦{(inv.grandTotal || 0).toLocaleString()}</div>
                    <span className="inline-block px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded font-semibold text-[10px]">
                      {inv.status || 'Submitted'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )
    }

    if (tool.name === 'create_sales_invoice') {
      const r = tool.result
      return (
        <div className="mt-3 p-4 bg-emerald-50/80 border border-emerald-200 rounded-xl text-xs">
          <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm mb-1">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Invoice Created Successfully</span>
          </div>
          <div className="space-y-1 text-slate-700 mt-2">
            <div><span className="font-semibold">Invoice ID:</span> {r.invoice_name}</div>
            <div><span className="font-semibold">Customer:</span> {r.customer}</div>
            <div><span className="font-semibold">Total Amount:</span> ₦{(r.grand_total || 0).toLocaleString()}</div>
          </div>
        </div>
      )
    }

    if (tool.name === 'get_dashboard_metrics') {
      const m = tool.result
      return (
        <div className="mt-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
          <div className="flex items-center gap-2 mb-2 font-semibold text-slate-800 text-sm">
            <TrendingUp className="w-4 h-4 text-blue-600" />
            <span>Profit & Loss Metrics Summary</span>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-2">
            <div className="p-2 bg-white rounded border border-slate-200 text-center">
              <div className="text-[10px] text-slate-500 uppercase font-semibold">Total Income</div>
              <div className="font-bold text-xs text-slate-800">₦{(m.income?.total || 0).toLocaleString()}</div>
            </div>
            <div className="p-2 bg-white rounded border border-slate-200 text-center">
              <div className="text-[10px] text-slate-500 uppercase font-semibold">Total Expenses</div>
              <div className="font-bold text-xs text-slate-800">₦{(m.expenses?.total || 0).toLocaleString()}</div>
            </div>
            <div className="p-2 bg-white rounded border border-slate-200 text-center">
              <div className="text-[10px] text-slate-500 uppercase font-semibold">Net Profit</div>
              <div className={`font-bold text-xs ${(m.netProfit || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                ₦{(m.netProfit || 0).toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      )
    }

    return null
  }

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
      {/* Header Bar */}
      <div className="px-6 py-4 border-b border-slate-200/80 flex items-center justify-between bg-white shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              entri AI Assistant
              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-full">
                Next N2 Pro
              </span>
            </h2>
            <p className="text-xs text-slate-500">
              Natural-language control layer for your accounting platform
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={clearHistory}
          title="Clear Chat History"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          <span>Clear</span>
        </button>
      </div>

      {/* Messages Scroll View */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/40">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex gap-3 max-w-3xl ${
              m.role === 'user' ? 'ml-auto flex-row-reverse' : ''
            }`}
          >
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
                m.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-slate-200 text-blue-600'
              }`}
            >
              {m.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>

            <div className="space-y-1">
              <div
                className={`p-4 rounded-2xl text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-blue-600 text-white rounded-tr-none'
                    : 'bg-white border border-slate-200/80 text-slate-800 rounded-tl-none shadow-sm'
                }`}
              >
                <div className="whitespace-pre-wrap">{m.content}</div>

                {/* Render Executed Tool Result Cards */}
                {m.executedTools &&
                  m.executedTools.map((t, idx) => (
                    <React.Fragment key={idx}>{renderToolResultCard(t)}</React.Fragment>
                  ))}
              </div>

              <div
                className={`text-[10px] text-slate-400 px-1 ${
                  m.role === 'user' ? 'text-right' : 'text-left'
                }`}
              >
                {m.createdAt}
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-3 max-w-xl">
            <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 text-blue-600 flex items-center justify-center shrink-0 shadow-sm">
              <Bot className="w-4 h-4" />
            </div>
            <div className="p-4 bg-white border border-slate-200/80 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2 text-xs font-medium text-slate-600">
              <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
              <span>Thinking & executing accounting tools...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Prompts */}
      <div className="px-6 py-2 bg-white border-t border-slate-100 flex gap-2 overflow-x-auto no-scrollbar shrink-0">
        <button
          type="button"
          onClick={() => handleSend('Show me all customers')}
          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200/80 text-slate-700 rounded-full text-xs font-medium shrink-0 transition-colors flex items-center gap-1.5"
        >
          <Users className="w-3.5 h-3.5 text-blue-600" />
          <span>Show all customers</span>
        </button>
        <button
          type="button"
          onClick={() => handleSend('Show latest sales invoices')}
          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200/80 text-slate-700 rounded-full text-xs font-medium shrink-0 transition-colors flex items-center gap-1.5"
        >
          <FileText className="w-3.5 h-3.5 text-blue-600" />
          <span>List sales invoices</span>
        </button>
        <button
          type="button"
          onClick={() => handleSend('Show profit and loss dashboard summary')}
          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200/80 text-slate-700 rounded-full text-xs font-medium shrink-0 transition-colors flex items-center gap-1.5"
        >
          <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
          <span>Profit & Loss overview</span>
        </button>
        <button
          type="button"
          onClick={() =>
            handleSend(
              'Create a sales invoice for Acme Corp on 2026-09-12 with item Software Consulting, qty 2, rate 50000'
            )
          }
          className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-full text-xs font-medium shrink-0 transition-colors flex items-center gap-1.5"
        >
          <PlusCircle className="w-3.5 h-3.5 text-blue-600" />
          <span>Create Sales Invoice</span>
        </button>
      </div>

      {/* Message Input Box */}
      <div className="p-4 bg-white border-t border-slate-200/80 shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSend()
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask AI to query data, create invoices, or run financial summaries..."
            className="flex-1 px-4 py-3 bg-slate-100 border border-transparent rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:border-blue-500 focus:outline-none transition-all"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="p-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl transition-colors shadow-sm shrink-0"
            aria-label="Send message"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  )
}
