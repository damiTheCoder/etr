import * as React from "react"
import { cn } from "@/lib/utils"
import { ChatBubble, ChatBubbleAvatar, ChatBubbleMessage, ChatBubbleActions, ChatBubbleTimestamp } from "./chat-bubble"
import { renderShadcnToolCard } from "./chat-tool-card"
import { MessageScroller } from "./message-scroller"
import { Marker } from "./marker"

import { NeatResponseText } from "./neat-response-text"
import { DocumentPreview } from "@/components/chat/document-preview"

export interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  executedTools?: any[]
  documentPreview?: string
  createdAt: string
}

export interface ChatMessageListProps extends React.HTMLAttributes<HTMLDivElement> {
  messages: Message[]
  isLoading?: boolean
  onRegenerate?: () => void
}

const ChatMessageList: React.FC<ChatMessageListProps> = ({
  className,
  messages,
  isLoading = false,
  onRegenerate,
  ...props
}) => {
  return (
    <MessageScroller className={cn("flex flex-col gap-8 p-4 max-w-2xl mx-auto w-full", className)} {...props}>
      {messages.map((m) => {
        const isUser = m.role === "user"

        return (
          <ChatBubble key={m.id} variant={m.role}>
            {m.role === "assistant" && <ChatBubbleAvatar variant="assistant" />}

            {isUser ? (
              <ChatBubbleMessage variant="user">
                <div className="whitespace-pre-wrap break-words">{m.content}</div>
              </ChatBubbleMessage>
            ) : (
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <ChatBubbleMessage variant="assistant">
                  <NeatResponseText content={m.content} />

                  {m.executedTools && m.executedTools.length > 0 && (
                    <div className="flex flex-col gap-2 w-full mt-1">
                      {m.executedTools.map((t, idx) => (
                        <React.Fragment key={idx}>{renderShadcnToolCard(t)}</React.Fragment>
                      ))}
                    </div>
                  )}

                  {m.documentPreview && (() => {
                    try {
                      const previewData = JSON.parse(m.documentPreview)
                      if (previewData._type === "document_preview") {
                        return (
                          <div className="mt-3 w-full">
                            <DocumentPreview
                              transactions={previewData.transactions}
                              docType={previewData.docType}
                              fileId={previewData.fileId}
                              sessionToken={previewData.sessionToken}
                              totalMismatch={previewData.totalMismatch}
                              flaggedCount={previewData.flaggedCount}
                            />
                          </div>
                        )
                      }
                    } catch { /* invalid JSON — skip */ }
                    return null
                  })()}
                </ChatBubbleMessage>

                <div className="flex items-center gap-2 px-1">
                  <ChatBubbleTimestamp>{m.createdAt}</ChatBubbleTimestamp>
                  <ChatBubbleActions contentToCopy={m.content} onRegenerate={onRegenerate} />
                </div>
              </div>
            )}
          </ChatBubble>
        )
      })}

      {isLoading && (
        <ChatBubble variant="assistant">
          <ChatBubbleAvatar variant="assistant" />
          <div className="flex flex-col gap-1">
            <Marker status="thinking" label="entri AI is analyzing financial data..." />
          </div>
        </ChatBubble>
      )}
    </MessageScroller>
  )
}

export { ChatMessageList }
