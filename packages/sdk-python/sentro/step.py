"""SentroStep -- tracks a single step within an agent run."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from .llm_call import SentroLlmCall
from .tool_call import SentroToolCall
from .transport import Transport


class SentroStep:
    """Represents a step within a run."""

    def __init__(
        self,
        transport: Transport,
        run_id: str,
        seq: int,
        content: str,
        *,
        capture_prompts: bool = False,
    ) -> None:
        self._transport = transport
        self._run_id = run_id
        self._seq = seq
        self._step_id = str(uuid.uuid4())
        self._capture_prompts = capture_prompts

        self._transport.send(
            {
                "type": "step.start",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "runId": self._run_id,
                "stepId": self._step_id,
                "sequenceNumber": self._seq,
                "content": content,
            }
        )

    def tool_call(
        self,
        tool_name: str,
        *,
        input: dict[str, Any] | None = None,
    ) -> SentroToolCall:
        """Start a tool call within this step."""
        return SentroToolCall(
            self._transport,
            self._run_id,
            self._step_id,
            tool_name,
            input=input,
        )

    def trace_tool_call(
        self,
        tool_name: str,
        *,
        input: dict[str, Any] | None = None,
    ) -> SentroToolCall:
        """Start a tool call as a context manager."""
        return self.tool_call(tool_name, input=input)

    def llm_call(
        self,
        *,
        model: str,
        provider: str | None = None,
        messages: list[dict[str, str]] | None = None,
        temperature: float | None = None,
    ) -> SentroLlmCall:
        """Start an LLM call within this step."""
        return SentroLlmCall(
            self._transport,
            self._run_id,
            self._step_id,
            model=model,
            provider=provider,
            messages=messages,
            temperature=temperature,
            capture_prompts=self._capture_prompts,
        )

    def end(self) -> None:
        """End this step."""
        self._transport.send(
            {
                "type": "step.end",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "runId": self._run_id,
                "stepId": self._step_id,
                "sequenceNumber": self._seq,
            }
        )

    def __enter__(self) -> SentroStep:
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:  # type: ignore[no-untyped-def]
        self.end()

    async def __aenter__(self) -> SentroStep:
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:  # type: ignore[no-untyped-def]
        self.end()
