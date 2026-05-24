# Sentry → Sentro Migration Tool

Migrate error data from **Sentry** (SaaS or self-hosted) to **Sentro** (self-hosted).

## Architecture

```
Sentry API                    Sentro API
    │                              │
    ▼                              ▼
┌─────────┐   ┌───────────┐   ┌─────────┐
│ EXTRACT │──▶│ TRANSFORM │──▶│ IMPORT  │
└─────────┘   └───────────┘   └─────────┘
     │                              │
     ▼                              ▼
migration_state/             Sentro Dashboard
  extract_*.json             (Projects + Events)
  full_extraction.json
  transformed.json
  import_state.json
```

### What migrates

| Sentry | → | Sentro |
|--------|---|--------|
| Organization | → | User (manual) |
| Project | → | Project (auto-created) |
| Issue (Group) | → | EventGroup (fingerprinted) |
| Event (occurrence) | → | Event (with stack trace) |
| Tags | → | Event.tags (JSON) |
| Context (user, browser) | → | Event.context (JSON) |
| Stack trace | → | Event.stack_trace |

### What does NOT migrate

- **Team members / access** — Sentro uses different auth. Re-invite manually.
- **Alert rules** — Different alert model. Recreate in Sentro UI.
- **Release data** — Sentro doesn't have releases yet.
- **Performance/transaction data** — Sentro is agent-error-focused.
- **DSN configuration** — Update your apps to use Sentro DSNs.

## Quick Start

### 1. Get Sentry Auth Token

1. Go to https://sentry.io/settings/account/api/auth-tokens/
2. Create a token with `org:read`, `project:read`, `event:read` scopes
3. Set it: `export SENTRY_AUTH_TOKEN=sntrys_...`

### 2. Run Migration

```bash
cd tools/migrate-from-sentry
pip install -r requirements.txt

# All phases at once
python migrate.py all \
    --sentry-token "$SENTRY_AUTH_TOKEN" \
    --org-slug my-org \
    --sentro-url http://localhost:3001 \
    --email admin@example.com \
    --password mypassword

# Or step by step
python migrate.py extract --org-slug my-org
python migrate.py transform
python migrate.py import --sentro-url http://localhost:3001
```

### 3. Verify

Open Sentro at `http://localhost:3001` and check:
- Projects page: one project per Sentry project
- Issues page: error groups with events
- Each event has stack traces, tags, and context

## Commands

| Command | Description |
|---------|-------------|
| `extract` | Pull data from Sentry API (resumable) |
| `transform` | Map to Sentro format |
| `import` | Create projects + ingest events |
| `all` | Run all three phases |
| `status` | Show migration progress |
| `clean` | Delete state to start fresh |

## Options

### Extract
- `--sentry-token` — Sentry auth token (or `SENTRY_AUTH_TOKEN` env var)
- `--org-slug` — Sentry organization slug (required)
- `--max-issues` — Cap issues per project (default: all)
- `--max-events` — Max events per issue (default: 50)

### Import
- `--sentro-url` — Sentro URL (default: `http://localhost:3001`)
- `--email` — Sentro login email (or `SENTRO_EMAIL` env var)
- `--password` — Sentro login password (or `SENTRO_PASSWORD` env var)
- `--dry-run` — Validate without writing

## Resumability

Migration saves state after each API page. If it fails mid-way:
1. Fix the issue (network, rate limit, auth)
2. Re-run the same command — it picks up where it left off
3. Use `python migrate.py status` to see progress
4. Use `python migrate.py clean` to start completely fresh

State files in `./migration_state/`:
- `extract_*.json` — per-endpoint pagination cursors
- `full_extraction.json` — complete extracted data
- `transformed.json` — Sentro-ready event payloads
- `import_state.json` — created projects + event count

## Rate Limiting

- Sentry API: 1 request/second with retry on 429
- Sentro ingest: 50 events/batch, 500ms between batches
- Default extract pauses between pages to avoid hitting Sentry limits

## Troubleshooting

### "Invalid DSN token" during import
Ensure Sentro is running and the project was created. Check `migration_state/import_state.json`.

### "401 Unauthorized" during import
Login failed. Verify email/password. The import creates projects via the web API (not ingest), so auth is required.

### Large organizations timing out
Use `--max-issues` and `--max-events` to limit scope. Run extract separately per project for large orgs.

### Duplicate events
The migration is roughly idempotent: Sentro fingerprints events by `fingerprint` field. Re-running import with the same fingerprint will upsert event groups but create new events.
