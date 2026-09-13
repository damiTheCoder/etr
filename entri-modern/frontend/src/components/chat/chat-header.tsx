import { useState, useRef, useEffect, memo } from "react";
import { SquarePen, X, Clock, Trash2, MessageSquare, Plus } from "lucide-react";
import { AnthropicLogo } from "@/components/ui/chat/anthropic-logo";

export interface ChatSessionItem {
  id: string;
  title: string;
  createdAt: string;
  messagesCount: number;
}

export interface ChatHeaderProps {
  onNewChat?: () => void;
  onCloseModal?: () => void;
  sessions?: ChatSessionItem[];
  activeSessionId?: string | null;
  onSelectSession?: (id: string) => void;
  onDeleteSession?: (id: string) => void;
}

function PureChatHeader({
  onNewChat,
  onCloseModal,
  sessions = [],
  activeSessionId,
  onSelectSession,
  onDeleteSession,
}: ChatHeaderProps) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setHistoryOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between px-6 pt-1 select-none bg-slate-100 text-slate-900 relative">
      <div className="flex items-center gap-2.5">
        <div className="flex size-7 items-center justify-center rounded-lg bg-slate-900 text-white shadow-2xs">
          <AnthropicLogo className="size-4" />
        </div>
        <span className="font-semibold text-sm text-slate-900 tracking-tight">entri AI</span>
      </div>

      <div className="flex items-center gap-1">
        {/* History Menu Button & Popover */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setHistoryOpen(!historyOpen)}
            type="button"
            className="flex items-center justify-center size-7 rounded-lg text-slate-500 hover:bg-slate-200/80 hover:text-slate-900 transition-colors cursor-pointer"
            title="Chat History"
          >
            <Clock className="size-4" />
          </button>

          {historyOpen && (
            <div className="absolute right-0 top-9 z-50 w-72 rounded-xl border border-slate-200 bg-white p-2 shadow-xl animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between px-2 py-1.5 mb-1 border-b border-slate-100">
                <span className="font-semibold text-xs text-slate-700">Chat History</span>
                <button
                  type="button"
                  onClick={() => {
                    onNewChat?.();
                    setHistoryOpen(false);
                  }}
                  className="flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-700 cursor-pointer"
                >
                  <Plus className="w-3 h-3" /> New Chat
                </button>
              </div>

              <div className="max-h-60 overflow-y-auto space-y-0.5 no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                {sessions.length === 0 ? (
                  <p className="text-xs text-slate-400 p-3 text-center italic">No past conversations</p>
                ) : (
                  sessions.map((s) => (
                    <div
                      key={s.id}
                      className={`group flex items-center justify-between rounded-lg px-2.5 py-2 text-xs transition-colors cursor-pointer ${
                        s.id === activeSessionId
                          ? "bg-blue-50 text-blue-700 font-medium"
                          : "text-slate-700 hover:bg-slate-100"
                      }`}
                      onClick={() => {
                        onSelectSession?.(s.id);
                        setHistoryOpen(false);
                      }}
                    >
                      <div className="flex items-center gap-2 min-w-0 pr-2">
                        <MessageSquare className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{s.title || "Untitled Chat"}</span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteSession?.(s.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-500 p-0.5 transition-opacity"
                        title="Delete chat"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {onNewChat && (
          <button
            onClick={onNewChat}
            type="button"
            className="flex items-center justify-center size-7 rounded-lg text-slate-500 hover:bg-slate-200/80 hover:text-slate-900 transition-colors cursor-pointer"
            title="New Chat"
          >
            <SquarePen className="size-4" />
          </button>
        )}

        {onCloseModal && (
          <button
            onClick={onCloseModal}
            type="button"
            className="flex items-center justify-center size-7 rounded-lg text-slate-500 hover:bg-slate-200/80 hover:text-slate-900 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="size-4" />
          </button>
        )}
      </div>
    </header>
  );
}

export const ChatHeader = memo(PureChatHeader);
