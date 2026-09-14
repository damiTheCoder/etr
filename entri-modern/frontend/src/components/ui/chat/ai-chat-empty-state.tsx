import * as React from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { AnthropicLogo } from "./anthropic-logo"

export interface PromptSuggestion {
  title: string
  prompt: string
  icon?: React.ElementType
  category?: string
}

export interface AiChatEmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string
  description?: string
  suggestions?: PromptSuggestion[]
  onSelectSuggestion: (prompt: string) => void
}

export const defaultAiSuggestions: PromptSuggestion[] = [
  { title: "Latest Sales Invoices", prompt: "List latest sales invoices" },
  { title: "Profit & Loss Statement", prompt: "Show profit and loss overview" },
  { title: "Customer Directory", prompt: "Show me all customers" },
  { title: "Payment History", prompt: "Show all payments" },
  { title: "Chart of Accounts", prompt: "Show chart of accounts" },
  { title: "Workspace Settings", prompt: "Go to Settings" },
]

const easeSpring = [0.22, 1, 0.36, 1] as const

export const AiChatEmptyState: React.FC<AiChatEmptyStateProps> = ({
  className,
  title = "How can I assist with your accounting today?",
  description = "Ask a question, post transactions, or generate financial statements.",
  suggestions = defaultAiSuggestions,
  onSelectSuggestion,
  ...props
}) => {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center min-h-[340px] h-full max-w-xl mx-auto px-4 py-8 text-center",
        className
      )}
      {...props}
    >
      <motion.div
        animate={{ opacity: 1, scale: 1 }}
        initial={{ opacity: 0, scale: 0.9 }}
        transition={{ delay: 0.2, duration: 0.4, ease: easeSpring }}
        className="mb-4 flex size-12 items-center justify-center rounded-full overflow-hidden shadow-md ring-1 ring-slate-200 bg-transparent p-0.5"
      >
        <img
          src="/logo.png"
          alt="entri AI"
          className="size-full rounded-full object-cover filter grayscale contrast-200"
        />
      </motion.div>

      <motion.h2
        animate={{ opacity: 1, y: 0 }}
        initial={{ opacity: 0, y: 10 }}
        transition={{ delay: 0.35, duration: 0.5, ease: easeSpring }}
        className="font-semibold text-2xl tracking-tight text-slate-900"
      >
        {title}
      </motion.h2>

      <motion.p
        animate={{ opacity: 1, y: 0 }}
        initial={{ opacity: 0, y: 10 }}
        transition={{ delay: 0.5, duration: 0.5, ease: easeSpring }}
        className="mt-3 text-sm text-slate-600"
      >
        {description}
      </motion.p>

      <div className="mt-8 flex w-full gap-2.5 overflow-x-auto pb-1 sm:grid sm:grid-cols-2 sm:overflow-visible">
        {suggestions.map((item, index) => (
          <motion.div
            key={index}
            animate={{ opacity: 1, y: 0 }}
            initial={{ opacity: 0, y: 16 }}
            transition={{ delay: 0.06 * index + 0.6, duration: 0.4, ease: easeSpring }}
            className="min-w-[200px] shrink-0 sm:min-w-0 sm:shrink"
          >
            <button
              type="button"
              onClick={() => onSelectSuggestion(item.prompt)}
              className={cn(
                "h-auto w-full whitespace-nowrap rounded-xl border border-slate-200/90 bg-white px-4 py-3 shadow-2xs",
                "text-left text-[12px] leading-relaxed text-slate-700 transition-all duration-200",
                "sm:whitespace-normal sm:p-4 sm:text-[13px]",
                "hover:-translate-y-0.5 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300 hover:shadow-xs cursor-pointer"
              )}
            >
              {item.prompt}
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
