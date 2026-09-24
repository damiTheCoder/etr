import React, { useState, useEffect, useRef } from "react"
import { ChevronDown, ChevronRight, CheckCircle2, Loader2, Circle, Wrench, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

export interface TodoItem {
  id: string
  label: string
  status: "pending" | "in_progress" | "completed"
}

export interface ToolCallItem {
  name: string
  args?: Record<string, any>
  status?: "running" | "completed" | "error"
  summary?: string
}

export interface ReasoningPanelProps {
  messageId?: string
  isStreaming: boolean
  reasoningText: string
  todos: TodoItem[]
  toolCalls: ToolCallItem[]
  defaultExpanded?: boolean
  autoCollapseDelayMs?: number
}

export function formatToolSummary(tool: ToolCallItem): string {
  if (tool.summary) {
    return tool.summary.length > 60 ? tool.summary.slice(0, 57) + "..." : tool.summary
  }
  const name = tool.name.replace(/_/g, " ")
  const formattedName = name.charAt(0).toUpperCase() + name.slice(1)
  if (!tool.args || Object.keys(tool.args).length === 0) {
    return formattedName
  }
  const firstVal = Object.values(tool.args).find((v) => v !== undefined && v !== null && typeof v !== "object")
  const summary = firstVal ? `${formattedName} · ${String(firstVal)}` : formattedName
  return summary.length > 60 ? summary.slice(0, 57) + "..." : summary
}

export const ReasoningPanel: React.FC<ReasoningPanelProps> = ({
  messageId,
  isStreaming,
  reasoningText,
  todos = [],
  toolCalls = [],
  defaultExpanded,
  autoCollapseDelayMs = 1000,
}) => {
  // If no reasoning, no todos, and no tool calls, do not render panel
  const hasContent = Boolean(
    (reasoningText && reasoningText.trim().length > 0) ||
    (todos && todos.length > 0) ||
    (toolCalls && toolCalls.length > 0)
  )

  if (!hasContent) {
    return null
  }

  const storageKey = messageId ? `reasoning_collapsed_${messageId}` : null

  // Determine initial expanded state:
  // 1. Check localStorage for persistent user preference
  // 2. Default to collapsed on mobile (< 768px)
  // 3. Otherwise defaultExpanded or isStreaming
  const [isExpanded, setIsExpanded] = useState<boolean>(() => {
    if (storageKey && typeof window !== "undefined") {
      const saved = localStorage.getItem(storageKey)
      if (saved !== null) {
        return saved === "false"
      }
    }
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      return false
    }
    return defaultExpanded ?? isStreaming
  })

  const prevStreamingRef = useRef(isStreaming)
  const collapseTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Auto-expand during streaming, auto-collapse after done
  useEffect(() => {
    // Transition from streaming to finished -> auto collapse after delay
    if (prevStreamingRef.current && !isStreaming) {
      collapseTimeoutRef.current = setTimeout(() => {
        setIsExpanded(false)
        if (storageKey) {
          localStorage.setItem(storageKey, "true")
        }
      }, autoCollapseDelayMs)
    } else if (!prevStreamingRef.current && isStreaming) {
      // New stream started -> expand unless mobile
      if (collapseTimeoutRef.current) {
        clearTimeout(collapseTimeoutRef.current)
      }
      if (typeof window === "undefined" || window.innerWidth >= 768) {
        setIsExpanded(true)
      }
    }
    prevStreamingRef.current = isStreaming

    return () => {
      if (collapseTimeoutRef.current) {
        clearTimeout(collapseTimeoutRef.current)
      }
    }
  }, [isStreaming, autoCollapseDelayMs, storageKey])

  const toggleExpanded = () => {
    if (collapseTimeoutRef.current) {
      clearTimeout(collapseTimeoutRef.current)
    }
    const nextState = !isExpanded
    setIsExpanded(nextState)
    if (storageKey) {
      localStorage.setItem(storageKey, String(!nextState))
    }
  }

  const completedTodosCount = todos.filter((t) => t.status === "completed").length

  return (
    <div
      data-testid="reasoning-panel"
      className="mb-3 rounded-lg border border-slate-200/80 bg-slate-50/60 overflow-hidden shadow-xs transition-all text-xs"
    >
      {/* Header */}
      <button
        type="button"
        data-testid="reasoning-header"
        onClick={toggleExpanded}
        className="w-full flex items-center justify-between px-3 py-2 bg-slate-100/70 hover:bg-slate-100 text-slate-700 font-medium transition-colors cursor-pointer select-none"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-slate-500 transition-transform" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-slate-500 transition-transform" />
          )}
          <span className="flex items-center gap-1.5 font-semibold text-slate-800">
            <Sparkles className="w-3 h-3 text-sky-500" />
            Reasoning
          </span>

          {/* Status Badge */}
          {isStreaming ? (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-sky-100 text-sky-700 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-ping" />
              Thinking...
            </span>
          ) : todos.length > 0 ? (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-200/80 text-slate-600">
              To-dos · {completedTodosCount}/{todos.length}
            </span>
          ) : null}
        </div>

        {/* Right side tool indicator */}
        {toolCalls.length > 0 && (
          <span className="text-[11px] text-slate-500 flex items-center gap-1">
            <Wrench className="w-2.5 h-2.5" />
            {toolCalls.length} tool{toolCalls.length === 1 ? "" : "s"}
          </span>
        )}
      </button>

      {/* Collapsible Content */}
      {isExpanded && (
        <div data-testid="reasoning-body" className="p-3 flex flex-col gap-3 divide-y divide-slate-200/60 bg-white/70">
          {/* Sub-section 1: To-dos Checklist */}
          {todos.length > 0 && (
            <div data-testid="todos-list" className="flex flex-col gap-1.5 pb-2">
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Planned Steps
              </div>
              <div className="flex flex-col gap-1">
                {todos.map((todo) => {
                  const isDone = todo.status === "completed"
                  const inProgress = todo.status === "in_progress"
                  return (
                    <div
                      key={todo.id}
                      data-testid={`todo-item-${todo.id}`}
                      className="flex items-center gap-2 text-slate-700"
                    >
                      {isDone ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      ) : inProgress ? (
                        <Loader2 className="w-3.5 h-3.5 text-sky-600 animate-spin shrink-0" />
                      ) : (
                        <Circle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      )}
                      <span className={cn(isDone && "text-slate-600", inProgress && "font-medium text-sky-900")}>
                        {todo.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Sub-section 2: Reasoning Text (Streaming & Dimmed) */}
          {reasoningText && reasoningText.trim().length > 0 && (
            <div data-testid="reasoning-text-block" className="pt-2">
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Thought Process
              </div>
              <div className="font-mono text-[11px] leading-relaxed text-slate-600 opacity-60 bg-slate-50 p-2.5 rounded-md border border-slate-200/60 whitespace-pre-wrap break-words max-h-48 overflow-y-auto">
                {reasoningText}
              </div>
            </div>
          )}

          {/* Sub-section 3: Tool Calls Logs */}
          {toolCalls.length > 0 && (
            <div data-testid="tool-calls-list" className="pt-2 flex flex-col gap-1.5">
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Tools Executed
              </div>
              <div className="flex flex-col gap-1">
                {toolCalls.map((tool, idx) => {
                  const isRunning = tool.status === "running"
                  const summaryText = formatToolSummary(tool)
                  return (
                    <div
                      key={idx}
                      data-testid={`tool-call-${idx}`}
                      className="flex items-center justify-between gap-2 px-2 py-1 rounded bg-slate-50 border border-slate-200/50 text-[11px]"
                    >
                      <div className="flex items-center gap-1.5 font-medium text-slate-700 truncate">
                        <Wrench className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">{summaryText}</span>
                      </div>
                      {isRunning ? (
                        <span className="flex items-center gap-1 text-[10px] text-sky-600 shrink-0 font-medium">
                          <Loader2 className="w-2.5 h-2.5 animate-spin" /> running
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] text-emerald-600 shrink-0 font-medium">
                          <CheckCircle2 className="w-2.5 h-2.5" /> done
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
