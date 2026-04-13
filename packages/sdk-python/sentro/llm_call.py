"""SentroLlmCall -- tracks a single LLM invocation within a step."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from .transport import Transport


class SentroLlmCall:
    """Represents an LLM call within a step."""

    def __init__(
        self,
        transport: Transport,
        run_id: str,
        step_id: str,
        *,
        model: str,
        provider: str | None = None,
        messages: list[dict[str, str]] | None = None,
        temperature: float | None = None,
        capture_prompts: bool = False,
    ) -> None:
        self._transport = transport
        self._run_id = run_id
        self._step_id = step_id
        self._llm_call_id = str(uuid.uuid4())
        self._capture_prompts = capture_prompts

        event: dict[str, Any] = {
            "type": "llm_call.start",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "runId": self._run_id,
            "stepId": self._step_id,
            "llmCallId": self._llm_call_id,
            "model": model,
            "provider": provider,
            "temperature": temperature,
        }

        if capture_prompts and messages:
            event["messages"] = messages

        self._transport.send(event)

    def end(
        self,
        *,
        response: Any = None,
        prompt_tokens: int | None = None,
        completion_tokens: int | None = None,
        cost: float | None = None,
    ) -> None:
        """End the LLM call with token usage and optional response."""
        event: dict[str, Any] = {
            "type": "llm_call.end",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "runId": self._run_id,
            "stepId": self._step_id,
            "llmCallId": self._llm_call_id,
            "promptTokens": prompt_tokens,
            "completionTokens": completion_tokens,
            "cost": cost,
        }

        if self._capture_prompts and response is not None:
            event["response"] = response

        self._transport.send(event)
