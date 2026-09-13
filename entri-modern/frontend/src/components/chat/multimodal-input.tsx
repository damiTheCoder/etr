import * as React from "react"
import { CornerDownLeft, Square, Plus, ChevronDown } from "lucide-react"
import { AnthropicLogo } from "@/components/ui/chat/anthropic-logo"
import { SuggestedActions } from "./suggested-actions"
import { cn } from "@/lib/utils"

export interface MultimodalInputProps {
  input: string
  setInput: (val: string) => void
  onSubmit: (text?: string) => void
  onStop?: () => void
  isLoading?: boolean
  messagesCount?: number
  placeholder?: string
}

export const MultimodalInput: React.FC<MultimodalInputProps> = ({
  input,
  setInput,
  onSubmit,
  onStop,
  isLoading = false,
  messagesCount = 0,
  placeholder = "Send a message...",
}) => {
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null)

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      if (input.trim() && !isLoading) {
        onSubmit()
      }
    }
  }

  React.useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
    }
  }, [input])

  return (
    <div className="relative flex flex-col w-full gap-3 max-w-2xl mx-auto px-4 pb-4 pt-1">
      {messagesCount === 0 && !isLoading && (
        <SuggestedActions onSelectSuggestion={(suggestion) => onSubmit(suggestion)} />
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (input.trim() && !isLoading) {
            onSubmit()
          }
        }}
        className={cn(
          "relative flex flex-col w-full overflow-hidden rounded-2xl border-none bg-slate-200/75 shadow-none",
          "transition-all duration-150 focus-within:ring-2 focus-within:ring-blue-500/20"
        )}
      >
        <div className="relative flex-1">
          <textarea
            ref={textareaRef}
            aria-label="Send a message"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={isLoading}
            rows={1}
            style={{ minHeight: "56px", maxHeight: "200px" }}
            className="w-full resize-none bg-transparent px-4 pt-3.5 pb-12 text-[13px] leading-[1.65] text-slate-900 outline-none border-none placeholder:text-slate-500/70 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          />
        </div>

        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between pointer-events-none">
          <div className="flex items-center gap-1.5 pointer-events-auto">
            <button
              type="button"
              className="flex items-center justify-center h-7 w-7 rounded-lg text-slate-500 hover:bg-slate-300/60 hover:text-slate-900 transition-colors cursor-pointer"
              title="Add attachment"
            >
              <Plus className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/90 shadow-2xs text-[11px] font-medium text-slate-800 hover:bg-white transition-colors cursor-pointer select-none">
              <AnthropicLogo className="w-3 h-3 text-slate-900" />
              <span>entri-ai-2.0</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </div>
          </div>

          <div className="flex items-center gap-2 pointer-events-auto">
            {isLoading ? (
              <button
                type="button"
                onClick={onStop}
                className="flex items-center justify-center h-8 w-8 rounded-lg bg-slate-200 text-slate-900 hover:bg-red-500/20 hover:text-red-600 transition-colors cursor-pointer"
                title="Stop generating"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                className="flex items-center justify-center h-8 w-8 rounded-lg bg-blue-600 text-white disabled:opacity-25 transition-all duration-150 cursor-pointer hover:bg-blue-700 active:scale-95 disabled:hover:opacity-25 disabled:active:scale-100 shadow-xs"
                title="Send message"
              >
                <CornerDownLeft className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  )
}
