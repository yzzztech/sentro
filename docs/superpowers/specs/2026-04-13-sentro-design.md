# Sentro — Design Spec

**Date:** 2026-04-13
**Status:** Draft

## Overview

Sentro is a self-hosted error tracking and observability platform built for AI agents. It provides everything Sentry does (error tracking, performance monitoring, issue grouping) plus first-class agent observability: run tracing, step-by-step replay, tool call monitoring, and LLM call tracking.

**Why Sentro exists:** Sentry was built for human developers debugging stack traces. Agents run autonomously, make decisions, chain tool calls, retry on failure, and go off the rails in ways that don't map to traditional error tracking. Sentro bridges this gap.

**Differentiator:** The `run → step → tool_call/llm_call` hierarchy is a first-class data model, not an afterthought bolted onto existing tracing. Every dashboard page, alert rule, and query is aware of agent workflows.

## Decisions

- **Deployment:** Self-hosted (v1). SaaS possible later — architecture supports it.
- **Stack:** TypeScript everywhere. Next.js 15 (App Router) for dashboard + API. Node for ingestion.
- **Database:** PostgreSQL only for v1. ClickHouse can be added later for analytics at scale.
- **Architecture:** Monolith. Single Next.js app + Postgres. Two Docker containers.
- **SDK:** Explicit API first (`@sentro/sdk` for TypeScript). Framework integrations (LangChain, CrewAI, Vercel AI SDK) in v1.1. Python SDK in v1.1.
- **Monorepo:** Turborepo with two packages: `apps/web` and `packages/sdk`.

## Architecture

### Scalability-Ready Monolith

Single Next.js application backed by PostgreSQL. Designed for easy deployment today, clean scaling path tomorrow.

**Internal layers:**

1. **Ingestion API** (`/api/ingest`) — receives events from the SDK. Validates, buffers, batch-writes to Postgres.
2. **Dashboard UI** — Next.js App Router pages. Server Components where possible.
3. **REST API** (`/api/*`) — powers the dashboard. Projects, events, runs, alerts.
4. **Background Jobs** — pg-boss (Postgres-backed, no Redis needed). Handles alert evaluation, aggregation, data cleanup.

**Scalability design:**

- Ingestion uses an in-memory batch buffer (flushes every 1s or 100 events). Absorbs bursts without hammering the DB.
- App is stateless — no in-memory sessions, no local file storage. Can run N instances behind a load balancer.
- Connection pooling via `pg-pool` with configurable limits.
- Event tables designed for Postgres time-based partitioning when data grows.

**Scaling path:**

| Stage | Change | Containers |
|-------|--------|------------|
| v1 | App + Postgres | 2 |
| v1.5 | Add Redis (cache + job queue, swap pg-boss for BullMQ) | 3 |
| v2 | Separate ingestion service | 4 |
| v2.5 | Add ClickHouse for event analytics | 5 |
| v3 (SaaS) | Kubernetes, multi-tenant isolation | Cloud |

Each stage is additive. SDK and API contracts never change.

## Data Model

### Auth & Config Tables

**`users`** — single-user for v1, multi-user ready
- `id` (UUID, PK)
- `email` (string, unique)
- `password_hash` (string)
- `created_at` (timestamp)
- `updated_at` (timestamp)

**`sessions`** — cookie-based auth sessions
- `id` (UUID, PK)
- `user_id` (FK → users)
- `token` (string, unique, indexed)
- `expires_at` (timestamp)
- `created_at` (timestamp)

### Core Tables (Sentry-equivalent)

**`projects`**
- `id` (UUID, PK)
- `name` (string)
- `dsn_token` (string, unique — auth token portion of DSN)
- `retention_days` (integer, default: 30)
- `rate_limit_per_minute` (integer, default: 1000)
- `created_at` (timestamp)
- `updated_at` (timestamp)
- Index: `dsn_token` (unique — used on every ingest request)

**`event_groups`** — deduplicated issues grouped by fingerprint
- `id` (UUID, PK)
- `project_id` (FK → projects)
- `fingerprint` (string)
- `title` (string)
- `level` (enum: error, warning, info, debug)
- `first_seen` (timestamp)
- `last_seen` (timestamp)
- `count` (integer, default: 0)
- `status` (enum: open, resolved, ignored, default: open)
- `created_at` (timestamp)
- `updated_at` (timestamp)
- Index: `(project_id, status, last_seen DESC)` — issues list default query
- Index: `(project_id, fingerprint)` unique — upsert during ingestion

**`events`** — individual error/log occurrences (partitioned by `received_at`)
- `id` (UUID, PK)
- `project_id` (FK → projects)
- `group_id` (FK → event_groups)
- `run_id` (FK → agent_runs, nullable — links error to the agent run that caused it)
- `fingerprint` (string)
- `level` (enum: error, warning, info, debug)
- `message` (text)
- `stack_trace` (text, nullable)
- `tags` (JSONB, default: {})
- `context` (JSONB, default: {})
- `timestamp` (timestamp — client-side time, when the event occurred)
- `received_at` (timestamp — server-side time, partition key, used for retention cleanup)
- Index: `(group_id, timestamp DESC)` — event detail page, newest first
- Index: `(project_id, received_at DESC)` — project event feed
- Index: `(run_id)` WHERE run_id IS NOT NULL — errors for a specific agent run
- Partitioning: range on `received_at`, monthly partitions

### Agent Tables (the differentiator)

**`agent_runs`** — top-level trace for an entire agent execution
- `id` (UUID, PK)
- `project_id` (FK → projects)
- `agent_name` (string)
- `trigger` (string, nullable — what started the run)
- `goal` (string, nullable)
- `model` (string, nullable)
- `status` (enum: running, success, failure, timeout)
- `total_tokens` (integer, default: 0)
- `total_cost` (decimal, default: 0)
- `error_type` (string, nullable — populated on failure)
- `error_message` (text, nullable — populated on failure)
- `started_at` (timestamp)
- `finished_at` (timestamp, nullable)
- `metadata` (JSONB, default: {})
- Index: `(project_id, started_at DESC)` — runs list page
- Index: `(project_id, agent_name, started_at DESC)` — filter by agent
- Index: `(project_id, status, started_at DESC)` — filter by status

**`steps`** — each decision/action within a run
- `id` (UUID, PK)
- `run_id` (FK → agent_runs)
- `project_id` (FK → projects — denormalized for direct queries)
- `sequence_number` (integer)
- `type` (enum: thought, action, observation)
- `content` (text)
- `started_at` (timestamp)
- `finished_at` (timestamp, nullable)
- `metadata` (JSONB, default: {})
- Index: `(run_id, sequence_number)` — step replay, ordered
- Index: `(project_id, started_at DESC)` — cross-run step queries

**`tool_calls`** — every tool/API call the agent made
- `id` (UUID, PK)
- `step_id` (FK → steps)
- `run_id` (FK → agent_runs)
- `project_id` (FK → projects — denormalized for direct queries)
- `tool_name` (string)
- `input` (JSONB, default: {})
- `output` (JSONB, default: {})
- `status` (enum: success, error)
- `latency_ms` (integer)
- `error_message` (text, nullable)
- `started_at` (timestamp)
- Index: `(run_id)` — all tool calls for a run
- Index: `(project_id, tool_name, started_at DESC)` — performance page: slowest tools
- Index: `(project_id, latency_ms DESC)` — performance page: slowest calls

**`llm_calls`** — every LLM request/response
- `id` (UUID, PK)
- `step_id` (FK → steps)
- `run_id` (FK → agent_runs)
- `project_id` (FK → projects — denormalized for direct queries)
- `model` (string)
- `provider` (string)
- `prompt_tokens` (integer, default: 0)
- `completion_tokens` (integer, default: 0)
- `total_tokens` (integer, default: 0)
- `cost` (decimal, default: 0)
- `latency_ms` (integer)
- `temperature` (float, nullable)
- `messages` (JSONB, nullable — opt-in via `capturePrompts`)
- `response` (JSONB, nullable — opt-in via `capturePrompts`)
- `started_at` (timestamp)
- Index: `(run_id)` — all LLM calls for a run
- Index: `(project_id, model, started_at DESC)` — cost breakdown by model
- Index: `(project_id, latency_ms DESC)` — performance page: slowest LLM calls

### Alerting Tables

**`alert_rules`** — user-configured alert definitions
- `id` (UUID, PK)
- `project_id` (FK → projects)
- `name` (string)
- `type` (enum: error_spike, failure_rate, cost_threshold)
- `config` (JSONB — type-specific thresholds and windows, e.g. `{"threshold": 50, "window_minutes": 5}`)
- `webhook_url` (string)
- `enabled` (boolean, default: true)
- `last_triggered_at` (timestamp, nullable)
- `created_at` (timestamp)
- `updated_at` (timestamp)
- Index: `(project_id, enabled)` — alert evaluation job queries active rules

**`alert_history`** — log of triggered alerts
- `id` (UUID, PK)
- `rule_id` (FK → alert_rules)
- `project_id` (FK → projects)
- `triggered_at` (timestamp)
- `payload` (JSONB — snapshot of the data that triggered the alert)
- `webhook_status` (integer, nullable — HTTP status code of webhook delivery)
- Index: `(rule_id, triggered_at DESC)` — alert history for a rule
- Index: `(project_id, triggered_at DESC)` — project alert timeline

### Relationships

```
user
  └── sessions

project
  ├── event_groups (deduplicated issues)
  │    └── events (individual occurrences)
  ├── agent_runs
  │    ├── events (errors during this run, via events.run_id)
  │    └── steps (ordered sequence)
  │         ├── tool_calls
  │         └── llm_calls
  └── alert_rules
       └── alert_history
```

Key cross-links:
- `events.run_id` → `agent_runs.id`: errors that occurred during an agent run
- `project_id` is denormalized onto `steps`, `tool_calls`, `llm_calls` to avoid joins on high-traffic dashboard queries

## SDK (`@sentro/sdk`)

### Initialization

```typescript
import { Sentro } from '@sentro/sdk';

const sentro = new Sentro({
  dsn: 'http://token@localhost:3000/api/ingest/proj_1',
  capturePrompts: false, // opt-in: log full LLM messages
});
```

### Traditional Error Tracking

```typescript
sentro.captureException(error);
sentro.captureMessage('Something happened', 'warning');
sentro.setContext({ userId: '123', environment: 'production' });
sentro.setTags({ service: 'payment-worker', version: '1.2.0' });
```

### Agent Observability — Explicit API

```typescript
const run = sentro.startRun({
  agent: 'order-processor',
  goal: 'Process refund for order #456',
  model: 'claude-sonnet-4-6',
});

const step = run.step('Looking up order details');

const tool = step.toolCall('database.query', {
  input: { query: 'SELECT * FROM orders WHERE id = 456' },
});
tool.end({ result: { id: 456, status: 'shipped' } });

const llm = step.llmCall({
  model: 'claude-sonnet-4-6',
  messages: [{ role: 'user', content: 'Should we approve this refund?' }],
});
llm.end({ response: 'Yes, approve.', promptTokens: 150, completionTokens: 20 });

step.end();
run.end({ status: 'success' });
```

### Agent Observability — Wrapper API (80% case)

```typescript
const result = await sentro.trace('order-processor', {
  goal: 'Process refund for order #456',
  model: 'claude-sonnet-4-6',
}, async (run) => {
  return await run.trace('Looking up order', async (step) => {
    const order = await step.traceToolCall('db.query', input, async () => {
      return await db.query('SELECT * FROM orders WHERE id = 456');
    });
    return order;
  });
});
// auto-ends on return, auto-errors on throw
```

### Transport

- Events batched locally, flushed every 1s or when buffer hits 100 events.
- Single unified envelope format — one POST can carry mixed event types.
- If server is unreachable, events are dropped (no local queue for v1).
- Auto-captures timestamps, durations, token totals per run.
- Runs not explicitly ended are auto-marked `timeout` after configurable period.

### Payload Format

```json
{
  "dsn": "proj_1",
  "batch": [
    { "type": "event", "level": "error", "message": "...", "stackTrace": "..." },
    { "type": "run.start", "runId": "...", "agent": "order-processor" },
    { "type": "step", "runId": "...", "sequence": 1, "content": "..." },
    { "type": "tool_call", "stepId": "...", "tool": "db.query", "input": {} },
    { "type": "run.end", "runId": "...", "status": "success" }
  ]
}
```

## Event Ingestion & Processing

### Ingestion Flow

```
SDK POST /api/ingest
  → Validate payload (schema check, DSN auth)
  → Return 202 Accepted immediately
  → Add to in-memory batch buffer
  → Buffer flushes (1s interval or 100 events threshold):
      1. Fingerprint each event
      2. Upsert event_groups (increment count, update last_seen)
      3. Batch INSERT events, steps, tool_calls, llm_calls
```

### Fingerprinting

- **Errors:** group by exception type + top stack frame
- **Agent run failures:** group by agent_name + failure step + error type
- **Custom:** SDK can pass explicit `fingerprint` to override

### DSN Format

```
http://<token>@<host>/api/ingest/<project_id>
```

### Rate Limiting

In-memory counter per DSN. Configurable threshold (default: 1000 events/minute). Returns 429 when exceeded. Prevents buggy agents in loops from flooding the instance.

## Dashboard UI

### Pages

**1. Issues List** (`/projects/:id/issues`)
- Sentry-equivalent error list. Grouped by fingerprint.
- Columns: title, source location, event count, last seen, affected agent runs badge.
- Filters: unresolved / resolved / ignored. Sort by last seen, event count, first seen.

**2. Agent Runs** (`/projects/:id/runs`)
- Stats bar: total runs (24h), success rate, avg duration, total cost, tokens used.
- Run list: agent name, goal, status dot (green/red/yellow), step count, duration, cost, time ago.
- Filters: by agent name, status, time range.

**3. Run Detail / Step Replay** (`/projects/:id/runs/:runId`)
- Header: agent name, status badge, goal, duration, tokens, cost, model.
- Step timeline: numbered vertical timeline. Each step expandable to show tool calls and LLM calls with inputs/outputs.
- Failed steps highlighted in red with error details.

**4. Performance** (`/projects/:id/performance`)
- Agent run durations over time (line chart).
- Slowest tool calls (table).
- LLM call latency distribution.
- Basic — not rebuilding Grafana.

**5. Alerts** (`/projects/:id/alerts`)
- List of configured alert rules with status (active/triggered/disabled).
- Create/edit alert form.

### Navigation

Top nav: Sentro logo → project selector → Issues | Agent Runs | Performance | Alerts

### Design System

Tailwind CSS + shadcn/ui components. Dark theme default (the data looks better on dark backgrounds). Recharts for all charting.

## Authentication

Single-user setup for v1. Email + password configured on first launch (setup wizard). Session-based auth with HTTP-only cookies. No teams, roles, or SSO — those are SaaS features.

## Alerting

### Alert Types (v1)

1. **Error spike** — event count for a group exceeds threshold in time window (e.g., >50 in 5 minutes)
2. **Agent failure rate** — success rate for an agent drops below threshold (e.g., <90% in 1 hour)
3. **Cost threshold** — total spend for an agent/project exceeds limit (e.g., >$50/day)

### Evaluation

pg-boss background job runs every 60 seconds. Evaluates all active alert rules against current data.

### Notifications (v1)

Webhooks only — POST JSON payload to a configured URL. Users point these at Slack, Discord, PagerDuty, or custom endpoints. Keeps scope tight.

## Data Retention

Configurable retention policy per project. Default: 30 days. pg-boss cleanup job runs daily, deletes events older than the retention window. Event groups are kept (with counts) even after individual events are purged.

## Project Structure

```
sentro/
├── apps/
│   └── web/                    # Next.js 15 app
│       ├── app/
│       │   ├── (dashboard)/    # Dashboard pages
│       │   │   ├── projects/
│       │   │   ├── issues/
│       │   │   ├── runs/
│       │   │   ├── performance/
│       │   │   └── alerts/
│       │   ├── api/            # API routes
│       │   │   ├── ingest/
│       │   │   ├── events/
│       │   │   ├── runs/
│       │   │   ├── projects/
│       │   │   └── alerts/
│       │   └── setup/          # First-launch setup wizard
│       ├── lib/
│       │   ├── db/             # Prisma schema + queries
│       │   ├── ingestion/      # Buffer, fingerprinting, processing
│       │   ├── alerts/         # Alert evaluation engine
│       │   └── auth/           # Session auth
│       └── components/         # React components (shadcn/ui)
├── packages/
│   └── sdk/                    # @sentro/sdk
│       ├── src/
│       │   ├── client.ts       # Main Sentro class
│       │   ├── run.ts          # Agent run tracking
│       │   ├── step.ts         # Step tracking
│       │   ├── transport.ts    # HTTP batching + flush
│       │   └── types.ts        # Shared types
│       └── package.json
├── docker-compose.yml          # App + Postgres
├── Dockerfile
├── turbo.json
└── package.json
```

## Tech Stack

| Layer | Choice | Reason |
|-------|--------|--------|
| Framework | Next.js 15 (App Router) | SSR dashboard + API routes in one app |
| ORM | Prisma | Type-safe DB access, schema migrations |
| Database | PostgreSQL 16 | Reliable, JSONB, partitioning support |
| Job Queue | pg-boss | Postgres-backed, no extra infrastructure |
| Monorepo | Turborepo | Fast builds, simple workspace config |
| Styling | Tailwind CSS + shadcn/ui | Rapid UI development, consistent design |
| Charts | Recharts | Lightweight, React-native, composable |
| Auth | Custom (bcrypt + sessions) | Simple single-user, no OAuth complexity |
| Deployment | Docker Compose | Self-hosted simplicity: `docker-compose up` |

## v1.1 Roadmap (out of scope for v1)

- **Python SDK** — port the TypeScript SDK for the AI/ML ecosystem
- **Framework integrations** — auto-instrumentation for LangChain, CrewAI, Vercel AI SDK
- **Drift / guardrail alerts** — detect looping agents, token burn, repeated tool calls
- **Session replay UI** — animated step-by-step replay with timeline scrubbing
- **Source maps** — upload and deobfuscate minified stack traces
- **Teams & RBAC** — multi-user access with roles (for SaaS path)
