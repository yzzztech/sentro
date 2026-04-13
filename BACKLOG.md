# Backlog

Ideas captured for future work. Not sequenced, not committed.

## Integrations (README-promised, need to ship)

- [ ] **Claude Code install script** — `curl | bash` that registers Sentro as a Claude Code hook and traces every session
- [ ] **OpenClaw skill** — auto-instrument OpenClaw agent runs, track tool calls (file, shell, browser) and LLM calls. Needs research into OpenClaw plugin API
- [ ] **LangChain callback handler** — `from sentro.integrations.langchain import SentroMiddleware`. Subclass `BaseCallbackHandler`, route events to SDK
- [ ] **CrewAI listener** — `from sentro.integrations.crewai import SentroCrewListener`. Hook into CrewAI's event system for crew tasks
- [ ] **Vercel AI SDK middleware** — `@sentro/vercel-ai` package that wraps `generateText`/`streamText` and traces LLM calls

## Adoption

- [ ] **Example apps repo** — real agents using Sentro (RAG bot, code reviewer, support agent)
- [ ] **One-click deploy buttons** — Railway, Render, Fly.io badges in README
- [ ] **Demo GIF in README** — show step replay in action
- [ ] **Landing page** — marketing site with waitlist for hosted SaaS
- [ ] **Video walkthrough** — screencast of setup → first trace → debug a failing agent

## Features

- [ ] **Search across errors/runs** — full-text + filter by agent, model, cost, date
- [ ] **Email notifications** — not just webhooks; for people who don't run other agents
- [ ] **Slack/Discord native integrations** — slash commands, not just webhook URLs
- [ ] **Drift/guardrail alerts** — detect looping agents, token burn, repeated tool calls
- [ ] **Session replay UI** — animated step-by-step replay with timeline scrubbing
- [ ] **Source maps** — deobfuscate minified stack traces
- [ ] **Cost budgets** — set monthly/daily caps, alert on pace
- [ ] **Custom dashboards** — user-defined metric panels

## Infrastructure

- [ ] **Redis + BullMQ** — replace pg-boss for horizontal scaling
- [ ] **ClickHouse** — analytical queries over billions of events
- [ ] **Kubernetes Helm chart** — official chart for enterprise deploys
- [ ] **Multi-region** — geo-distributed ingest endpoints
- [ ] **Prometheus/Grafana export** — metrics for teams already on that stack

## Polish

- [ ] **SECURITY.md** — responsible disclosure policy
- [ ] **Issue templates** — bug report, feature request, integration request
- [ ] **GitHub Discussions** — enable, seed with FAQ
- [ ] **Code of Conduct**
- [ ] **OpenAPI spec** — generated from Next.js API routes
- [ ] **Blog post** — "Why we built Sentro" with architecture + design decisions
- [ ] **E2E tests** — Playwright for the dashboard
- [ ] **Load testing** — verify ingest handles claimed throughput
- [ ] **Accessibility audit** — WCAG 2.1 AA on the dashboard
