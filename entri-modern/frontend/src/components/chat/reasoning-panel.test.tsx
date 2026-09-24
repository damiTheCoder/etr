// @vitest-environment jsdom
import React from "react"
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, act, cleanup } from "@testing-library/react"
import { ReasoningPanel, ToolCallItem } from "./reasoning-panel"

describe("ReasoningPanel Component", () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
  })

  afterEach(() => {
    cleanup()
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  test("test_reasoning_panel_renders_when_reasoning_present", () => {
    render(
      <ReasoningPanel
        messageId="msg-1"
        isStreaming={false}
        reasoningText="Thinking through accounting ledger entries..."
        todos={[]}
        toolCalls={[]}
        defaultExpanded={true}
      />
    )

    const panel = screen.getByTestId("reasoning-panel")
    expect(panel).not.toBeNull()
    expect(screen.getByText("Reasoning")).not.toBeNull()
    expect(screen.getByText(/Thinking through accounting ledger entries/)).not.toBeNull()
  })

  test("test_reasoning_panel_not_rendered_when_no_reasoning", () => {
    const { container } = render(
      <ReasoningPanel
        messageId="msg-2"
        isStreaming={false}
        reasoningText=""
        todos={[]}
        toolCalls={[]}
      />
    )

    expect(screen.queryByTestId("reasoning-panel")).toBeNull()
    expect(container.firstChild).toBeNull()
  })

  test("test_reasoning_panel_auto_expands_while_streaming", () => {
    render(
      <ReasoningPanel
        messageId="msg-3"
        isStreaming={true}
        reasoningText="Generating response..."
        todos={[{ id: "1", label: "Check accounts", status: "in_progress" }]}
        toolCalls={[]}
      />
    )

    expect(screen.getByTestId("reasoning-panel")).not.toBeNull()
    expect(screen.getByTestId("reasoning-body")).not.toBeNull()
    expect(screen.getByText("Thinking...")).not.toBeNull()
    expect(screen.getByText("Check accounts")).not.toBeNull()
  })

  test("test_reasoning_panel_auto_collapses_after_done", () => {
    const { rerender } = render(
      <ReasoningPanel
        messageId="msg-4"
        isStreaming={true}
        reasoningText="Thinking..."
        todos={[{ id: "1", label: "Check accounts", status: "completed" }]}
        toolCalls={[]}
        autoCollapseDelayMs={500}
      />
    )

    expect(screen.getByTestId("reasoning-body")).not.toBeNull()

    // Transition streaming -> done
    rerender(
      <ReasoningPanel
        messageId="msg-4"
        isStreaming={false}
        reasoningText="Thinking..."
        todos={[{ id: "1", label: "Check accounts", status: "completed" }]}
        toolCalls={[]}
        autoCollapseDelayMs={500}
      />
    )

    // Before timer expires, still visible
    expect(screen.getByTestId("reasoning-body")).not.toBeNull()

    // Advance timer past autoCollapseDelayMs
    act(() => {
      vi.advanceTimersByTime(600)
    })

    // Now it should be collapsed
    expect(screen.queryByTestId("reasoning-body")).toBeNull()
  })

  test("test_tool_calls_render_as_one_line_summaries", () => {
    const tools: ToolCallItem[] = [
      {
        name: "get_profit_and_loss",
        args: { company_id: "default_company" },
        status: "completed",
        summary: "Report · Profit and Loss (default_company)",
      },
      {
        name: "create_journal_entry",
        args: { user_intent: "Record Rent Expense ₦2,500" },
        status: "running",
        summary: "Ledger · Record Rent Expense ₦2,500",
      },
    ]

    render(
      <ReasoningPanel
        messageId="msg-5"
        isStreaming={false}
        reasoningText=""
        todos={[]}
        toolCalls={tools}
        defaultExpanded={true}
      />
    )

    expect(screen.getByText("Report · Profit and Loss (default_company)")).not.toBeNull()
    expect(screen.getByText("Ledger · Record Rent Expense ₦2,500")).not.toBeNull()
  })

  test("test_raw_json_is_never_rendered", () => {
    const rawArgs = {
      nested_data: { deep: true, payload: [1, 2, 3] },
      token: "secret_12345",
      id: "raw-uuid-001",
    }
    const tools: ToolCallItem[] = [
      {
        name: "navigate_to_page",
        args: rawArgs,
        status: "completed",
      },
    ]

    const { container } = render(
      <ReasoningPanel
        messageId="msg-6"
        isStreaming={false}
        reasoningText=""
        todos={[]}
        toolCalls={tools}
        defaultExpanded={true}
      />
    )

    expect(container.textContent).not.toContain('{"nested_data"')
    expect(container.textContent).not.toContain('"token"')
    expect(container.textContent).not.toContain('"secret_12345"')
    expect(container.textContent).not.toContain('"deep":true')
  })
})
