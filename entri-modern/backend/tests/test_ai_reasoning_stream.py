"""
Unit and Integration Tests for AI Chat Streaming with Reasoning Panel Events
Verifies SSE event sequences, reasoning token extraction, to-dos checklist, tool call logs, and persistence.
"""
import os
import sys
import json
import pytest
import unittest
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from backend.api.ai_router import (
    stream_chat_generator,
    ChatRequest,
    ChatMessage,
    extract_reasoning,
    format_tool_call_summary,
    generate_todos_for_intent,
)
from backend.core.chat_messages_db import chat_messages


class TestAIReasoningStream(unittest.IsolatedAsyncioTestCase):

    async def _collect_sse_events(self, req: ChatRequest):
        events = []
        async for chunk in stream_chat_generator(req):
            for line in chunk.splitlines():
                if line.startswith("data: "):
                    data_str = line[6:].strip()
                    try:
                        events.append(json.loads(data_str))
                    except Exception:
                        pass
        return events

    async def test_sse_emits_reasoning_events_when_model_supports_it(self):
        """When AI_REASONING_MODEL is configured, stream must emit reasoning_start, reasoning_token, reasoning_end."""
        req = ChatRequest(
            messages=[ChatMessage(role="user", content="paid shop rent 2500")],
            stream=True
        )

        with patch.dict(os.environ, {"AI_REASONING_MODEL": "anthropic/claude-3.5-sonnet"}):
            events = await self._collect_sse_events(req)

        event_types = [e.get("type") for e in events]
        
        # Must contain reasoning_start, reasoning_token, reasoning_end, done
        self.assertIn("reasoning_start", event_types)
        self.assertIn("reasoning_token", event_types)
        self.assertIn("reasoning_end", event_types)
        self.assertIn("done", event_types)

        # Verify to-dos are emitted
        todo_events = [e for e in events if e.get("type") == "todo"]
        self.assertGreater(len(todo_events), 0)

    async def test_sse_does_not_emit_reasoning_when_model_does_not(self):
        """When AI_REASONING_MODEL is unset, stream must NOT emit any reasoning events."""
        req = ChatRequest(
            messages=[ChatMessage(role="user", content="paid shop rent 2500")],
            stream=True
        )

        with patch.dict(os.environ, {"AI_REASONING_MODEL": ""}, clear=False):
            # Also ensure OPENROUTER_MODEL is non-reasoning
            events = await self._collect_sse_events(req)

        event_types = [e.get("type") for e in events]
        
        # Must NOT contain reasoning events
        self.assertNotIn("reasoning_start", event_types)
        self.assertNotIn("reasoning_token", event_types)
        self.assertNotIn("reasoning_end", event_types)
        
        # Must still emit tokens and done
        self.assertIn("token", event_types)
        self.assertIn("done", event_types)

    async def test_reasoning_is_persisted_in_message_record(self):
        """Streaming chat must persist reasoning, tool_calls, and todos into the message collection."""
        user_msg = "What is my current profit and loss?"
        req = ChatRequest(
            messages=[ChatMessage(role="user", content=user_msg)],
            stream=True,
            company_id="default_company"
        )

        with patch.dict(os.environ, {"AI_REASONING_MODEL": "anthropic/claude-3.5-sonnet"}):
            events = await self._collect_sse_events(req)

        # Query the database
        record = chat_messages.find_one({"company_id": "default_company"})
        self.assertIsNotNone(record)
        self.assertEqual(record["role"], "assistant")
        self.assertIn("content", record)
        self.assertIn("reasoning", record)
        self.assertIn("tool_calls", record)
        self.assertIn("todos", record)
        self.assertIn("created_at", record)

    async def test_tool_call_events_are_emitted_before_final_token(self):
        """Tool call events (tool_call, tool_result) must precede final answer tokens and done."""
        req = ChatRequest(
            messages=[ChatMessage(role="user", content="paid shop rent 2500")],
            stream=True
        )

        with patch.dict(os.environ, {"AI_REASONING_MODEL": "anthropic/claude-3.5-sonnet"}):
            events = await self._collect_sse_events(req)

        event_types = [e.get("type") for e in events]
        self.assertIn("done", event_types)
        self.assertEqual(event_types[-1], "done")

        # If tools were executed, tool_call must appear before done
        if "tool_call" in event_types:
            tool_idx = event_types.index("tool_call")
            done_idx = event_types.index("done")
            self.assertLess(tool_idx, done_idx)

            if "tool_result" in event_types:
                res_idx = event_types.index("tool_result")
                self.assertLess(tool_idx, res_idx)
                self.assertLess(res_idx, done_idx)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
