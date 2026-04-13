"""Tests for the Sentro client."""

from __future__ import annotations

import json
from unittest.mock import MagicMock, patch

import pytest

from sentro.client import Sentro, _parse_dsn
from sentro.types import ParsedDsn


class TestParseDsn:
    def test_parses_standard_dsn(self) -> None:
        dsn = _parse_dsn("http://my-token@localhost:3000/api/ingest/proj_1")
        assert dsn.host == "http://localhost:3000"
        assert dsn.token == "my-token"
        assert dsn.project_id == "proj_1"

    def test_parses_https_dsn(self) -> None:
        dsn = _parse_dsn("https://tok123@sentro.example.com/api/ingest/proj_abc")
        assert dsn.host == "https://sentro.example.com"
        assert dsn.token == "tok123"
        assert dsn.project_id == "proj_abc"

    def test_parses_dsn_without_port(self) -> None:
        dsn = _parse_dsn("http://token@localhost/api/ingest/proj_2")
        assert dsn.host == "http://localhost"
        assert dsn.token == "token"
        assert dsn.project_id == "proj_2"


class TestCaptureException:
    def test_captures_exception_with_stack_trace(self) -> None:
        sentro = Sentro(dsn="http://tok@localhost:3000/api/ingest/proj_1", flush_interval=999)
        try:
            events: list = []
            sentro._transport.send = MagicMock(side_effect=lambda e: events.append(e))

            try:
                raise ValueError("test error")
            except ValueError as e:
                sentro.capture_exception(e)

            assert len(events) == 1
            event = events[0]
            assert event["type"] == "event"
            assert event["level"] == "error"
            assert event["message"] == "test error"
            assert "ValueError" in event["stackTrace"]
            assert "test error" in event["stackTrace"]
        finally:
            sentro.shutdown()


class TestCaptureMessage:
    def test_captures_message_with_default_level(self) -> None:
        sentro = Sentro(dsn="http://tok@localhost:3000/api/ingest/proj_1", flush_interval=999)
        try:
            events: list = []
            sentro._transport.send = MagicMock(side_effect=lambda e: events.append(e))

            sentro.capture_message("hello world")

            assert len(events) == 1
            assert events[0]["type"] == "event"
            assert events[0]["level"] == "info"
            assert events[0]["message"] == "hello world"
        finally:
            sentro.shutdown()

    def test_captures_message_with_custom_level(self) -> None:
        sentro = Sentro(dsn="http://tok@localhost:3000/api/ingest/proj_1", flush_interval=999)
        try:
            events: list = []
            sentro._transport.send = MagicMock(side_effect=lambda e: events.append(e))

            sentro.capture_message("warning!", level="warning")

            assert events[0]["level"] == "warning"
        finally:
            sentro.shutdown()


class TestTagsAndContext:
    def test_tags_attach_to_events(self) -> None:
        sentro = Sentro(
            dsn="http://tok@localhost:3000/api/ingest/proj_1",
            flush_interval=999,
            default_tags={"env": "test"},
        )
        try:
            events: list = []
            sentro._transport.send = MagicMock(side_effect=lambda e: events.append(e))

            sentro.set_tags({"service": "api"})
            sentro.capture_message("tagged")

            assert events[0]["tags"] == {"env": "test", "service": "api"}
        finally:
            sentro.shutdown()

    def test_context_attaches_to_events(self) -> None:
        sentro = Sentro(dsn="http://tok@localhost:3000/api/ingest/proj_1", flush_interval=999)
        try:
            events: list = []
            sentro._transport.send = MagicMock(side_effect=lambda e: events.append(e))

            sentro.set_context({"user_id": "123"})
            sentro.capture_message("with context")

            assert events[0]["context"] == {"user_id": "123"}
        finally:
            sentro.shutdown()

    def test_tags_are_copied_not_shared(self) -> None:
        sentro = Sentro(dsn="http://tok@localhost:3000/api/ingest/proj_1", flush_interval=999)
        try:
            events: list = []
            sentro._transport.send = MagicMock(side_effect=lambda e: events.append(e))

            sentro.set_tags({"a": "1"})
            sentro.capture_message("first")
            sentro.set_tags({"b": "2"})
            sentro.capture_message("second")

            assert events[0]["tags"] == {"a": "1"}
            assert events[1]["tags"] == {"a": "1", "b": "2"}
        finally:
            sentro.shutdown()
