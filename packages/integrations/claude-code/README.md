# Sentro Integration for Claude Code

Automatic observability for Claude Code sessions. Every tool call, session start/stop, and failure is captured in your Sentro dashboard.

## Setup

### 1. Set your Sentro DSN

Add to your shell profile (`~/.zshrc` or `~/.bashrc`):

```bash
export SENTRO_DSN="http://your-token@localhost:3000/api/ingest/proj_xxx"
```

### 2. Copy the hook script

```bash
cp packages/integrations/claude-code/sentro-hook.sh ~/.claude/hooks/sentro-hook.sh
chmod +x ~/.claude/hooks/sentro-hook.sh
```

### 3. Add hooks to Claude Code settings

Add to `~/.claude/settings.json` (global) or `.claude/settings.json` (per-project):

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup",
        "hooks": [
          {
            "type": "command",
            "command": "~/.claude/hooks/sentro-hook.sh",
            "timeout": 5
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "~/.claude/hooks/sentro-hook.sh",
            "timeout": 5
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "~/.claude/hooks/sentro-hook.sh",
            "timeout": 5
          }
        ]
      }
    ],
    "PostToolUseFailure": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "~/.claude/hooks/sentro-hook.sh",
            "timeout": 5
          }
        ]
      }
    ],
    "Stop": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "~/.claude/hooks/sentro-hook.sh",
            "timeout": 5
          }
        ]
      }
    ]
  }
}
```

## What Gets Captured

| Event | What Sentro Records |
|-------|-------------------|
| **SessionStart** | New agent run with working directory as goal |
| **PreToolUse** | Tool call start (tool name + input args) |
| **PostToolUse** | Tool call end (success) |
| **PostToolUseFailure** | Tool call end (error) |
| **Stop** | Agent run completed |

## What You See in Sentro

- Every Claude Code session as an **agent run**
- Every tool call (Bash, Edit, Read, Write, Grep, Glob, Agent, etc.) as a **tool call** with inputs
- Failed tool calls highlighted with error status
- Session duration and tool call count
- Timeline replay of exactly what Claude did

## Requirements

- `jq` (JSON processor) — install with `brew install jq` or `apt install jq`
- `curl`
- Sentro running and accessible from your machine

## How It Works

The hook script:
1. Reads JSON from stdin (Claude Code hook protocol)
2. Transforms it into Sentro ingest events
3. POSTs to your Sentro instance via the ingest API
4. Always exits 0 — **never blocks Claude Code**, even if Sentro is down

The hook adds ~50ms per tool call. With a 5-second timeout, it gracefully fails if Sentro is unreachable.
