"""Type definitions for the Sentro Python SDK."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal


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
