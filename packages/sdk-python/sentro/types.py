"""Type definitions for the Sentro Python SDK."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Literal


def utc_now_iso() -> str:
    """Return current UTC time as ISO 8601 string with Z suffix.

    zod's z.string().datetime() only accepts 'Z' suffix, not '+00:00'.
    """
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.") + \
           str(datetime.now(timezone.utc).microsecond // 1000).zfill(3) + "Z"


@dataclass
class SentroConfig:
    dsn: str
    capture_prompts: bool = False
    flush_interval: float = 1.0  # seconds
    max_batch_size: int = 100
    default_tags: dict[str, str] | None = None


@dataclass
class ParsedDsn:
    host: str
    token: str
    project_id: str


EventLevel = Literal["error", "warning", "info", "debug"]

IngestEventType = Literal[
    "event",
    "run.start",
    "run.end",
    "step.start",
    "step.end",
    "tool_call.start",
    "tool_call.end",
    "llm_call.start",
    "llm_call.end",
]

# IngestEvent is just a dict with at least "type" and "timestamp"
IngestEvent = dict[str, Any]


@dataclass
class IngestPayload:
    dsn: str
    batch: list[IngestEvent] = field(default_factory=list)


@dataclass
class StartRunOptions:
    agent: str
    goal: str | None = None
    model: str | None = None
    trigger: str | None = None
    session_id: str | None = None
    user_id: str | None = None
    metadata: dict[str, Any] | None = None


@dataclass
class EndRunOptions:
    status: Literal["success", "failure", "timeout"]
    error_type: str | None = None
    error_message: str | None = None
