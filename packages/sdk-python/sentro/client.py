"""Sentro client -- main entry point for the Python SDK."""

from __future__ import annotations

import traceback
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlparse

from .run import SentroRun
from .transport import Transport
from .types import EventLevel, ParsedDsn, SentroConfig


def _parse_dsn(dsn: str) -> ParsedDsn:
    """Parse a Sentro DSN string into its components.

    DSN format: http://token@host:port/api/ingest/project_id
    """
    parsed = urlparse(dsn)
    token = parsed.username or ""
    # Reconstruct host without credentials
    host = f"{parsed.scheme}://{parsed.hostname}"
    if parsed.port:
        host += f":{parsed.port}"
    # Project ID is the last path segment
    path_parts = [p for p in parsed.path.split("/") if p]
    project_id = path_parts[-1] if path_parts else ""
    return ParsedDsn(host=host, token=token, project_id=project_id)


class Sentro:
    """Main Sentro SDK client for error tracking and agent observability."""

    def __init__(
        self,
        dsn: str,
        *,
        capture_prompts: bool = False,
        flush_interval: float = 1.0,
        max_batch_size: int = 100,
        default_tags: dict[str, str] | None = None,
    ) -> None:
        self._parsed_dsn = _parse_dsn(dsn)
        self._capture_prompts = capture_prompts
        self._transport = Transport(
            self._parsed_dsn,
            flush_interval=flush_interval,
            max_batch_size=max_batch_size,
        )
        self._tags: dict[str, str] = dict(default_tags) if default_tags else {}
        self._context: dict[str, Any] = {}

    def set_tags(self, tags: dict[str, str]) -> None:
        """Merge additional tags into the global tag set."""
        self._tags.update(tags)

    def set_context(self, context: dict[str, Any]) -> None:
        """Merge additional context into the global context."""
        self._context.update(context)

    def capture_exception(self, error: BaseException) -> None:
        """Capture an exception and send it as an error event."""
        self._transport.send(
            {
                "type": "event",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "level": "error",
                "message": str(error),
                "stackTrace": "".join(
                    traceback.format_exception(type(error), error, error.__traceback__)
                ),
                "tags": dict(self._tags),
                "context": dict(self._context),
            }
        )

    def capture_message(
        self, message: str, level: EventLevel = "info"
    ) -> None:
        """Capture a message event at the given severity level."""
        self._transport.send(
            {
                "type": "event",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "level": level,
                "message": message,
                "tags": dict(self._tags),
                "context": dict(self._context),
            }
        )

    def start_run(
        self,
        agent: str,
        *,
        goal: str | None = None,
        model: str | None = None,
        trigger: str | None = None,
        session_id: str | None = None,
        user_id: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> SentroRun:
        """Start a new agent run (explicit API)."""
        return SentroRun(
            self._transport,
            agent=agent,
            goal=goal,
            model=model,
            trigger=trigger,
            session_id=session_id,
            user_id=user_id,
            metadata=metadata,
            capture_prompts=self._capture_prompts,
            tags=self._tags,
            context=self._context,
        )

    def trace(
        self,
        agent: str,
        *,
        goal: str | None = None,
        model: str | None = None,
        trigger: str | None = None,
        session_id: str | None = None,
        user_id: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> SentroRun:
        """Start a run as a context manager.

        Usage::

            with sentro.trace("my-agent", goal="do stuff") as run:
                ...
        """
        return self.start_run(
            agent,
            goal=goal,
            model=model,
            trigger=trigger,
            session_id=session_id,
            user_id=user_id,
            metadata=metadata,
        )

    def get_prompt(
        self,
        name: str,
        tag: str | None = None,
        version: int | None = None,
    ) -> dict:
        """Fetch a prompt by name, optionally filtered by tag or version."""
        import json as _json
        import urllib.parse
        import urllib.request

        params: dict[str, str] = {}
        if tag:
            params["tag"] = tag
        if version:
            params["version"] = str(version)

        query = urllib.parse.urlencode(params)
        url = f"{self._parsed_dsn.host}/api/v1/prompts/{urllib.parse.quote(name)}"
        if query:
            url += f"?{query}"

        req = urllib.request.Request(
            url,
            headers={"Authorization": f"Bearer {self._parsed_dsn.token}"},
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            return _json.loads(resp.read())

    def get_dataset(self, name: str) -> dict:
        """Fetch a dataset by name with all its items."""
        import urllib.parse
        import urllib.request
        import json as _json

        url = f"{self._parsed_dsn.host}/api/v1/datasets/{urllib.parse.quote(name)}/items"
        req = urllib.request.Request(
            url,
            headers={"Authorization": f"Bearer {self._parsed_dsn.token}"},
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            return _json.loads(resp.read())

    def score(
        self,
        run_id: str,
        name: str,
        value: float,
        comment: str | None = None,
        source: str = "programmatic",
        metadata: dict | None = None,
    ) -> None:
        """Attach a score to a run."""
        import urllib.request
        import json as _json

        url = f"{self._parsed_dsn.host}/api/v1/scores"
        payload = {
            "runId": run_id,
            "name": name,
            "value": value,
            "comment": comment,
            "source": source,
            "metadata": metadata or {},
        }

        req = urllib.request.Request(
            url,
            data=_json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self._parsed_dsn.token}",
            },
            method="POST",
        )
        try:
            urllib.request.urlopen(req, timeout=5).read()
        except Exception:
            pass  # Fire-and-forget

    def flush(self) -> None:
        """Flush all buffered events."""
        self._transport.flush()

    def shutdown(self) -> None:
        """Stop the flush timer and flush remaining events."""
        self._transport.shutdown()
