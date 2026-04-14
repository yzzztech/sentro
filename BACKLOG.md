# Backlog

Sentro's forward roadmap — tracked publicly. Vote via GitHub issues. Last updated: 2026-04-14.

## Shipped (v0.2.0)

- [x] **Session grouping** — group related runs into conversation threads (`sessionId`, `userId` on AgentRun, `/api/projects/:id/sessions`)
- [x] **LLM proxy mode** — zero-code instrumentation via `/api/v1/proxy/chat/completions` (OpenAI) and `/api/v1/proxy/messages` (Anthropic)
- [x] **Prompt management** — Prompt/PromptVersion models, CRUD API, `sentro.getPrompt()` / `sentro.get_prompt()` in SDKs
- [x] **Evals / scoring** — Score model, `sentro.score(runId, name, value)` in both SDKs; supports human, LLM-as-judge, programmatic
- [x] **Drift and guardrail alerts** — auto-detect looping agents, token burn, repeated tool calls; fires `drift_detected` webhook
- [x] **Datasets** — save runs as test fixtures, `sentro.getDataset(name)` / `sentro.get_dataset(name)`; import runs as items

## Shipped (v0.1.1)

- [x] TypeScript SDK on [npm](https://www.npmjs.com/package/@sentro/sdk)
- [x] Python SDK on [PyPI](https://pypi.org/project/sentro-sdk/)
- [x] Code coverage: TS 96%, Python 94%
- [x] Event webhooks (5 event types, HMAC signing, filters)
- [x] Security hardening: SSRF protection, rate limiting, session cleanup
- [x] GitHub Actions CI pipeline
- [x] CORS middleware for cross-origin SDKs
- [x] Framework integrations: Claude Code, OpenClaw, LangChain, CrewAI, Vercel AI SDK
- [x] One-line installers for Claude Code and OpenClaw
- [x] **OTLP ingestion** — accept OpenTelemetry traces at `/api/v1/traces`

## Up Next (ordered by bang-for-buck)

### Tier 2 — Differentiating

- [ ] **Session replay UI** — animated timeline scrubbing with step-by-step playback
- [ ] **Playground** — edit and re-run any LLM call from the UI
- [ ] **Dataset run evaluations** — execute dataset items through an agent endpoint, auto-score against expectedOutput
- [ ] **Dashboard pages** for sessions, prompts, scores, datasets (backend APIs exist; UI pending)

### Tier 3 — Scale & enterprise

- [ ] **Source maps** — deobfuscate minified stack traces
- [ ] **Redis** — caching + BullMQ job queue
- [ ] **ClickHouse** — event analytics at scale
- [ ] **SaaS mode** — multi-tenancy, teams, RBAC
- [ ] **SSO / SAML**
- [ ] **Audit log**
- [ ] **Grafana dashboard template**

### Tier 4 — Nice to have

- [ ] Helm chart / Railway / Render / Fly.io one-click deploy
- [ ] Demo/seed data script
- [ ] Screenshots in README
- [ ] OTLP protobuf format (currently JSON only)
- [ ] OTLP gRPC endpoint

## Contributing

Pick anything from this list and open a PR. For larger items, open an issue first to align on approach.
