import React, { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { Message } from "@/components/ui/chat"
import { ChatHeader, ChatSessionItem } from "@/components/chat/chat-header"
import { Messages } from "@/components/chat/messages"
import { MultimodalInput } from "@/components/chat/multimodal-input"
import { DocumentPreview } from "@/components/chat/document-preview"

export interface AIChatProps {
  onCloseModal?: () => void
  onExpand?: () => void
  isExpanded?: boolean
}

export interface StoredSession {
  id: string
  title: string
  createdAt: string
  messages: Message[]
}

const STORAGE_KEY_SESSIONS = "entri_ai_sessions_v2"
const STORAGE_KEY_ACTIVE = "entri_ai_active_session_v2"

export default function AIChat({ onCloseModal, onExpand, isExpanded }: AIChatProps) {
  const navigate = useNavigate()

  // Load sessions from localStorage
  const [sessions, setSessions] = useState<StoredSession[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_SESSIONS)
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch (e) {
        /* ignore */
      }
    }
    // Migration fallback from old single messages list
    const legacyMessages = localStorage.getItem("entri_ai_messages")
    if (legacyMessages) {
      try {
        const parsed = JSON.parse(legacyMessages)
        if (Array.isArray(parsed) && parsed.length > 0) {
          const firstUserMsg = parsed.find((m: Message) => m.role === "user")
          const title = firstUserMsg ? firstUserMsg.content.slice(0, 30) : "Previous Chat"
          const legacySession: StoredSession = {
            id: Date.now().toString(),
            title,
            createdAt: new Date().toLocaleDateString(),
            messages: parsed,
          }
          return [legacySession]
        }
      } catch (e) {
        /* ignore */
      }
    }
    return []
  })

  // Load active session ID
  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => {
    const savedActive = localStorage.getItem(STORAGE_KEY_ACTIVE)
    if (savedActive) return savedActive
    return sessions.length > 0 ? sessions[0].id : null
  })

  // Active session messages
  const activeSession = sessions.find((s) => s.id === activeSessionId)
  const messages: Message[] = activeSession ? activeSession.messages : []

  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Save sessions to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(sessions))
  }, [sessions])

  // Save active session ID to localStorage
  useEffect(() => {
    if (activeSessionId) {
      localStorage.setItem(STORAGE_KEY_ACTIVE, activeSessionId)
    } else {
      localStorage.removeItem(STORAGE_KEY_ACTIVE)
    }
  }, [activeSessionId])

  const handleNewChat = () => {
    setActiveSessionId(null)
    setInput("")
  }

  const handleSelectSession = (id: string) => {
    setActiveSessionId(id)
  }

  const handleDeleteSession = (id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id))
    if (activeSessionId === id) {
      setActiveSessionId(null)
    }
  }

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setLoading(false)
  }

  const updateActiveSessionMessages = (
    updater: (prevMessages: Message[]) => Message[],
    firstUserPromptText?: string
  ) => {
    setSessions((prevSessions) => {
      let currentId = activeSessionId
      let sessionExists = prevSessions.some((s) => s.id === currentId)

      if (!currentId || !sessionExists) {
        // Create new session
        const newId = Date.now().toString()
        const title = firstUserPromptText ? firstUserPromptText.slice(0, 32) : "New Chat"
        const newSession: StoredSession = {
          id: newId,
          title: title.length >= 32 ? title + "..." : title,
          createdAt: new Date().toLocaleDateString(),
          messages: updater([]),
        }
        setActiveSessionId(newId)
        return [newSession, ...prevSessions]
      }

      return prevSessions.map((s) => {
        if (s.id === currentId) {
          const updatedMessages = updater(s.messages)
          // If title was default or empty, give it a title based on prompt
          let newTitle = s.title
          if ((!s.title || s.title === "New Chat" || s.title === "Untitled Chat") && firstUserPromptText) {
            newTitle = firstUserPromptText.slice(0, 32)
            if (firstUserPromptText.length > 32) newTitle += "..."
          }
          return {
            ...s,
            title: newTitle,
            messages: updatedMessages,
          }
        }
        return s
      })
    })
  }

  const handleSend = async (promptText?: string) => {
    const textToSend = promptText || input
    if (!textToSend.trim() && !pendingFile) return
    if (loading) return

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: pendingFile
        ? `📎 ${pendingFile.name}${textToSend.trim() ? `\n${textToSend}` : ""}`
        : textToSend,
      createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    }

    const currentMessages = activeSession ? activeSession.messages : []
    const newMessages = [...currentMessages, userMsg]

    updateActiveSessionMessages(() => newMessages, textToSend || pendingFile?.name || "Document Upload")

    if (!promptText) {
      setInput("")
    }
    setLoading(true)

    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      // --- Document upload flow ---
      if (pendingFile) {
        const fileToUpload = pendingFile
        setPendingFile(null)

        const formData = new FormData()
        formData.append("file", fileToUpload)

        const uploadRes = await fetch("/api/ai/upload-document", {
          method: "POST",
          signal: controller.signal,
          body: formData,
        })

        if (!uploadRes.ok) {
          const errData = await uploadRes.json().catch(() => ({ detail: "Upload failed" }))
          throw new Error(errData.detail || `Upload failed (${uploadRes.status})`)
        }

        const uploadData = await uploadRes.json()

        if (!uploadData.success) {
          throw new Error(uploadData.error || "Document processing failed")
        }

        // Build a rich message with DocumentPreview content info
        const txnCount = uploadData.transaction_count || 0
        const flaggedCount = uploadData.flagged_count || 0
        const docType = uploadData.doc_type || "document"

        let summary = `I've finished reading your ${docType === "bank_statement" ? "bank statement" : docType}! 📄\n\n`
        summary += `Found **${txnCount} transactions**`
        if (flaggedCount > 0) {
          summary += ` (${flaggedCount} need your review)`
        }
        summary += ".\n\n"
        if (uploadData.total_mismatch) {
          summary += "⚠️ **Warning**: The document total doesn't match the sum of extracted transactions. Please review carefully before posting.\n\n"
        }
        summary += `Use the table below to review and post the transactions to your ledger.`

        // Store document data as a JSON string in a special format the Messages component can detect
        const docPreviewData = JSON.stringify({
          _type: "document_preview",
          transactions: uploadData.transactions,
          docType: uploadData.doc_type,
          fileId: uploadData.file_id,
          sessionToken: uploadData.session_token,
          totalMismatch: uploadData.total_mismatch,
          flaggedCount: uploadData.flagged_count,
        })

        const assistantMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: summary,
          createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          documentPreview: docPreviewData,
        }

        updateActiveSessionMessages((prev) => [...prev, assistantMsg])
        return
      }

      // --- Normal chat flow ---
      const apiMessages = newMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }))

      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({ messages: apiMessages }),
      })

      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`)
      }

      const data = await response.json()

      if (data.executed_tools && Array.isArray(data.executed_tools)) {
        for (const tool of data.executed_tools) {
          if (tool.name === "navigate_to_page" && tool.result && tool.result.route) {
            setTimeout(() => {
              navigate(tool.result.route)
              if (onCloseModal) {
                onCloseModal()
              }
            }, 800)
          }
        }
      }

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.content || "",
        executedTools: data.executed_tools,
        createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      }

      updateActiveSessionMessages((prev) => [...prev, assistantMsg])
    } catch (err: any) {
      if (err.name === "AbortError") {
        const cancelMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "Response generation stopped.",
          createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        }
        updateActiveSessionMessages((prev) => [...prev, cancelMsg])
      } else {
        const errorMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: `Sorry, an error occurred while processing your request: ${err.message || err}`,
          createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        }
        updateActiveSessionMessages((prev) => [...prev, errorMsg])
      }
    } finally {
      setLoading(false)
      abortControllerRef.current = null
    }
  }

  const handleRegenerate = () => {
    if (messages.length === 0 || loading) return
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user")
    if (lastUserMsg) {
      handleSend(lastUserMsg.content)
    }
  }

  const headerSessions: ChatSessionItem[] = sessions.map((s) => ({
    id: s.id,
    title: s.title,
    createdAt: s.createdAt,
    messagesCount: s.messages.length,
  }))

  return (
    <div className="flex flex-col h-full bg-slate-100 font-sans text-slate-900 overflow-hidden">
      <ChatHeader
        onNewChat={handleNewChat}
        onCloseModal={onCloseModal}
        onExpand={onExpand}
        isExpanded={isExpanded}
        sessions={headerSessions}
        activeSessionId={activeSessionId}
        onSelectSession={handleSelectSession}
        onDeleteSession={handleDeleteSession}
      />

      <div className="flex-1 min-h-0 flex flex-col bg-slate-100">
        <Messages
          messages={messages}
          isLoading={loading}
          onRegenerate={handleRegenerate}
          onSelectSuggestion={(prompt) => handleSend(prompt)}
        />
      </div>

      <div className="shrink-0 w-full bg-slate-100">
        <MultimodalInput
          input={input}
          setInput={setInput}
          onSubmit={handleSend}
          onStop={handleStop}
          isLoading={loading}
          messagesCount={messages.length}
          pendingFile={pendingFile}
          onFileSelect={setPendingFile}
        />
      </div>
    </div>
  )
}

