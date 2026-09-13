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

export const NeatResponseText: React.FC<NeatResponseTextProps> = ({ content }) => {
  if (!content) return null

  const blocks = parseBlocks(content)

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
