import * as React from "react"
import { cn } from "@/lib/utils"
import { Copy, Check, RefreshCw, ThumbsUp, ThumbsDown } from "lucide-react"
import { AnthropicLogo } from "./anthropic-logo"

export interface ChatBubbleProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "user" | "assistant"
}

const ChatBubble = React.forwardRef<HTMLDivElement, ChatBubbleProps>(
  ({ className, variant = "assistant", children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "group/message w-full",
          variant === "user"
            ? "flex flex-col items-end gap-2 animate-[fade-up_0.25s_cubic-bezier(0.22,1,0.36,1)]"
            : "flex items-start gap-3",
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)
ChatBubble.displayName = "ChatBubble"

export interface ChatBubbleAvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "user" | "assistant"
}

const ChatBubbleAvatar = React.forwardRef<HTMLDivElement, ChatBubbleAvatarProps>(
  ({ className, variant = "assistant", ...props }, ref) => {
    if (variant === "user") return null

    return (
      <div
        ref={ref}
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-full overflow-hidden border border-slate-200/80 shadow-2xs mt-0.5 bg-transparent",
          className
        )}
        {...props}
      >
        <img
          src="/logo.png"
          alt="AI Reply Logo"
          className="size-full rounded-full object-cover filter grayscale contrast-200"
        />
      </div>
    )
  }
)
ChatBubbleAvatar.displayName = "ChatBubbleAvatar"

export interface ChatBubbleMessageProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "user" | "assistant"
  isLoading?: boolean
}

const ChatBubbleMessage = React.forwardRef<HTMLDivElement, ChatBubbleMessageProps>(
  ({ className, variant = "assistant", isLoading, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "text-[13px] leading-[1.65]",
          variant === "user"
            ? "w-fit max-w-[min(80%,56ch)] overflow-hidden break-words rounded-2xl rounded-br-lg border border-blue-600/20 bg-blue-600 text-white px-3.5 py-2 shadow-2xs"
            : "min-w-0 max-w-full text-slate-900",
          isLoading && "flex items-center gap-2 text-slate-500",
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)
ChatBubbleMessage.displayName = "ChatBubbleMessage"

export interface ChatBubbleActionsProps extends React.HTMLAttributes<HTMLDivElement> {
  contentToCopy?: string
  onRegenerate?: () => void
}

const ChatBubbleActions = React.forwardRef<HTMLDivElement, ChatBubbleActionsProps>(
  ({ className, contentToCopy, onRegenerate, ...props }, ref) => {
    const [copied, setCopied] = React.useState(false)
    const [liked, setLiked] = React.useState<boolean | null>(null)

    const handleCopy = () => {
      if (!contentToCopy) return
      navigator.clipboard.writeText(contentToCopy)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }

    return (
      <div
        ref={ref}
        className={cn(
          "flex items-center gap-1 text-muted-foreground/70 opacity-0 transition-opacity duration-200 group-hover/message:opacity-100",
          className
        )}
        {...props}
      >
        {contentToCopy && (
          <button
            onClick={handleCopy}
            type="button"
            className="p-1 rounded-md hover:bg-muted hover:text-foreground transition-colors"
            title="Copy response"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        )}
        <button
          onClick={() => setLiked(liked === true ? null : true)}
          type="button"
          className={cn("p-1 rounded-md hover:bg-muted hover:text-foreground transition-colors", liked === true && "text-emerald-500")}
          title="Good response"
        >
          <ThumbsUp className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setLiked(liked === false ? null : false)}
          type="button"
          className={cn("p-1 rounded-md hover:bg-muted hover:text-foreground transition-colors", liked === false && "text-rose-500")}
          title="Bad response"
        >
          <ThumbsDown className="w-3.5 h-3.5" />
        </button>
        {onRegenerate && (
          <button
            onClick={onRegenerate}
            type="button"
            className="p-1 rounded-md hover:bg-muted hover:text-foreground transition-colors"
            title="Regenerate"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    )
  }
)
ChatBubbleActions.displayName = "ChatBubbleActions"

const ChatBubbleTimestamp = ({ className, children, ...props }: React.HTMLAttributes<HTMLSpanElement>) => (
  <span className={cn("text-[10px] text-muted-foreground/40 select-none font-normal", className)} {...props}>
    {children}
  </span>
)

export { ChatBubble, ChatBubbleAvatar, ChatBubbleMessage, ChatBubbleActions, ChatBubbleTimestamp }
