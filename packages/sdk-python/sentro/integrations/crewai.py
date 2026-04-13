"""Sentro integration for CrewAI.

Usage:
    from sentro import Sentro
    from sentro.integrations.crewai import SentroCrewListener

    sentro = Sentro(dsn="http://token@localhost:3000/api/ingest/proj_1")
    listener = SentroCrewListener(sentro)
    # listener auto-registers — just kick off your crew
"""
from __future__ import annotations
from typing import TYPE_CHECKING, Any
import time

if TYPE_CHECKING:
    from sentro import Sentro

try:
    from crewai.events import BaseEventListener
    from crewai.events import (
        ToolUsageStartedEvent,
        ToolUsageFinishedEvent,
        ToolUsageErrorEvent,
        LLMCallStartedEvent,
        LLMCallCompletedEvent,
        TaskStartedEvent,
        TaskCompletedEvent,
    )
except ImportError:
    raise ImportError(
        "CrewAI is required for this integration. "
        "Install it with: pip install crewai"
    )


class SentroCrewListener(BaseEventListener):
    """CrewAI event listener that sends traces to Sentro."""

    def __init__(self, client: "Sentro", agent_name: str = "crewai-crew"):
        self._client = client
        self._agent_name = agent_name
        self._active_runs: dict[str, Any] = {}
        self._active_steps: dict[str, Any] = {}
        self._active_tools: dict[str, Any] = {}
        self._active_llm_calls: dict[str, Any] = {}
        super().__init__()

    def setup_listeners(self, crewai_event_bus: Any) -> None:
        @crewai_event_bus.on(TaskStartedEvent)
        def on_task_started(source: Any, event: TaskStartedEvent) -> None:
            task_id = str(getattr(event, "task_id", id(event)))
            run = self._client.trace.__wrapped__(
                self._client, self._agent_name,
                goal=getattr(event, "description", "crewai-task"),
            )
            run_ctx = run.__enter__()
            self._active_runs[task_id] = (run, run_ctx)

            step = run_ctx.trace.__wrapped__(run_ctx, f"task: {task_id}")
            step_ctx = step.__enter__()
            self._active_steps[task_id] = (step, step_ctx)

        @crewai_event_bus.on(TaskCompletedEvent)
        def on_task_completed(source: Any, event: TaskCompletedEvent) -> None:
            task_id = str(getattr(event, "task_id", id(event)))
            if task_id in self._active_steps:
                step, step_ctx = self._active_steps.pop(task_id)
                step.__exit__(None, None, None)
            if task_id in self._active_runs:
                run, run_ctx = self._active_runs.pop(task_id)
                run.__exit__(None, None, None)

        @crewai_event_bus.on(ToolUsageStartedEvent)
        def on_tool_started(source: Any, event: ToolUsageStartedEvent) -> None:
            tool_id = str(id(event))
            tool_name = getattr(event, "tool_name", "unknown")
            tool_input = getattr(event, "tool_args", {})
            # Find the active step for this agent
            for task_id, (_, step_ctx) in self._active_steps.items():
                tc = step_ctx.trace_tool_call.__wrapped__(
                    step_ctx, tool_name, input=tool_input
                )
                tc_ctx = tc.__enter__()
                self._active_tools[tool_id] = (tc, tc_ctx, task_id)
                break

        @crewai_event_bus.on(ToolUsageFinishedEvent)
        def on_tool_finished(source: Any, event: ToolUsageFinishedEvent) -> None:
            tool_id = str(id(event))
            # Match by recent tool events
            for tid in list(self._active_tools.keys()):
                tc, tc_ctx, _ = self._active_tools.pop(tid)
                result = getattr(event, "result", None)
                if result is not None:
                    tc_ctx.set_result(result)
                tc.__exit__(None, None, None)
                break

        @crewai_event_bus.on(ToolUsageErrorEvent)
        def on_tool_error(source: Any, event: ToolUsageErrorEvent) -> None:
            for tid in list(self._active_tools.keys()):
                tc, tc_ctx, _ = self._active_tools.pop(tid)
                error = getattr(event, "error", "unknown error")
                tc_ctx.set_result({"error": str(error)})
                tc.__exit__(None, None, None)
                break

        @crewai_event_bus.on(LLMCallStartedEvent)
        def on_llm_started(source: Any, event: LLMCallStartedEvent) -> None:
            llm_id = str(id(event))
            model = getattr(event, "model", "unknown")
            for task_id, (_, step_ctx) in self._active_steps.items():
                llm = step_ctx.llm_call(model=model)
                self._active_llm_calls[llm_id] = (llm, task_id, time.time())
                break

        @crewai_event_bus.on(LLMCallCompletedEvent)
        def on_llm_completed(source: Any, event: LLMCallCompletedEvent) -> None:
            for lid in list(self._active_llm_calls.keys()):
                llm, _, start = self._active_llm_calls.pop(lid)
                prompt_tokens = getattr(event, "prompt_tokens", None)
                completion_tokens = getattr(event, "completion_tokens", None)
                cost = getattr(event, "cost", None)
                kwargs: dict[str, Any] = {}
                if prompt_tokens is not None:
                    kwargs["prompt_tokens"] = prompt_tokens
                if completion_tokens is not None:
                    kwargs["completion_tokens"] = completion_tokens
                if cost is not None:
                    kwargs["cost"] = cost
                llm.end(**kwargs)
                break
