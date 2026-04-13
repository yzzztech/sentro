"""Tests for full agent run flows."""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from sentro.client import Sentro


def _make_sentro() -> tuple[Sentro, list[dict]]:
    """Create a Sentro instance with a mocked transport, returning (sentro, events)."""
    sentro = Sentro(dsn="http://tok@localhost:3000/api/ingest/proj_1", flush_interval=999)
    events: list[dict] = []
    sentro._transport.send = MagicMock(side_effect=lambda e: events.append(e))
    return sentro, events


class TestFullRunFlow:
    def test_correct_event_types_in_order(self) -> None:
        sentro, events = _make_sentro()
        try:
            run = sentro.start_run(agent="test-agent", goal="do stuff", model="gpt-4")

            step = run.step("Step 1")
            tool = step.tool_call("db.query", input={"sql": "SELECT 1"})
            tool.end(result={"rows": []})

            llm = step.llm_call(model="gpt-4", messages=[{"role": "user", "content": "hi"}])
            llm.end(prompt_tokens=10, completion_tokens=5, cost=0.001)

            step.end()
            run.end(status="success")

            types = [e["type"] for e in events]
            assert types == [
                "run.start",
                "step.start",
                "tool_call.start",
                "tool_call.end",
                "llm_call.start",
                "llm_call.end",
                "step.end",
                "run.end",
            ]

            # Verify camelCase field names
            run_start = events[0]
            assert "runId" in run_start
            assert run_start["agent"] == "test-agent"
            assert run_start["goal"] == "do stuff"

            step_start = events[1]
            assert "stepId" in step_start
            assert "sequenceNumber" in step_start
            assert step_start["sequenceNumber"] == 1

            tool_start = events[2]
            assert "toolCallId" in tool_start
            assert "toolName" in tool_start
            assert tool_start["toolName"] == "db.query"

            tool_end = events[3]
            assert tool_end["status"] == "success"
            assert tool_end["result"] == {"rows": []}

            llm_start = events[4]
            assert "llmCallId" in llm_start

            llm_end = events[5]
            assert llm_end["promptTokens"] == 10
            assert llm_end["completionTokens"] == 5
            assert llm_end["cost"] == 0.001

            run_end = events[7]
            assert run_end["status"] == "success"
        finally:
            sentro.shutdown()


class TestContextManagerAutoEnd:
    def test_auto_ends_on_success(self) -> None:
        sentro, events = _make_sentro()
        try:
            with sentro.trace("agent", goal="task") as run:
                with run.trace("step 1") as step:
                    pass

            types = [e["type"] for e in events]
            assert types == ["run.start", "step.start", "step.end", "run.end"]
            assert events[-1]["status"] == "success"
        finally:
            sentro.shutdown()

    def test_auto_errors_on_exception(self) -> None:
        sentro, events = _make_sentro()
        try:
            with pytest.raises(RuntimeError, match="boom"):
                with sentro.trace("agent", goal="task") as run:
                    with run.trace("step 1") as step:
                        raise RuntimeError("boom")

            types = [e["type"] for e in events]
            assert types == ["run.start", "step.start", "step.end", "run.end"]
            assert events[-1]["status"] == "failure"
            assert events[-1]["errorType"] == "RuntimeError"
            assert events[-1]["errorMessage"] == "boom"
        finally:
            sentro.shutdown()

    def test_tool_call_context_manager_auto_ends(self) -> None:
        sentro, events = _make_sentro()
        try:
            with sentro.trace("agent", goal="task") as run:
                with run.trace("step") as step:
                    with step.trace_tool_call("my.tool", input={"key": "val"}) as tool:
                        tool.set_result({"answer": 42})

            tool_end = [e for e in events if e["type"] == "tool_call.end"][0]
            assert tool_end["status"] == "success"
            assert tool_end["result"] == {"answer": 42}
        finally:
            sentro.shutdown()

    def test_tool_call_context_manager_auto_errors(self) -> None:
        sentro, events = _make_sentro()
        try:
            with pytest.raises(ValueError, match="bad input"):
                with sentro.trace("agent", goal="task") as run:
                    with run.trace("step") as step:
                        with step.trace_tool_call("my.tool") as tool:
                            raise ValueError("bad input")

            tool_end = [e for e in events if e["type"] == "tool_call.end"][0]
            assert tool_end["status"] == "error"
            assert tool_end["error"] == "bad input"
        finally:
            sentro.shutdown()


class TestCapturePrompts:
    def test_omits_messages_when_disabled(self) -> None:
        sentro, events = _make_sentro()
        try:
            run = sentro.start_run(agent="agent")
            step = run.step("step")

            llm = step.llm_call(
                model="gpt-4",
                messages=[{"role": "user", "content": "secret prompt"}],
            )
            llm.end(response="secret response", prompt_tokens=10, completion_tokens=5)
            step.end()
            run.end(status="success")

            llm_start = [e for e in events if e["type"] == "llm_call.start"][0]
            assert "messages" not in llm_start

            llm_end = [e for e in events if e["type"] == "llm_call.end"][0]
            assert "response" not in llm_end
        finally:
            sentro.shutdown()

    def test_includes_messages_when_enabled(self) -> None:
        sentro = Sentro(
            dsn="http://tok@localhost:3000/api/ingest/proj_1",
            capture_prompts=True,
            flush_interval=999,
        )
        events: list[dict] = []
        sentro._transport.send = MagicMock(side_effect=lambda e: events.append(e))
        try:
            run = sentro.start_run(agent="agent")
            step = run.step("step")

            llm = step.llm_call(
                model="gpt-4",
                messages=[{"role": "user", "content": "visible prompt"}],
            )
            llm.end(response="visible response", prompt_tokens=10, completion_tokens=5)
            step.end()
            run.end(status="success")

            llm_start = [e for e in events if e["type"] == "llm_call.start"][0]
            assert llm_start["messages"] == [{"role": "user", "content": "visible prompt"}]

            llm_end = [e for e in events if e["type"] == "llm_call.end"][0]
            assert llm_end["response"] == "visible response"
        finally:
            sentro.shutdown()
