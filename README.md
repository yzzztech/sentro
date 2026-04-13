# Sentro

[![npm](https://img.shields.io/npm/v/@sentro/sdk?label=npm)](https://www.npmjs.com/package/@sentro/sdk)
[![PyPI](https://img.shields.io/pypi/v/sentro-sdk?label=pypi)](https://pypi.org/project/sentro-sdk/)
[![TS Coverage](https://img.shields.io/badge/coverage--TS-96%25-brightgreen)](packages/sdk)
[![Python Coverage](https://img.shields.io/badge/coverage--Python-94%25-brightgreen)](packages/sdk-python)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)

### Sentry was built for humans. Sentro was built for agents.

**Sentro** is an open-source error tracking and observability platform designed from the ground up for AI agents. It does everything Sentry does — error tracking, performance monitoring, alerting — plus first-class agent observability: run tracing, step-by-step replay, tool call monitoring, LLM call tracking, and cost analysis.

> **See what your agent was thinking when it broke — and how much it cost you.**

---

## Why Sentro?

Sentry shows you **what broke**. Sentro shows you the full story:

| | Sentry | Sentro |
|---|---|---|
| Error tracking | Yes | Yes |
| Stack traces | Yes | Yes |
| Issue grouping | Yes | Yes |
| Performance monitoring | Yes | Yes |
| Alerting | Yes | Yes |
| **Agent run tracing** | No | **Yes** |
| **Step-by-step replay** | No | **Yes** |
| **Tool call monitoring** | No | **Yes** |
| **LLM call tracking** | No | **Yes** |
| **Token & cost tracking** | No | **Yes** |
| **Agent failure analysis** | No | **Yes** |
| **Event webhooks** | Limited | **Yes — 5 event types, HMAC signing, filters** |

---

## Quick Start

```bash
git clone https://github.com/yzzztech/sentro.git
cd sentro
docker compose up -d
```

Open **http://localhost:3000**, create your admin account, and you're live.

---

## SDK — 5 Lines to Full Agent Observability

```bash
npm install @sentro/sdk
```

### Track errors (like Sentry)

```typescript
import { Sentro } from '@sentro/sdk';

const sentro = new Sentro({ dsn: 'http://token@localhost:3000/api/ingest/proj_1' });

sentro.captureException(new Error('Payment failed'));
```

### Track agent runs (what Sentry can't do)

```typescript
const result = await sentro.trace('order-processor', {
  goal: 'Process refund for order #456',
  model: 'claude-sonnet-4-6',
}, async (run) => {

  return await run.trace('Looking up order', async (step) => {
    // Track tool calls
    const order = await step.traceToolCall('database.query', 
      { sql: 'SELECT * FROM orders WHERE id = 456' },
      async () => db.query('SELECT * FROM orders WHERE id = 456')
    );

    // Track LLM calls
    const llm = step.llmCall({ model: 'claude-sonnet-4-6' });
    const decision = await callLLM('Should we approve this refund?');
    llm.end({ promptTokens: 150, completionTokens: 20, cost: 0.001 });

    return decision;
  });
});
// Automatically captures: duration, tokens, cost, success/failure
```

### Python SDK

```bash
pip install sentro-sdk
```

Zero dependencies. Pythonic context managers. Async support.

```python
from sentro import Sentro

sentro = Sentro(dsn="http://token@localhost:3000/api/ingest/proj_1")

# Error tracking
sentro.capture_exception(error)

# Agent observability with context managers
with sentro.trace("order-processor", goal="Process refund #456") as run:
    with run.trace("Looking up order") as step:
        with step.trace_tool_call("db.query", input={"sql": "SELECT 1"}) as tool:
            result = db.query("SELECT 1")
            tool.set_result(result)
        
        llm = step.llm_call(model="claude-sonnet-4-6")
        response = call_llm("Approve refund?")
        llm.end(prompt_tokens=150, completion_tokens=20, cost=0.001)
# Auto-ends on exit, auto-errors on exception
```

---

## The Dashboard

### Issues — Sentry-style error tracking
Errors grouped by fingerprint, with event counts, recency, and a badge showing how many **agent runs** were affected.

### Agent Runs — the flagship view
Every agent execution with: status, step count, duration, cost, and token usage. Stats bar shows success rate, total cost, and aggregate metrics.

### Step Replay — the killer feature
A vertical timeline of every step the agent took. Expand each step to see tool call inputs/outputs and LLM call details. See exactly **where and why** the agent failed.

### Performance
Slowest tool calls, LLM latency by model, cost breakdown. Find the bottlenecks in your agent's workflow.

### Alerts
Three alert types: error spike, agent failure rate, cost threshold. Webhook notifications to Slack, Discord, PagerDuty, or anywhere.

---

## Architecture

```
[Your Agents] → [@sentro/sdk] → POST /api/ingest → [Next.js App] → [PostgreSQL]
                                                     ├── Dashboard UI
                                                     ├── REST API
                                                     └── Background Jobs (pg-boss)

Deployment: docker compose up → 2 containers (app + postgres)
```

**Scalability-ready monolith.** Simple to deploy today, designed to scale tomorrow:

| Stage | What changes |
|-------|-------------|
| **v1 (now)** | App + Postgres — `docker compose up` |
| **v1.5** | Add Redis for caching + job queue |
| **v2** | Separate ingestion service |
| **v2.5** | Add ClickHouse for event analytics |

---

## Tech Stack

- **TypeScript** everywhere — one language, frontend to SDK
- **Next.js 15** App Router — SSR dashboard + API in one process
- **PostgreSQL** — JSONB for flexible payloads, battle-tested
- **Prisma** — type-safe database access
- **Tailwind CSS** + dark theme — looks good out of the box
- **pg-boss** — Postgres-backed job queue, no Redis needed for v1
- **Docker Compose** — self-hosted in one command

---

## Core Data Model

```
project
  ├── event_groups (deduplicated issues)
  │    └── events (individual errors/logs)
  ├── agent_runs
  │    └── steps (ordered reasoning chain)
  │         ├── tool_calls (with inputs, outputs, latency)
  │         └── llm_calls (with tokens, cost, latency)
  └── alert_rules
       └── alert_history
```

The `run → step → tool_call/llm_call` hierarchy is the core differentiator. It maps directly to how agents actually work.

---

## Documentation

Full documentation available at `/docs` when running, or open `apps/web/public/docs/index.html` directly.

Covers: SDK guide, dashboard walkthrough, API reference, configuration, self-hosting, and architecture.

---

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | — | PostgreSQL connection string |
| `SESSION_SECRET` | — | Secret for session cookies |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | Public URL of the app |

Per-project settings (configurable via API/dashboard):
- **Retention days** — how long to keep event data (default: 30)
- **Rate limit** — max events per minute per project (default: 1000)

---

## Event Webhooks — Agents Monitoring Agents

Sentro fires real-time webhooks when things happen, so other agents can react automatically.

| Event | Fires when |
|-------|-----------|
| `error.new` | First occurrence of a new error |
| `error.regression` | A resolved error comes back |
| `run.failed` | An agent run fails or times out |
| `run.completed` | Any agent run finishes |
| `cost.spike` | A run exceeds your cost threshold |

**Rich payloads** — every webhook includes full context (error details, run steps, token counts, cost) so the receiving agent can act without calling back.

**HMAC signing** — optional `X-Sentro-Signature` header for payload verification.

**Filters** — scope webhooks by agent name, error level, or cost threshold.

**Example: auto-create GitHub issues on new errors**
```
Sentro → error.new webhook → your agent → gh issue create
```

---

## Roadmap

- [x] **TypeScript SDK** — published on [npm](https://www.npmjs.com/package/@sentro/sdk), batched transport, trace wrapper API, 21 tests
- [x] **Python SDK** — published on [PyPI](https://pypi.org/project/sentro-sdk/), zero dependencies, context managers, async support, 23 tests
- [x] **Event webhooks** — real-time webhooks with HMAC signing and filters
- [x] **Security hardening** — SSRF protection, login rate limiting, setup race fix, ingest validation, session cleanup
- [x] **CI/CD pipeline** — GitHub Actions with tests, build, and security audit on every PR
- [x] **CORS middleware** — cross-origin support for browser-based SDKs
- [ ] **Framework integrations** — auto-instrumentation for LangChain, CrewAI, Vercel AI SDK
- [ ] **Drift / guardrail alerts** — detect looping agents, token burn, repeated tool calls
- [ ] **Session replay UI** — animated step-by-step replay with timeline scrubbing
- [ ] **Source maps** — deobfuscate minified stack traces
- [ ] **Redis** — caching + BullMQ job queue
- [ ] **ClickHouse** — event analytics at scale
- [ ] **SaaS mode** — multi-tenancy, teams, RBAC

---

## Contributing

Sentro is open source. PRs welcome.

```bash
# Development
git clone https://github.com/yzzztech/sentro.git
cd sentro
npm install
docker run --name sentro-db -e POSTGRES_USER=sentro -e POSTGRES_PASSWORD=sentro -e POSTGRES_DB=sentro -p 5432:5432 -d postgres:16-alpine
cd apps/web && npx prisma db push
cd ../.. && npm run dev
```

---

## License

MIT

---

<p align="center">
  <strong>Sentro</strong> — because your agents deserve better than stack traces.
</p>
