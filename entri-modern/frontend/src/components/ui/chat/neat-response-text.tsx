import * as React from "react"
import { cn } from "@/lib/utils"

export interface NeatResponseTextProps {
  content: string
}

function parseFormattedText(text: string): React.ReactNode[] {
  // Clean raw triple asterisks or heading marks if any leftover
  const clean = text.replace(/\*\*\*/g, "").replace(/#/g, "")
  // Match bold **text**, code `text`, or italic *text*
  const regex = /(\*\*.*?\*\*|`.*?`|\*.*?\*)/g
  const parts = clean.split(regex)

  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={idx} className="font-semibold text-slate-900">
          {part.slice(2, -2)}
        </strong>
      )
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code key={idx} className="px-1.5 py-0.5 rounded bg-slate-200/80 text-slate-900 text-[12px] font-mono">
          {part.slice(1, -1)}
        </code>
      )
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return (
        <em key={idx} className="italic text-slate-800">
          {part.slice(1, -1)}
        </em>
      )
    }
    const sanitized = part.replace(/\*\*/g, "").replace(/\*/g, "")
    return <React.Fragment key={idx}>{sanitized}</React.Fragment>
  })
}

interface TableData {
  headers: string[]
  rows: string[][]
}

type ContentBlock =
  | { type: "text" | "bullet" | "number" | "header"; content: string; numStr?: string }
  | { type: "table"; data: TableData }

function parseBlocks(content: string): ContentBlock[] {
  const lines = content.split("\n")
  const blocks: ContentBlock[] = []

  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    // Check for markdown table start (starts and contains '|')
    if (trimmed.startsWith("|") && trimmed.includes("|")) {
      const tableLines: string[] = []
      while (i < lines.length && lines[i].trim().startsWith("|") && lines[i].trim().includes("|")) {
        tableLines.push(lines[i].trim())
        i++
      }

      if (tableLines.length >= 2) {
        const parseRowCells = (rowStr: string) =>
          rowStr
            .split("|")
            .map((c) => c.trim())
            .filter((c, idx, arr) => (idx === 0 || idx === arr.length - 1 ? c !== "" : true))

        const rawHeaders = parseRowCells(tableLines[0])
        
        let dataStartIndex = 1
        // Skip separator line like |---|---|
        if (tableLines[1].replace(/[\s\-\|:]/g, "") === "") {
          dataStartIndex = 2
        }

        const rows: string[][] = []
        for (let j = dataStartIndex; j < tableLines.length; j++) {
          const cells = parseRowCells(tableLines[j])
          if (cells.length > 0) {
            rows.push(cells)
          }
        }

        blocks.push({
          type: "table",
          data: {
            headers: rawHeaders,
            rows,
          },
        })
        continue
      } else {
        for (const tLine of tableLines) {
          blocks.push(parseLineToBlock(tLine))
        }
        continue
      }
    }

    if (trimmed) {
      blocks.push(parseLineToBlock(trimmed))
    } else {
      blocks.push({ type: "text", content: "" })
    }
    i++
  }

  return blocks
}

function parseLineToBlock(trimmed: string): ContentBlock {
  const isBullet = /^[-\*•]\s+/.test(trimmed)
  const isNumber = /^\d+[\.\)]\s+/.test(trimmed)
  const isHeader = /^#{1,6}\s+/.test(trimmed)

  if (isBullet) {
    return { type: "bullet", content: trimmed.replace(/^[-\*•]\s+/, "") }
  }
  if (isNumber) {
    const numMatch = trimmed.match(/^(\d+)[\.\)]\s+/)
    const numStr = numMatch ? numMatch[1] : "•"
    return { type: "number", content: trimmed.replace(/^\d+[\.\)]\s+/, ""), numStr }
  }
  if (isHeader) {
    return { type: "header", content: trimmed.replace(/^#{1,6}\s+/, "") }
  }
  return { type: "text", content: trimmed }
}

function formatJsonToEnglish(jsonStr: string): string | null {
  if (!jsonStr) return null
  const trimmed = jsonStr.trim()
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return null

  try {
    const data = JSON.parse(trimmed)
    if (typeof data !== "object" || data === null) return null

    if (data.schema_name === "JournalEntry" || data.jv_name || data.doc_name) {
      const docName = data.jv_name || data.doc_name || "Journal Entry"
      const status = data.status || "Draft"
      const amount = data.total_debit || data.total_credit || 0
      const msg = data.message || ""
      
      let formatted = `✅ **Recorded Journal Entry \`${docName}\`**\n` +
        `- **Status**: ${status}\n` +
        `- **Total Amount**: $${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

      if (data.accounts && Array.isArray(data.accounts)) {
        const accs = data.accounts.map((a: any) => {
          const name = a.account || "Account"
          if (a.debit > 0) return `${name} (Debit $${Number(a.debit).toLocaleString()})`
          if (a.credit > 0) return `${name} (Credit $${Number(a.credit).toLocaleString()})`
          return name
        }).join(", ")
        if (accs) formatted += `\n- **Accounts**: ${accs}`
      }

      if (msg) formatted += `\n\n${msg}`
      return formatted
    }

    if (data.message) {
      return `✅ ${data.message}`
    }

    if (data.error) {
      return `❌ ${data.error}`
    }

    const lines = Object.entries(data)
      .filter(([k, v]) => typeof v !== "object" && k !== "success")
      .map(([k, v]) => `- **${k.replace(/_/g, " ")}**: ${v}`)
    return lines.length > 0 ? lines.join("\n") : null
  } catch {
    return null
  }
}

export const NeatResponseText: React.FC<NeatResponseTextProps> = ({ content }) => {
  if (!content) return null

  const formattedJson = formatJsonToEnglish(content)
  const textToRender = formattedJson || content

  const blocks = parseBlocks(textToRender)

  return (
    <div className="space-y-2 text-[13.5px] leading-[1.65] text-slate-800 font-sans">
      {blocks.map((block, bIdx) => {
        if (block.type === "table") {
          const { headers, rows } = block.data
          return (
            <div key={bIdx} className="my-3 overflow-hidden rounded-2xl border-none bg-slate-200/60 shadow-2xs">
              <div className="overflow-x-auto no-scrollbar">
                <table className="w-full text-left border-collapse text-xs sm:text-[13px]">
                  {headers.length > 0 && (
                    <thead>
                      <tr className="bg-slate-300/40 text-slate-700 font-semibold border-none">
                        {headers.map((h, hIdx) => (
                          <th key={hIdx} className="px-4 py-2.5 font-semibold text-slate-700 border-none">
                            {parseFormattedText(h)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                  )}
                  <tbody>
                    {rows.map((row, rIdx) => (
                      <tr
                        key={rIdx}
                        className={cn(
                          "transition-colors border-none",
                          rIdx % 2 === 0 ? "bg-white/95" : "bg-slate-100/90",
                          "hover:bg-slate-200/50"
                        )}
                      >
                        {row.map((cell, cIdx) => (
                          <td key={cIdx} className="px-4 py-2.5 text-slate-800 border-none">
                            {parseFormattedText(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        }

        if (!block.content) {
          return <div key={bIdx} className="h-1" />
        }

        const parts = parseFormattedText(block.content)

        if (block.type === "bullet") {
          return (
            <div key={bIdx} className="flex items-start gap-2.5 ml-1 my-1">
              <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-blue-600 mt-2" />
              <div className="flex-1 min-w-0">{parts}</div>
            </div>
          )
        }

        if (block.type === "number") {
          return (
            <div key={bIdx} className="flex items-start gap-2.5 ml-1 my-1">
              <span className="shrink-0 font-semibold text-blue-600 text-xs mt-0.5">{block.numStr}.</span>
              <div className="flex-1 min-w-0">{parts}</div>
            </div>
          )
        }

        if (block.type === "header") {
          return (
            <div key={bIdx} className="font-semibold text-slate-900 text-sm mt-3 mb-1">
              {parts}
            </div>
          )
        }

        return (
          <p key={bIdx} className="leading-relaxed">
            {parts}
          </p>
        )
      })}
    </div>
  )
}
