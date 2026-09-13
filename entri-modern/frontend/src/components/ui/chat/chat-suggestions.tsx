import * as React from "react"
import { cn } from "@/lib/utils"
import { Users, FileText, TrendingUp, CreditCard, BookOpen, Settings, ArrowUpRight } from "lucide-react"

export interface SuggestionItem {
  icon: React.ElementType
  title: string
  prompt: string
  subtitle?: string
}

export const defaultSuggestions: SuggestionItem[] = [
  {
    icon: FileText,
    title: "Latest Sales Invoices",
    prompt: "List latest sales invoices",
    subtitle: "Check recent sales and status",
  },
  {
    icon: TrendingUp,
    title: "Profit & Loss Statement",
    prompt: "Show profit and loss overview",
    subtitle: "View income, expenses & profit",
  },
  {
    icon: Users,
    title: "Customer Directory",
    prompt: "Show me all customers",
    subtitle: "List customer names & details",
  },
  {
    icon: CreditCard,
    title: "Payment History",
    prompt: "Show all payments",
    subtitle: "Review incoming & outgoing payments",
  },
  {
    icon: BookOpen,
    title: "Chart of Accounts",
    prompt: "Show chart of accounts",
    subtitle: "Browse asset & expense accounts",
  },
  {
    icon: Settings,
    title: "System Settings",
    prompt: "Go to Settings",
    subtitle: "Configure workspace settings",
  },
]

export interface ChatSuggestionsProps extends React.HTMLAttributes<HTMLDivElement> {
  onSelectSuggestion: (prompt: string) => void
  suggestions?: SuggestionItem[]
}

const ChatSuggestions: React.FC<ChatSuggestionsProps> = ({
  className,
  onSelectSuggestion,
  suggestions = defaultSuggestions,
  ...props
}) => {
  return (
    <div className={cn("flex flex-col items-center justify-center min-h-[380px] h-full max-w-xl mx-auto py-8 px-4 text-center select-none", className)} {...props}>
      <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
        What can I help you with today?
      </h2>
      <p className="text-xs sm:text-sm text-muted-foreground mt-2 max-w-md">
        Ask entri AI to manage invoices, fetch financial reports, review payments, or navigate your accounting workspace.
      </p>

      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full text-left">
        {suggestions.map((item, index) => {
          const Icon = item.icon
          return (
            <button
              key={index}
              onClick={() => onSelectSuggestion(item.prompt)}
              className="group relative flex flex-col justify-between rounded-xl border border-border/70 bg-card/60 p-3.5 hover:bg-card hover:border-border transition-all duration-150 cursor-pointer shadow-2xs"
            >
              <div className="flex items-center justify-between w-full mb-1">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  <span className="text-xs font-semibold text-foreground">{item.title}</span>
                </div>
                <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-foreground transition-colors" />
              </div>
              <p className="text-[11px] text-muted-foreground/80 line-clamp-1">
                "{item.prompt}"
              </p>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export { ChatSuggestions }
