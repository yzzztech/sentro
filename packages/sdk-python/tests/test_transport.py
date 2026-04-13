"""Tests for the Sentro transport layer."""

from __future__ import annotations

import json
import time
from unittest.mock import MagicMock, patch

import pytest

from sentro.transport import Transport
from sentro.types import ParsedDsn


@pytest.fixture
def dsn() -> ParsedDsn:
    return ParsedDsn(host="http://localhost:3000", token="test-token", project_id="proj_1")


def _make_transport(dsn: ParsedDsn, **kwargs) -> Transport:
    """Create a transport with a long flush interval to avoid timer interference."""
    return Transport(dsn, flush_interval=kwargs.pop("flush_interval", 999), **kwargs)


class TestBufferingAndFlush:
    def test_buffers_events_and_flushes(self, dsn: ParsedDsn) -> None:
        transport = _make_transport(dsn)
        try:
            transport.send({"type": "event", "timestamp": "2024-01-01T00:00:00Z", "message": "hello"})
            transport.send({"type": "event", "timestamp": "2024-01-01T00:00:01Z", "message": "world"})

            with patch("urllib.request.urlopen") as mock_urlopen:
                transport.flush()

            mock_urlopen.assert_called_once()
            req = mock_urlopen.call_args[0][0]
            payload = json.loads(req.data)
            assert payload["dsn"] == "proj_1"
            assert len(payload["batch"]) == 2
            assert payload["batch"][0]["message"] == "hello"
            assert payload["batch"][1]["message"] == "world"
        finally:
            transport.shutdown()

    def test_flush_on_interval(self, dsn: ParsedDsn) -> None:
        with patch("urllib.request.urlopen") as mock_urlopen:
            transport = Transport(dsn, flush_interval=0.1)
            try:
                transport.send({"type": "event", "timestamp": "2024-01-01T00:00:00Z"})
                time.sleep(0.3)
                assert mock_urlopen.call_count >= 1
            finally:
                transport.shutdown()

    def test_flush_when_batch_size_reached(self, dsn: ParsedDsn) -> None:
        with patch("urllib.request.urlopen") as mock_urlopen:
            transport = _make_transport(dsn, max_batch_size=2)
            try:
                transport.send({"type": "event", "timestamp": "t1"})
                assert mock_urlopen.call_count == 0

                transport.send({"type": "event", "timestamp": "t2"})
                assert mock_urlopen.call_count == 1

                payload = json.loads(mock_urlopen.call_args[0][0].data)
                assert len(payload["batch"]) == 2
            finally:
                transport.shutdown()

    def test_empty_flush_is_noop(self, dsn: ParsedDsn) -> None:
        transport = _make_transport(dsn)
        try:
            with patch("urllib.request.urlopen") as mock_urlopen:
                transport.flush()
            mock_urlopen.assert_not_called()
        finally:
            transport.shutdown()


class TestHeaders:
    def test_sends_correct_headers(self, dsn: ParsedDsn) -> None:
        transport = _make_transport(dsn)
        try:
            transport.send({"type": "event", "timestamp": "t1"})

            with patch("urllib.request.urlopen") as mock_urlopen:
                transport.flush()

            req = mock_urlopen.call_args[0][0]
            assert req.get_header("Content-type") == "application/json"
            assert req.get_header("Authorization") == "Bearer test-token"
            assert req.full_url == "http://localhost:3000/api/ingest"
            assert req.method == "POST"
        finally:
            transport.shutdown()


class TestErrorHandling:
    def test_drops_events_on_network_error(self, dsn: ParsedDsn) -> None:
        transport = _make_transport(dsn)
        try:
            transport.send({"type": "event", "timestamp": "t1"})

            with patch("urllib.request.urlopen", side_effect=OSError("network error")):
                # Should not raise
                transport.flush()

            # Buffer should be cleared even on error
            with patch("urllib.request.urlopen") as mock_urlopen:
                transport.flush()
            mock_urlopen.assert_not_called()
        finally:
            transport.shutdown()


class TestShutdown:
    def test_flushes_on_shutdown(self, dsn: ParsedDsn) -> None:
        transport = _make_transport(dsn)
        transport.send({"type": "event", "timestamp": "t1"})

        with patch("urllib.request.urlopen") as mock_urlopen:
            transport.shutdown()

        mock_urlopen.assert_called_once()
        payload = json.loads(mock_urlopen.call_args[0][0].data)
        assert len(payload["batch"]) == 1
