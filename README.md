# Sentro

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

## Roadmap

- [ ] **Python SDK** — for the AI/ML ecosystem
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
