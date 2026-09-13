import * as React from "react"
import { ArrowDown } from "lucide-react"
import { cn } from "@/lib/utils"

export interface MessageScrollerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  autoScroll?: boolean
}

export const MessageScroller = React.forwardRef<HTMLDivElement, MessageScrollerProps>(
  ({ className, children, autoScroll = true, ...props }, ref) => {
    const scrollRef = React.useRef<HTMLDivElement>(null)
    const [showScrollButton, setShowScrollButton] = React.useState(false)

    React.useImperativeHandle(ref, () => scrollRef.current as HTMLDivElement)

    const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
      if (scrollRef.current) {
        scrollRef.current.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior,
        })
      }
    }

    const handleScroll = () => {
      if (!scrollRef.current) return
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100
      setShowScrollButton(!isNearBottom)
    }

    React.useEffect(() => {
      if (autoScroll) {
        scrollToBottom("smooth")
      }
    }, [children, autoScroll])

    return (
      <div className="relative flex-1 h-full min-h-0 overflow-hidden">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className={cn("h-full w-full overflow-y-auto no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden", className)}
          {...props}
        >
          {children}
        </div>

        {showScrollButton && (
          <button
            type="button"
            onClick={() => scrollToBottom("smooth")}
            className="absolute bottom-4 right-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-background border border-border/80 text-muted-foreground shadow-md hover:text-foreground hover:bg-muted transition-all cursor-pointer animate-in fade-in zoom-in-95"
            title="Scroll to bottom"
          >
            <ArrowDown className="h-4 w-4" />
          </button>
        )}
      </div>
    )
  }
)
MessageScroller.displayName = "MessageScroller"
