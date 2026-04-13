"""SentroToolCall -- tracks a single tool invocation within a step."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from .transport import Transport


class SentroToolCall:
    """Represents a tool call within a step."""

    def __init__(
        self,
        transport: Transport,
        run_id: str,
        step_id: str,
        tool_name: str,
        *,
        input: dict[str, Any] | None = None,
    ) -> None:
        self._transport = transport
        self._run_id = run_id
        self._step_id = step_id
        self._tool_call_id = str(uuid.uuid4())
        self._tool_name = tool_name

        self._transport.send(
            {
                "type": "tool_call.start",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "runId": self._run_id,
                "stepId": self._step_id,
                "toolCallId": self._tool_call_id,
                "toolName": self._tool_name,
                "input": input,
            }
        )

    def set_result(self, result: Any) -> None:
        """Set the result (for use inside context managers)."""
        self._result = result

    def end(
        self,
        *,
        result: Any = None,
        error: str | None = None,
    ) -> None:
        """End the tool call with a result or error."""
        self._transport.send(
            {
                "type": "tool_call.end",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "runId": self._run_id,
                "stepId": self._step_id,
                "toolCallId": self._tool_call_id,
                "toolName": self._tool_name,
                "status": "error" if error else "success",
                "result": result,
                "error": error,
            }
        )

    def __enter__(self) -> SentroToolCall:
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:  # type: ignore[no-untyped-def]
        if exc_type is not None:
            self.end(error=str(exc_val))
        else:
            result = getattr(self, "_result", None)
            self.end(result=result)

    async def __aenter__(self) -> SentroToolCall:
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:  # type: ignore[no-untyped-def]
        if exc_type is not None:
            self.end(error=str(exc_val))
        else:
            result = getattr(self, "_result", None)
            self.end(result=result)
