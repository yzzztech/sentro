"""SentroRun -- tracks a single agent run."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from .step import SentroStep
from .transport import Transport


class SentroRun:
    """Represents an agent run."""

    def __init__(
        self,
        transport: Transport,
        *,
        agent: str,
        goal: str | None = None,
        model: str | None = None,
        trigger: str | None = None,
        metadata: dict[str, Any] | None = None,
        capture_prompts: bool = False,
        tags: dict[str, str] | None = None,
        context: dict[str, Any] | None = None,
    ) -> None:
        self._transport = transport
        self._run_id = str(uuid.uuid4())
        self._seq = 0
        self._capture_prompts = capture_prompts
        self._ended = False

        self._transport.send(
            {
                "type": "run.start",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "runId": self._run_id,
                "agent": agent,
                "goal": goal,
                "model": model,
                "trigger": trigger,
                "metadata": metadata,
                "tags": dict(tags) if tags else {},
                "context": dict(context) if context else {},
            }
        )

    def step(self, content: str) -> SentroStep:
        """Start a new step in this run."""
        self._seq += 1
        return SentroStep(
            self._transport,
            self._run_id,
            self._seq,
            content,
            capture_prompts=self._capture_prompts,
        )

    def trace(self, content: str) -> SentroStep:
        """Start a step as a context manager (alias for step())."""
        return self.step(content)

    def end(
        self,
        status: str = "success",
        *,
        error_type: str | None = None,
        error_message: str | None = None,
    ) -> None:
        """End this run."""
        if self._ended:
            return
        self._ended = True
        self._transport.send(
            {
                "type": "run.end",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "runId": self._run_id,
                "status": status,
                "errorType": error_type,
                "errorMessage": error_message,
            }
        )

    def error(self, err: BaseException) -> None:
        """End this run as a failure."""
        self.end(
            "failure",
            error_type=type(err).__name__,
            error_message=str(err),
        )

    def __enter__(self) -> SentroRun:
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:  # type: ignore[no-untyped-def]
        if exc_type is not None:
            self.error(exc_val)
        else:
            self.end("success")

    async def __aenter__(self) -> SentroRun:
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:  # type: ignore[no-untyped-def]
        if exc_type is not None:
            self.error(exc_val)
        else:
            self.end("success")
