import * as React from "react"
import { cn } from "@/lib/utils"
import { ArrowUp, Square, Sparkles, Plus, Paperclip, ChevronDown } from "lucide-react"

export interface ChatInputProps extends Omit<React.FormHTMLAttributes<HTMLFormElement>, "onChange" | "onSubmit"> {
  value: string
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  onSubmit: (e?: React.FormEvent) => void
  onStop?: () => void
  isLoading?: boolean
  placeholder?: string
  disabled?: boolean
  minHeight?: string
  maxHeight?: string
}

const ChatInput = React.forwardRef<HTMLTextAreaElement, ChatInputProps>(
  (
    {
      className,
      value,
      onChange,
      onSubmit,
      onStop,
      isLoading = false,
      placeholder = "Send a message...",
      disabled = false,
      minHeight = "56px",
      maxHeight = "200px",
      ...props
    },
    ref
  ) => {
    const internalRef = React.useRef<HTMLTextAreaElement | null>(null)

    React.useImperativeHandle(ref, () => internalRef.current as HTMLTextAreaElement)

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        if (value.trim() && !isLoading) {
          onSubmit(e)
        }
      }
    }

    React.useEffect(() => {
      if (internalRef.current) {
        internalRef.current.style.height = "auto"
        internalRef.current.style.height = `${Math.min(internalRef.current.scrollHeight, parseInt(maxHeight))}px`
      }
    }, [value, maxHeight])

    return (
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (value.trim() && !isLoading) {
            onSubmit(e)
          }
        }}
        className={cn(
          "relative flex flex-col w-full overflow-hidden rounded-2xl border border-border/80 bg-background/95 shadow-lg backdrop-blur-md transition-all duration-200 focus-within:border-border focus-within:ring-1 focus-within:ring-ring",
          disabled && "opacity-60 cursor-not-allowed",
          className
        )}
        {...props}
      >
        <div className="relative flex-1">
          <textarea
            ref={internalRef}
            aria-label="Send a message"
            value={value}
            onChange={onChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled || isLoading}
            rows={1}
            style={{ minHeight, maxHeight }}
            className="w-full resize-none bg-transparent px-4 pt-3.5 pb-12 text-sm text-foreground outline-none placeholder:text-muted-foreground/60 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          />
        </div>

        {/* Vercel AI Chatbot Toolbar */}
        <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between pointer-events-none">
          <div className="flex items-center gap-1.5 pointer-events-auto">
            <button
              type="button"
              className="flex items-center justify-center h-7 w-7 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              title="Add attachment"
            >
              <Plus className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-border/60 bg-muted/40 text-[11px] font-medium text-foreground hover:bg-muted/70 transition-colors cursor-pointer select-none">
              <Sparkles className="w-3 h-3 text-blue-500" />
              <span>entri-ai-2.0</span>
              <ChevronDown className="w-3 h-3 text-muted-foreground/60" />
            </div>
          </div>

          <div className="flex items-center gap-2 pointer-events-auto">
            {isLoading ? (
              <button
                type="button"
                onClick={onStop}
                className="flex items-center justify-center h-8 w-8 rounded-lg bg-muted text-foreground hover:bg-destructive/10 hover:text-destructive transition-colors cursor-pointer shadow-2xs"
                title="Stop generating"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!value.trim() || disabled}
                className={cn(
                  "flex items-center justify-center h-8 w-8 rounded-lg bg-primary text-primary-foreground transition-all duration-150 cursor-pointer shadow-2xs hover:opacity-90 active:scale-95",
                  !value.trim() && "opacity-30 cursor-not-allowed hover:opacity-30 active:scale-100"
                )}
                title="Send message"
              >
                <ArrowUp className="w-4 h-4 stroke-[2.5]" />
              </button>
            )}
          </div>
        </div>
      </form>
    )
  }
)
ChatInput.displayName = "ChatInput"

export { ChatInput }
