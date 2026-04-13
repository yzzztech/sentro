"""HTTP batching transport for the Sentro Python SDK."""

from __future__ import annotations

import atexit
import json
import logging
import threading
import urllib.request
from typing import Any

from .types import IngestEvent, ParsedDsn

logger = logging.getLogger("sentro")


class Transport:
    """Buffers events and flushes them to the Sentro ingest endpoint."""

    def __init__(
        self,
        dsn: ParsedDsn,
        *,
        flush_interval: float = 1.0,
        max_batch_size: int = 100,
    ) -> None:
        self._dsn = dsn
        self._flush_interval = flush_interval
        self._max_batch_size = max_batch_size
        self._buffer: list[IngestEvent] = []
        self._lock = threading.Lock()
        self._timer: threading.Timer | None = None
        self._shutdown_flag = False

        self._start_timer()
        atexit.register(self._atexit_flush)

    def send(self, event: IngestEvent) -> None:
        """Add an event to the buffer. Flushes if batch size is reached."""
        flush_now = False
        with self._lock:
            self._buffer.append(event)
            if len(self._buffer) >= self._max_batch_size:
                flush_now = True
        if flush_now:
            self.flush()

    def flush(self) -> None:
        """Flush all buffered events to the server."""
        with self._lock:
            if not self._buffer:
                return
            batch = list(self._buffer)
            self._buffer.clear()

        payload = json.dumps({"dsn": self._dsn.project_id, "batch": batch}).encode(
            "utf-8"
        )

        try:
            req = urllib.request.Request(
                f"{self._dsn.host}/api/ingest",
                data=payload,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {self._dsn.token}",
                },
                method="POST",
            )
            urllib.request.urlopen(req)  # noqa: S310
        except Exception:
            # Drop events silently -- no local queue for v1
            logger.debug("Failed to flush events", exc_info=True)

    def shutdown(self) -> None:
        """Stop the periodic timer and flush remaining events."""
        self._shutdown_flag = True
        self._stop_timer()
        self.flush()

    # -- internal --

    def _start_timer(self) -> None:
        if self._shutdown_flag:
            return
        self._timer = threading.Timer(self._flush_interval, self._on_timer)
        self._timer.daemon = True
        self._timer.start()

    def _stop_timer(self) -> None:
        if self._timer is not None:
            self._timer.cancel()
            self._timer = None

    def _on_timer(self) -> None:
        self.flush()
        self._start_timer()

    def _atexit_flush(self) -> None:
        self.shutdown()
