# Backlog

Sentro's forward roadmap — tracked publicly. Vote via GitHub issues. Last updated: 2026-04-14.

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

### Tier 1 — Massive impact

- [ ] **Session grouping** — group related runs into a session thread (for chat apps). Inspired by LangSmith.
- [ ] **LLM proxy mode** — sit at `/v1/chat/completions`, forward to OpenAI/Anthropic, auto-instrument. Inspired by Helicone.
- [ ] **Prompt management** — version prompts, tag them (staging/prod), `sentro.get_prompt("name")` in SDK. Inspired by Langfuse.

### Tier 2 — Differentiating

- [ ] **Evals / scoring** — score runs on correctness, helpfulness, latency. Human labels + LLM-as-judge. Inspired by Langfuse + Braintrust.
- [ ] **Drift / guardrail alerts** — detect looping agents, token burn, repeated tool calls
- [ ] **Session replay UI** — animated timeline scrubbing with step-by-step playback
- [ ] **Datasets** — save runs as test fixtures, re-run against new versions
- [ ] **Playground** — edit and re-run any LLM call from the UI

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
