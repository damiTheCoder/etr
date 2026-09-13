import * as React from "react"
import { cn } from "@/lib/utils"

export interface MarkerProps extends React.HTMLAttributes<HTMLDivElement> {
  status?: "streaming" | "thinking" | "executing" | "complete"
  label?: string
}

export const Marker = React.forwardRef<HTMLDivElement, MarkerProps>(
  ({ className, status = "streaming", label = "Thinking...", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex min-h-[calc(13px*1.65)] min-w-0 items-center text-[13px] leading-[1.65] text-muted-foreground",
          className
        )}
        {...props}
      >
        <span className="font-medium whitespace-normal break-words">
          <span className="inline-block animate-pulse">{label}</span>
          <span className="inline-flex ml-1">
            <span className="inline-block w-1 h-1 rounded-full bg-current opacity-40 animate-bounce" style={{ animationDelay: "0ms", animationDuration: "1s" }} />
            <span className="inline-block w-1 h-1 rounded-full bg-current opacity-40 animate-bounce ml-0.5" style={{ animationDelay: "150ms", animationDuration: "1s" }} />
            <span className="inline-block w-1 h-1 rounded-full bg-current opacity-40 animate-bounce ml-0.5" style={{ animationDelay: "300ms", animationDuration: "1s" }} />
          </span>
        </span>
      </div>
    )
  }
)
Marker.displayName = "Marker"
