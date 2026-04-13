#!/bin/bash
# Sentro observability hook for Claude Code
# Captures tool use events and sends them to Sentro's ingest endpoint.
#
# Setup:
#   1. Set SENTRO_DSN in your environment
#   2. Add hooks to .claude/settings.json (see README)
#   3. This script handles the rest
#
# The hook reads JSON from stdin (Claude Code hook protocol),
# transforms it into Sentro ingest events, and POSTs them.

set -euo pipefail

INPUT=$(cat)

# Extract common fields
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // "unknown"')
HOOK_EVENT=$(echo "$INPUT" | jq -r '.hook_event_name // "unknown"')
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // "unknown"')
CWD=$(echo "$INPUT" | jq -r '.cwd // "unknown"')
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Need SENTRO_DSN to send data
if [ -z "${SENTRO_DSN:-}" ]; then
  exit 0
fi

# Parse DSN: http://token@host:port/api/ingest/proj_xxx
DSN_TOKEN=$(echo "$SENTRO_DSN" | sed -n 's|.*://\([^@]*\)@.*|\1|p')
DSN_BASE=$(echo "$SENTRO_DSN" | sed -n 's|.*@\(.*\)/api/ingest/.*|\1|p')
DSN_PATH=$(echo "$SENTRO_DSN" | sed -n 's|.*/api/ingest/\(.*\)|\1|p')
INGEST_URL="http://${DSN_BASE}/api/ingest"

# Build event based on hook type
case "$HOOK_EVENT" in
  PreToolUse)
    EVENT_TYPE="tool_call.start"
    PAYLOAD=$(echo "$INPUT" | jq -c \
      --arg type "$EVENT_TYPE" \
      --arg ts "$TIMESTAMP" \
      --arg sid "$SESSION_ID" \
      --arg tool "$TOOL_NAME" \
      '{
        type: $type,
        timestamp: $ts,
        sessionId: $sid,
        toolName: $tool,
        input: .tool_input
      }')
    ;;
  PostToolUse)
    EVENT_TYPE="tool_call.end"
    PAYLOAD=$(echo "$INPUT" | jq -c \
      --arg type "$EVENT_TYPE" \
      --arg ts "$TIMESTAMP" \
      --arg sid "$SESSION_ID" \
      --arg tool "$TOOL_NAME" \
      '{
        type: $type,
        timestamp: $ts,
        sessionId: $sid,
        toolName: $tool,
        input: .tool_input,
        status: "success"
      }')
    ;;
  PostToolUseFailure)
    EVENT_TYPE="tool_call.end"
    PAYLOAD=$(echo "$INPUT" | jq -c \
      --arg type "$EVENT_TYPE" \
      --arg ts "$TIMESTAMP" \
      --arg sid "$SESSION_ID" \
      --arg tool "$TOOL_NAME" \
      '{
        type: $type,
        timestamp: $ts,
        sessionId: $sid,
        toolName: $tool,
        input: .tool_input,
        status: "error"
      }')
    ;;
  SessionStart)
    EVENT_TYPE="run.start"
    PAYLOAD=$(jq -c -n \
      --arg type "$EVENT_TYPE" \
      --arg ts "$TIMESTAMP" \
      --arg sid "$SESSION_ID" \
      --arg cwd "$CWD" \
      '{
        type: $type,
        timestamp: $ts,
        sessionId: $sid,
        agent: "claude-code",
        goal: ("Session in " + $cwd),
        model: "claude",
        trigger: "cli"
      }')
    ;;
  Stop)
    EVENT_TYPE="run.end"
    PAYLOAD=$(jq -c -n \
      --arg type "$EVENT_TYPE" \
      --arg ts "$TIMESTAMP" \
      --arg sid "$SESSION_ID" \
      '{
        type: $type,
        timestamp: $ts,
        sessionId: $sid,
        status: "success"
      }')
    ;;
  *)
    # Unknown event type — skip
    exit 0
    ;;
esac

# Send to Sentro (fire-and-forget, never block Claude)
BODY=$(jq -c -n \
  --arg dsn "$SENTRO_DSN" \
  --argjson event "$PAYLOAD" \
  '{ dsn: $dsn, batch: [$event] }')

curl -s -X POST "$INGEST_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${DSN_TOKEN}" \
  -d "$BODY" \
  --max-time 3 \
  > /dev/null 2>&1 || true

# Always exit 0 — never block Claude Code
exit 0
