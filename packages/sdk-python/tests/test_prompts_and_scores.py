"""Tests for get_prompt, get_dataset, and score client methods."""

from __future__ import annotations

import json
from unittest.mock import MagicMock, patch

from sentro.client import Sentro


def _make_mock_response(body: bytes = b"{}") -> MagicMock:
    """Build a MagicMock that behaves like urlopen()'s context manager result."""
    mock_response = MagicMock()
    mock_response.read.return_value = body
    mock_response.__enter__ = MagicMock(return_value=mock_response)
    mock_response.__exit__ = MagicMock(return_value=None)
    return mock_response


def _make_sentro() -> Sentro:
    return Sentro(dsn="http://tok@localhost:3000/api/ingest/proj_1", flush_interval=999)


class TestGetPrompt:
    def test_get_prompt_sends_auth_header(self) -> None:
        sentro = _make_sentro()
        try:
            mock_response = _make_mock_response(b"{}")
            with patch(
                "urllib.request.urlopen", return_value=mock_response
            ) as mock_urlopen:
                sentro.get_prompt("my-prompt")

                call_args = mock_urlopen.call_args
                request = call_args[0][0]
                assert (
                    request.full_url
                    == "http://localhost:3000/api/v1/prompts/my-prompt"
                )
                assert request.headers.get("Authorization") == "Bearer tok"
        finally:
            sentro.shutdown()

    def test_get_prompt_with_tag(self) -> None:
        sentro = _make_sentro()
        try:
            mock_response = _make_mock_response(b"{}")
            with patch(
                "urllib.request.urlopen", return_value=mock_response
            ) as mock_urlopen:
                sentro.get_prompt("my-prompt", tag="production")

                request = mock_urlopen.call_args[0][0]
                assert request.full_url.endswith("?tag=production")
                assert (
                    request.full_url
                    == "http://localhost:3000/api/v1/prompts/my-prompt?tag=production"
                )
        finally:
            sentro.shutdown()

    def test_get_prompt_with_version(self) -> None:
        sentro = _make_sentro()
        try:
            mock_response = _make_mock_response(b"{}")
            with patch(
                "urllib.request.urlopen", return_value=mock_response
            ) as mock_urlopen:
                sentro.get_prompt("my-prompt", version=3)

                request = mock_urlopen.call_args[0][0]
                assert request.full_url.endswith("?version=3")
                assert (
                    request.full_url
                    == "http://localhost:3000/api/v1/prompts/my-prompt?version=3"
                )
        finally:
            sentro.shutdown()

    def test_get_prompt_url_encodes_name(self) -> None:
        sentro = _make_sentro()
        try:
            mock_response = _make_mock_response(b"{}")
            with patch(
                "urllib.request.urlopen", return_value=mock_response
            ) as mock_urlopen:
                sentro.get_prompt("my prompt/v2")

                request = mock_urlopen.call_args[0][0]
                # Space -> %20. urllib.parse.quote leaves '/' unencoded by
                # default (it's in the "safe" set), so we only assert that
                # unsafe characters like spaces are percent-encoded.
                assert "my%20prompt" in request.full_url
                assert "my prompt" not in request.full_url
        finally:
            sentro.shutdown()

    def test_get_prompt_returns_parsed_json(self) -> None:
        sentro = _make_sentro()
        try:
            mock_response = _make_mock_response(b'{"name":"p","body":"hello"}')
            with patch("urllib.request.urlopen", return_value=mock_response):
                result = sentro.get_prompt("p")
                assert result == {"name": "p", "body": "hello"}
        finally:
            sentro.shutdown()


class TestGetDataset:
    def test_get_dataset_sends_auth_and_returns_json(self) -> None:
        sentro = _make_sentro()
        try:
            mock_response = _make_mock_response(
                b'{"name":"ds","items":[{"id":"1"}]}'
            )
            with patch(
                "urllib.request.urlopen", return_value=mock_response
            ) as mock_urlopen:
                result = sentro.get_dataset("my-dataset")

                request = mock_urlopen.call_args[0][0]
                assert (
                    request.full_url
                    == "http://localhost:3000/api/v1/datasets/my-dataset/items"
                )
                assert request.headers.get("Authorization") == "Bearer tok"
                assert result == {"name": "ds", "items": [{"id": "1"}]}
        finally:
            sentro.shutdown()


class TestScore:
    def test_score_sends_post_with_payload(self) -> None:
        sentro = _make_sentro()
        try:
            mock_response = _make_mock_response(b"{}")
            with patch(
                "urllib.request.urlopen", return_value=mock_response
            ) as mock_urlopen:
                sentro.score("run_1", "correctness", 0.95)

                request = mock_urlopen.call_args[0][0]
                assert request.full_url == "http://localhost:3000/api/v1/scores"
                assert request.get_method() == "POST"
                assert request.headers.get("Authorization") == "Bearer tok"
                assert request.headers.get("Content-type") == "application/json"

                payload = json.loads(request.data.decode("utf-8"))
                assert payload["runId"] == "run_1"
                assert payload["name"] == "correctness"
                assert payload["value"] == 0.95
                assert payload["source"] == "programmatic"
        finally:
            sentro.shutdown()

    def test_score_with_comment_and_metadata(self) -> None:
        sentro = _make_sentro()
        try:
            mock_response = _make_mock_response(b"{}")
            with patch(
                "urllib.request.urlopen", return_value=mock_response
            ) as mock_urlopen:
                sentro.score(
                    "run_2",
                    "helpfulness",
                    0.7,
                    comment="pretty good",
                    metadata={"reviewer": "alice", "rubric": "v3"},
                )

                request = mock_urlopen.call_args[0][0]
                payload = json.loads(request.data.decode("utf-8"))
                assert payload["runId"] == "run_2"
                assert payload["name"] == "helpfulness"
                assert payload["value"] == 0.7
                assert payload["comment"] == "pretty good"
                assert payload["metadata"] == {"reviewer": "alice", "rubric": "v3"}
        finally:
            sentro.shutdown()

    def test_score_source_human(self) -> None:
        sentro = _make_sentro()
        try:
            mock_response = _make_mock_response(b"{}")
            with patch(
                "urllib.request.urlopen", return_value=mock_response
            ) as mock_urlopen:
                sentro.score("run_3", "quality", 0.8, source="human")

                request = mock_urlopen.call_args[0][0]
                payload = json.loads(request.data.decode("utf-8"))
                assert payload["source"] == "human"
        finally:
            sentro.shutdown()

    def test_score_source_llm_judge(self) -> None:
        sentro = _make_sentro()
        try:
            mock_response = _make_mock_response(b"{}")
            with patch(
                "urllib.request.urlopen", return_value=mock_response
            ) as mock_urlopen:
                sentro.score("run_4", "faithfulness", 0.92, source="llm_judge")

                request = mock_urlopen.call_args[0][0]
                payload = json.loads(request.data.decode("utf-8"))
                assert payload["source"] == "llm_judge"
        finally:
            sentro.shutdown()
