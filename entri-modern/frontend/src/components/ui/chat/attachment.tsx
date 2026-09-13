import * as React from "react"
import { FileText, Image as ImageIcon, X } from "lucide-react"
import { cn } from "@/lib/utils"

export interface AttachmentProps extends React.HTMLAttributes<HTMLDivElement> {
  name: string
  size?: string
  type?: "image" | "file"
  url?: string
  onRemove?: () => void
}

export const Attachment = React.forwardRef<HTMLDivElement, AttachmentProps>(
  ({ className, name, size, type = "file", url, onRemove, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "group relative flex items-center gap-2 rounded-xl border border-border/60 bg-muted/40 px-3 py-1.5 text-xs text-foreground select-none max-w-[220px] transition-all hover:bg-muted/70",
          className
        )}
        {...props}
      >
        {type === "image" && url ? (
          <img src={url} alt={name} className="h-6 w-6 rounded-md object-cover" />
        ) : type === "image" ? (
          <ImageIcon className="h-4 w-4 text-blue-500 shrink-0" />
        ) : (
          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
        )}

        <div className="flex flex-col min-w-0 flex-1">
          <span className="truncate font-medium text-xs">{name}</span>
          {size && <span className="text-[10px] text-muted-foreground/70">{size}</span>}
        </div>

        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground transition-colors shrink-0"
            title="Remove attachment"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
    )
  }
)
Attachment.displayName = "Attachment"
