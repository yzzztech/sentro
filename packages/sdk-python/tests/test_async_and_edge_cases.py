"""Tests for async context managers and edge cases to round out coverage."""

from __future__ import annotations

import asyncio
import urllib.error
from unittest.mock import MagicMock, patch

import pytest

from sentro.client import Sentro


def _run(coro):
    """Run an async coroutine from a sync test function."""
    return asyncio.run(coro)


class TestRunAsyncContext:
    def test_async_context_manager_success(self) -> None:
        sentro = Sentro(dsn="http://tok@localhost:3000/api/ingest/proj_1", flush_interval=999)
        try:
            events: list = []
            sentro._transport.send = MagicMock(side_effect=lambda e: events.append(e))

            async def do_work() -> None:
                async with sentro.trace("agent-a", goal="async success") as run:
                    assert run is not None

            _run(do_work())

            types = [e["type"] for e in events]
            assert "run.start" in types
            assert "run.end" in types
            end_event = next(e for e in events if e["type"] == "run.end")
            assert end_event["status"] == "success"
            assert end_event["errorType"] is None
            assert end_event["errorMessage"] is None
        finally:
            sentro.shutdown()

    def test_async_context_manager_exception(self) -> None:
        sentro = Sentro(dsn="http://tok@localhost:3000/api/ingest/proj_1", flush_interval=999)
        try:
            events: list = []
            sentro._transport.send = MagicMock(side_effect=lambda e: events.append(e))

            async def do_work() -> None:
                async with sentro.trace("agent-b", goal="async failure"):
                    raise ValueError("boom")

            with pytest.raises(ValueError, match="boom"):
                _run(do_work())

            end_event = next(e for e in events if e["type"] == "run.end")
            assert end_event["status"] == "failure"
            assert end_event["errorType"] == "ValueError"
            assert end_event["errorMessage"] == "boom"
        finally:
            sentro.shutdown()

    def test_end_twice_is_noop(self) -> None:
        sentro = Sentro(dsn="http://tok@localhost:3000/api/ingest/proj_1", flush_interval=999)
        try:
            events: list = []
            sentro._transport.send = MagicMock(side_effect=lambda e: events.append(e))

            run = sentro.start_run("agent-c")
            run.end()
            run.end()  # second call should be a noop
            run.end(status="failure")  # even with different status

            end_events = [e for e in events if e["type"] == "run.end"]
            assert len(end_events) == 1
            assert end_events[0]["status"] == "success"
        finally:
            sentro.shutdown()


class TestStepAsyncContext:
    def test_step_async_context_manager(self) -> None:
        sentro = Sentro(dsn="http://tok@localhost:3000/api/ingest/proj_1", flush_interval=999)
        try:
            events: list = []
            sentro._transport.send = MagicMock(side_effect=lambda e: events.append(e))

            async def do_work() -> None:
                run = sentro.start_run("agent-d")
                async with run.trace("thinking") as step:
                    assert step is not None
                run.end()

            _run(do_work())

            types = [e["type"] for e in events]
            assert "step.start" in types
            assert "step.end" in types
        finally:
            sentro.shutdown()


class TestToolCallAsyncContext:
    def test_tool_call_async_context_success(self) -> None:
        sentro = Sentro(dsn="http://tok@localhost:3000/api/ingest/proj_1", flush_interval=999)
        try:
            events: list = []
            sentro._transport.send = MagicMock(side_effect=lambda e: events.append(e))

            async def do_work() -> None:
                run = sentro.start_run("agent-e")
                step = run.step("call tool")
                async with step.trace_tool_call("search", input={"q": "hi"}) as tc:
                    tc.set_result({"hits": 3})
                step.end()
                run.end()

            _run(do_work())

            tool_end = next(e for e in events if e["type"] == "tool_call.end")
            assert tool_end["status"] == "success"
            assert tool_end["result"] == {"hits": 3}
            assert tool_end["error"] is None
        finally:
            sentro.shutdown()

    def test_tool_call_async_context_exception(self) -> None:
        sentro = Sentro(dsn="http://tok@localhost:3000/api/ingest/proj_1", flush_interval=999)
        try:
            events: list = []
            sentro._transport.send = MagicMock(side_effect=lambda e: events.append(e))

            async def do_work() -> None:
                run = sentro.start_run("agent-f")
                step = run.step("call tool")
                async with step.trace_tool_call("search"):
                    raise RuntimeError("tool exploded")

            with pytest.raises(RuntimeError, match="tool exploded"):
                _run(do_work())

            tool_end = next(e for e in events if e["type"] == "tool_call.end")
            assert tool_end["status"] == "error"
            assert tool_end["error"] == "tool exploded"
            assert tool_end["result"] is None
        finally:
            sentro.shutdown()


class TestTransportEdgeCases:
    def test_start_timer_after_shutdown_is_noop(self) -> None:
        sentro = Sentro(dsn="http://tok@localhost:3000/api/ingest/proj_1", flush_interval=999)
        transport = sentro._transport

        transport.shutdown()
        assert transport._shutdown_flag is True
        assert transport._timer is None

        # Calling _start_timer() directly after shutdown should be a noop
        transport._start_timer()
        assert transport._timer is None

    def test_atexit_flush_calls_shutdown(self) -> None:
        sentro = Sentro(dsn="http://tok@localhost:3000/api/ingest/proj_1", flush_interval=999)
        transport = sentro._transport
        assert transport._shutdown_flag is False

        transport._atexit_flush()

        assert transport._shutdown_flag is True
        assert transport._timer is None


class TestScoreErrors:
    def test_score_swallows_http_errors(self) -> None:
        sentro = Sentro(dsn="http://tok@localhost:3000/api/ingest/proj_1", flush_interval=999)
        try:
            with patch(
                "urllib.request.urlopen",
                side_effect=urllib.error.URLError("connection refused"),
            ):
                # Must not raise -- fire-and-forget
                sentro.score("run-123", "accuracy", 0.9, comment="ok")
        finally:
            sentro.shutdown()

    def test_score_swallows_generic_exception(self) -> None:
        sentro = Sentro(dsn="http://tok@localhost:3000/api/ingest/proj_1", flush_interval=999)
        try:
            with patch(
                "urllib.request.urlopen",
                side_effect=RuntimeError("kaboom"),
            ):
                sentro.score("run-456", "latency", 123.0)
        finally:
            sentro.shutdown()
