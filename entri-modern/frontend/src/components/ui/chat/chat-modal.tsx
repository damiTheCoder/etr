import * as React from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog/dialog"
import AIChat from "@/pages/AIChat"

export interface ChatModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const ChatModal: React.FC<ChatModalProps> = ({ open, onOpenChange }) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl w-[96vw] sm:w-[95vw] h-[95vh] h-[95dvh] sm:h-[86vh] max-h-[96vh] sm:max-h-[820px] p-0 gap-0 overflow-hidden bg-slate-100 text-slate-900 border border-slate-300/80 shadow-2xl rounded-2xl flex flex-col">
        <DialogHeader className="sr-only">
          <DialogTitle>entri AI Assistant</DialogTitle>
          <DialogDescription>AI Financial Assistant & Accounting Automation Chat</DialogDescription>
        </DialogHeader>
        <div className="flex-1 min-h-0 h-full overflow-hidden bg-slate-100">
          <AIChat onCloseModal={() => onOpenChange(false)} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
