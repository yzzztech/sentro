"""
Transform Sentry data → Sentro format.

Maps:
- Sentry Project → Sentro project metadata (name only, token auto-generated)
- Sentry Issue/Group → Sentro EventGroup + Events
- Sentry stack trace → Sentro event.stack_trace
- Sentry tags/context → Sentro event JSON fields
- Sentry levels → Sentro EventLevel

Also handles fingerprint generation if Sentry's isn't provided.
"""

import hashlib
import json
from datetime import datetime, timezone
from typing import Any, Optional


def _utc_now_iso() -> str:
    """ISO 8601 with Z suffix (Sentro requires Z, rejects +00:00)."""
    now = datetime.now(timezone.utc)
    return now.strftime("%Y-%m-%dT%H:%M:%S.") + str(now.microsecond // 1000).zfill(3) + "Z"


# ── level mapping ──────────────────────────────────────────────────

SENTRY_TO_SENTRO_LEVEL = {
    "fatal": "error",
    "error": "error",
    "warning": "warning",
    "info": "info",
    "debug": "debug",
    "sample": "info",
}


def map_level(sentry_level: Optional[str]) -> str:
    """Map Sentry severity → Sentro EventLevel."""
    if not sentry_level:
        return "error"
    return SENTRY_TO_SENTRO_LEVEL.get(sentry_level.lower(), "error")


# ── fingerprint ────────────────────────────────────────────────────

def generate_fingerprint(issue: dict, event: Optional[dict] = None) -> str:
    """
    Generate a stable Sentro fingerprint from Sentry data.
    Sentry has its own fingerprint but may not expose it cleanly.
    """
    parts = []

    # Issue metadata
    title = issue.get("title", "") or issue.get("metadata", {}).get("title", "")
    short_id = issue.get("shortId", "")

    if title:
        parts.append(title)

    # Exception type from metadata
    metadata = issue.get("metadata", {})
    exc_type = metadata.get("type")
    exc_value = metadata.get("value")
    if exc_type:
        parts.append(exc_type)
    if exc_value:
        parts.append(str(exc_value)[:200])

    # If we have an event, add stack fingerprint
    if event:
        entries = event.get("entries", []) or event.get("exception", {}).get("values", [])
        for entry in entries:
            if entry.get("type") == "exception":
                data = entry.get("data", {}) or entry
                values = data.get("values", [])
                for v in values:
                    stacktrace = v.get("stacktrace", {})
                    frames = stacktrace.get("frames", [])
                    if frames:
                        # Use last 3 frames' function names
                        for frame in frames[-3:]:
                            fn = frame.get("function", "")
                            mod = frame.get("module", "")
                            if fn:
                                parts.append(f"{mod}.{fn}" if mod else fn)

    if not parts:
        parts.append(short_id or "unknown")

    raw = "|".join(parts)
    return hashlib.md5(raw.encode()).hexdigest()[:16]


# ── stack trace extraction ─────────────────────────────────────────

def extract_stacktrace(event: dict) -> Optional[str]:
    """Extract a readable stack trace from a Sentry event."""
    lines: list[str] = []

    entries = event.get("entries", []) or event.get("exception", {}).get("values", [])
    for entry in entries:
        if entry.get("type") != "exception":
            continue
        data = entry.get("data", {}) or entry
        values = data.get("values", [])
        for v in values:
            exc_type = v.get("type", "Exception")
            exc_value = v.get("value", "")
            lines.append(f"{exc_type}: {exc_value}")

            stacktrace = v.get("stacktrace", {})
            frames = stacktrace.get("frames", [])
            for frame in frames:
                fn = frame.get("function", "?")
                mod = frame.get("module", "")
                filename = frame.get("filename", "?")
                lineno = frame.get("lineNo", frame.get("lineno", "?"))
                abs_path = frame.get("absPath", "")
                prefix = f"{mod}." if mod else ""
                loc = abs_path or filename
                lines.append(f"  at {prefix}{fn} ({loc}:{lineno})")

    return "\n".join(lines) if lines else None


# ── tags & context ─────────────────────────────────────────────────

def extract_tags(event: dict, issue: dict) -> dict:
    """Extract tags from Sentry event and issue."""
    tags = {}

    # From event tags
    event_tags = event.get("tags", [])
    if isinstance(event_tags, list):
        for tag in event_tags:
            if isinstance(tag, dict):
                key = tag.get("key", "")
                value = tag.get("value", "")
                if key:
                    tags[key] = value

    # From issue-level data
    tags["sentry_issue_id"] = issue.get("id", "")
    tags["sentry_short_id"] = issue.get("shortId", "")
    tags["sentry_project"] = issue.get("project", {}).get("slug", "")

    # Environment — Sentry has it as a top-level field or as a tag
    env = event.get("environment")
    if not env:
        event_tags_list = event.get("tags", [])
        if isinstance(event_tags_list, list):
            for tag in event_tags_list:
                if isinstance(tag, dict) and tag.get("key") == "environment":
                    env = tag.get("value")
                    break
    if env:
        tags["environment"] = env

    # Platform
    platform = event.get("platform")
    if platform:
        tags["platform"] = platform

    return tags


def extract_context(event: dict) -> dict:
    """Extract context (user, device, runtime, etc.) from Sentry event."""
    context = {}

    user = event.get("user")
    if user:
        context["user"] = {
            k: v for k, v in user.items()
            if k in ("id", "email", "username", "ip_address")
        }

    contexts = event.get("contexts", {})
    for key in ("browser", "os", "device", "runtime"):
        if key in contexts:
            context[key] = contexts[key]

    request_data = event.get("request")
    if request_data:
        context["request"] = {
            "url": request_data.get("url"),
            "method": request_data.get("method"),
            "headers": request_data.get("headers", {}),
        }

    return context


# ── main transform ─────────────────────────────────────────────────

def transform_project(sentry_project: dict) -> dict:
    """Transform Sentry project → Sentro project creation payload."""
    return {
        "name": sentry_project.get("slug") or sentry_project.get("name", "migrated-project"),
    }


def transform_issue_to_events(
    issue: dict,
    events: list[dict],
    project_name: str,
) -> list[dict]:
    """
    Transform a Sentry issue + its events → list of Sentro ingest event payloads.

    Returns a list of event dicts ready for the ingest batch endpoint.
    Each event is a standalone Sentro event (no grouping — the server fingerprints).
    """
    result = []
    fingerprint = generate_fingerprint(issue)

    for event in events:
        level = map_level(
            event.get("level") or issue.get("level")
        )

        # Parse timestamp
        ts_raw = (
            event.get("dateCreated")
            or event.get("timestamp")
            or event.get("dateReceived")
            or issue.get("lastSeen")
        )
        timestamp = _utc_now_iso()
        if ts_raw:
            try:
                # Attempt to normalize to Z format
                ts_str = str(ts_raw).replace(" ", "T")
                if "+" in ts_str:
                    ts_str = ts_str.split("+")[0] + "Z"
                elif ts_str.endswith("Z"):
                    pass
                else:
                    ts_str += "Z"
                # Validate by parsing
                datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
                timestamp = ts_str
            except (ValueError, TypeError):
                pass

        message = (
            event.get("title")
            or issue.get("title")
            or issue.get("metadata", {}).get("value", "Unknown error")
        )

        sentro_event = {
            "type": "event",
            "timestamp": timestamp,
            "level": level,
            "message": str(message)[:1000],
            "stack_trace": extract_stacktrace(event),
            "tags": extract_tags(event, issue),
            "context": extract_context(event),
            "fingerprint": fingerprint,
            "project_name": project_name,
        }

        result.append(sentro_event)

    return result


def transform_extraction(
    extraction: dict[str, dict],
    max_events_per_issue: int = 50,
) -> dict[str, list[dict]]:
    """
    Transform a full extraction into Sentro-ready batches.
    Returns: {project_slug: [event_payload, ...]}
    """
    result: dict[str, list[dict]] = {}

    for project_slug, data in extraction.items():
        all_events: list[dict] = []

        for issue_data in data.get("issues", []):
            issue = issue_data["issue"]
            events = issue_data.get("events", [])[:max_events_per_issue]
            if events:
                transformed = transform_issue_to_events(issue, events, project_slug)
                all_events.extend(transformed)

        if all_events:
            result[project_slug] = all_events

    return result
