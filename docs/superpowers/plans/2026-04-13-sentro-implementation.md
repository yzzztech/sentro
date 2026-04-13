# Sentro Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a self-hosted error tracking and agent observability platform — Sentry for AI agents.

**Architecture:** Next.js 15 monolith with PostgreSQL. Turborepo monorepo with `apps/web` (dashboard + API) and `packages/sdk` (TypeScript SDK). Batch ingestion with in-memory buffer, pg-boss background jobs, session-based auth.

**Tech Stack:** TypeScript, Next.js 15 (App Router), Prisma, PostgreSQL 16, pg-boss, Turborepo, Tailwind CSS, shadcn/ui, Recharts, Docker Compose.

---

## File Structure

```
sentro/
├── apps/
│   └── web/
│       ├── app/
│       │   ├── layout.tsx                    # Root layout with providers
│       │   ├── page.tsx                      # Redirect to /projects or /setup
│       │   ├── setup/
│       │   │   └── page.tsx                  # First-launch setup wizard
│       │   ├── login/
│       │   │   └── page.tsx                  # Login page
│       │   ├── (dashboard)/
│       │   │   ├── layout.tsx                # Dashboard shell (nav, project selector)
│       │   │   ├── projects/
│       │   │   │   ├── page.tsx              # Project list
│       │   │   │   └── new/page.tsx          # Create project
│       │   │   ├── [projectId]/
│       │   │   │   ├── layout.tsx            # Project-scoped layout (tabs)
│       │   │   │   ├── issues/
│       │   │   │   │   ├── page.tsx          # Issues list
│       │   │   │   │   └── [groupId]/page.tsx # Issue detail (event list)
│       │   │   │   ├── runs/
│       │   │   │   │   ├── page.tsx          # Agent runs list
│       │   │   │   │   └── [runId]/page.tsx  # Run detail (step replay)
│       │   │   │   ├── performance/
│       │   │   │   │   └── page.tsx          # Performance dashboard
│       │   │   │   └── alerts/
│       │   │   │       ├── page.tsx          # Alert rules list
│       │   │   │       └── new/page.tsx      # Create/edit alert rule
│       │   └── api/
│       │       ├── ingest/
│       │       │   └── route.ts              # POST /api/ingest — event ingestion
│       │       ├── auth/
│       │       │   ├── login/route.ts        # POST /api/auth/login
│       │       │   ├── logout/route.ts       # POST /api/auth/logout
│       │       │   └── setup/route.ts        # POST /api/auth/setup
│       │       ├── projects/
│       │       │   └── route.ts              # GET/POST /api/projects
│       │       ├── projects/[projectId]/
│       │       │   ├── route.ts              # GET/PATCH/DELETE project
│       │       │   ├── issues/route.ts       # GET issues
│       │       │   ├── issues/[groupId]/route.ts  # GET/PATCH issue
│       │       │   ├── events/route.ts       # GET events for issue
│       │       │   ├── runs/route.ts         # GET agent runs
│       │       │   ├── runs/[runId]/route.ts # GET run detail with steps
│       │       │   ├── performance/route.ts  # GET performance metrics
│       │       │   ├── alerts/route.ts       # GET/POST alert rules
│       │       │   └── alerts/[alertId]/route.ts # PATCH/DELETE alert rule
│       │       └── health/route.ts           # GET /api/health
│       ├── lib/
│       │   ├── db/
│       │   │   ├── prisma.ts                 # Prisma client singleton
│       │   │   └── schema.prisma             # Prisma schema
│       │   ├── ingestion/
│       │   │   ├── buffer.ts                 # In-memory batch buffer
│       │   │   ├── fingerprint.ts            # Event fingerprinting logic
│       │   │   ├── processor.ts              # Flush handler: write batches to DB
│       │   │   └── validate.ts               # Payload schema validation
│       │   ├── auth/
│       │   │   ├── session.ts                # Session create/validate/destroy
│       │   │   ├── password.ts               # bcrypt hash/verify
│       │   │   └── middleware.ts             # Auth middleware for API routes
│       │   ├── alerts/
│       │   │   ├── evaluator.ts              # Alert rule evaluation engine
│       │   │   └── webhook.ts                # Webhook delivery
│       │   └── jobs/
│       │       ├── worker.ts                 # pg-boss worker setup
│       │       ├── alert-check.ts            # Alert evaluation job
│       │       └── cleanup.ts                # Data retention cleanup job
│       ├── components/
│       │   ├── nav.tsx                       # Top navigation bar
│       │   ├── project-selector.tsx          # Project dropdown
│       │   ├── issues-table.tsx              # Issues list table
│       │   ├── runs-table.tsx                # Agent runs list table
│       │   ├── run-stats.tsx                 # Stats bar (total runs, success rate, etc.)
│       │   ├── step-timeline.tsx             # Step replay timeline
│       │   ├── tool-call-detail.tsx          # Tool call expandable detail
│       │   ├── llm-call-detail.tsx           # LLM call expandable detail
│       │   ├── alert-form.tsx                # Alert rule create/edit form
│       │   ├── performance-charts.tsx        # Performance page charts
│       │   └── ui/                           # shadcn/ui components (auto-generated)
│       ├── next.config.ts
│       ├── tailwind.config.ts
│       ├── tsconfig.json
│       └── package.json
├── packages/
│   └── sdk/
│       ├── src/
│       │   ├── index.ts                      # Public exports
│       │   ├── client.ts                     # Sentro class — main entry point
│       │   ├── run.ts                        # SentroRun class
│       │   ├── step.ts                       # SentroStep class
│       │   ├── tool-call.ts                  # SentroToolCall class
│       │   ├── llm-call.ts                   # SentroLlmCall class
│       │   ├── transport.ts                  # HTTP batching + flush
│       │   └── types.ts                      # Shared type definitions
│       ├── tests/
│       │   ├── client.test.ts                # Sentro class tests
│       │   ├── run.test.ts                   # Run tracking tests
│       │   ├── step.test.ts                  # Step tracking tests
│       │   ├── transport.test.ts             # Batching + flush tests
│       │   └── integration.test.ts           # Full SDK flow test
│       ├── tsconfig.json
│       ├── vitest.config.ts
│       └── package.json
├── docker-compose.yml
├── Dockerfile
├── .env.example
├── turbo.json
├── package.json
└── tsconfig.json
```

---

### Task 1: Monorepo Scaffold

**Files:**
- Create: `package.json` (root)
- Create: `turbo.json`
- Create: `tsconfig.json` (root)
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/next.config.ts`
- Create: `packages/sdk/package.json`
- Create: `packages/sdk/tsconfig.json`
- Create: `packages/sdk/vitest.config.ts`
- Create: `.env.example`
- Create: `.gitignore`

- [ ] **Step 1: Create root package.json with workspaces**

```json
{
  "name": "sentro",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "test": "turbo test",
    "lint": "turbo lint",
    "db:push": "cd apps/web && npx prisma db push",
    "db:generate": "cd apps/web && npx prisma generate",
    "db:studio": "cd apps/web && npx prisma studio"
  },
  "devDependencies": {
    "turbo": "^2.4.0",
    "typescript": "^5.7.0"
  },
  "packageManager": "npm@10.9.0"
}
```

- [ ] **Step 2: Create turbo.json**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "dev": {
      "cache": false,
      "persistent": true
    },
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**"]
    },
    "test": {
      "dependsOn": ["^build"]
    },
    "lint": {}
  }
}
```

- [ ] **Step 3: Create root tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

- [ ] **Step 4: Create apps/web/package.json**

```json
{
  "name": "@sentro/web",
  "private": true,
  "version": "0.1.0",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "^15.3.0",
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "@prisma/client": "^6.5.0",
    "pg-boss": "^10.1.0",
    "bcryptjs": "^3.0.0",
    "zod": "^3.24.0",
    "recharts": "^2.15.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^3.0.0",
    "lucide-react": "^0.475.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@types/bcryptjs": "^2.4.0",
    "prisma": "^6.5.0",
    "typescript": "^5.7.0",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/postcss": "^4.0.0",
    "postcss": "^8.5.0"
  }
}
```

- [ ] **Step 5: Create apps/web/next.config.ts**

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@sentro/sdk"],
};

export default nextConfig;
```

- [ ] **Step 6: Create apps/web/tsconfig.json**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "jsx": "preserve",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "paths": {
      "@/*": ["./*"]
    },
    "plugins": [{ "name": "next" }],
    "incremental": true,
    "noEmit": true
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 7: Create packages/sdk/package.json**

```json
{
  "name": "@sentro/sdk",
  "version": "0.1.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": ["dist"],
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest",
    "dev": "tsc --watch"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "vitest": "^3.1.0"
  }
}
```

- [ ] **Step 8: Create packages/sdk/tsconfig.json**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src"],
  "exclude": ["dist", "node_modules", "tests"]
}
```

- [ ] **Step 9: Create packages/sdk/vitest.config.ts**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
  },
});
```

- [ ] **Step 10: Create .env.example**

```bash
# Database
DATABASE_URL="postgresql://sentro:sentro@localhost:5432/sentro?schema=public"

# Auth
SESSION_SECRET="change-me-to-a-random-string"

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

- [ ] **Step 11: Create .gitignore**

```
node_modules/
.next/
dist/
.env
.env.local
*.tsbuildinfo
.superpowers/
```

- [ ] **Step 12: Install dependencies and verify**

Run: `npm install`
Expected: Clean install, no peer dep errors.

Run: `npx turbo build --dry-run`
Expected: Shows task graph for `@sentro/web#build` and `@sentro/sdk#build`.

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "feat: scaffold monorepo with turborepo, next.js, and sdk package"
```

---

### Task 2: Prisma Schema & Database

**Files:**
- Create: `apps/web/lib/db/schema.prisma`
- Create: `apps/web/lib/db/prisma.ts`

- [ ] **Step 1: Create Prisma schema**

```prisma
// apps/web/lib/db/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id           String    @id @default(uuid())
  email        String    @unique
  passwordHash String    @map("password_hash")
  createdAt    DateTime  @default(now()) @map("created_at")
  updatedAt    DateTime  @updatedAt @map("updated_at")
  sessions     Session[]

  @@map("users")
}

model Session {
  id        String   @id @default(uuid())
  userId    String   @map("user_id")
  token     String   @unique
  expiresAt DateTime @map("expires_at")
  createdAt DateTime @default(now()) @map("created_at")
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([token])
  @@map("sessions")
}

model Project {
  id                 String       @id @default(uuid())
  name               String
  dsnToken           String       @unique @map("dsn_token")
  retentionDays      Int          @default(30) @map("retention_days")
  rateLimitPerMinute Int          @default(1000) @map("rate_limit_per_minute")
  createdAt          DateTime     @default(now()) @map("created_at")
  updatedAt          DateTime     @updatedAt @map("updated_at")
  eventGroups        EventGroup[]
  events             Event[]
  agentRuns          AgentRun[]
  steps              Step[]
  toolCalls          ToolCall[]
  llmCalls           LlmCall[]
  alertRules         AlertRule[]
  alertHistory       AlertHistory[]

  @@map("projects")
}

enum EventLevel {
  error
  warning
  info
  debug
}

enum GroupStatus {
  open
  resolved
  ignored
}

model EventGroup {
  id          String      @id @default(uuid())
  projectId   String      @map("project_id")
  fingerprint String
  title       String
  level       EventLevel  @default(error)
  firstSeen   DateTime    @map("first_seen")
  lastSeen    DateTime    @map("last_seen")
  count       Int         @default(0)
  status      GroupStatus @default(open)
  createdAt   DateTime    @default(now()) @map("created_at")
  updatedAt   DateTime    @updatedAt @map("updated_at")
  project     Project     @relation(fields: [projectId], references: [id], onDelete: Cascade)
  events      Event[]

  @@unique([projectId, fingerprint])
  @@index([projectId, status, lastSeen(sort: Desc)])
  @@map("event_groups")
}

model Event {
  id          String     @id @default(uuid())
  projectId   String     @map("project_id")
  groupId     String     @map("group_id")
  runId       String?    @map("run_id")
  fingerprint String
  level       EventLevel
  message     String
  stackTrace  String?    @map("stack_trace")
  tags        Json       @default("{}")
  context     Json       @default("{}")
  timestamp   DateTime
  receivedAt  DateTime   @default(now()) @map("received_at")
  project     Project    @relation(fields: [projectId], references: [id], onDelete: Cascade)
  group       EventGroup @relation(fields: [groupId], references: [id], onDelete: Cascade)
  run         AgentRun?  @relation(fields: [runId], references: [id], onDelete: SetNull)

  @@index([groupId, timestamp(sort: Desc)])
  @@index([projectId, receivedAt(sort: Desc)])
  @@index([runId])
  @@map("events")
}

enum RunStatus {
  running
  success
  failure
  timeout
}

model AgentRun {
  id           String    @id @default(uuid())
  projectId    String    @map("project_id")
  agentName    String    @map("agent_name")
  trigger      String?
  goal         String?
  model        String?
  status       RunStatus @default(running)
  totalTokens  Int       @default(0) @map("total_tokens")
  totalCost    Decimal   @default(0) @map("total_cost") @db.Decimal(12, 6)
  errorType    String?   @map("error_type")
  errorMessage String?   @map("error_message")
  startedAt    DateTime  @map("started_at")
  finishedAt   DateTime? @map("finished_at")
  metadata     Json      @default("{}")
  project      Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
  steps        Step[]
  toolCalls    ToolCall[]
  llmCalls     LlmCall[]
  events       Event[]

  @@index([projectId, startedAt(sort: Desc)])
  @@index([projectId, agentName, startedAt(sort: Desc)])
  @@index([projectId, status, startedAt(sort: Desc)])
  @@map("agent_runs")
}

enum StepType {
  thought
  action
  observation
}

model Step {
  id             String    @id @default(uuid())
  runId          String    @map("run_id")
  projectId      String    @map("project_id")
  sequenceNumber Int       @map("sequence_number")
  type           StepType  @default(action)
  content        String
  startedAt      DateTime  @map("started_at")
  finishedAt     DateTime? @map("finished_at")
  metadata       Json      @default("{}")
  run            AgentRun  @relation(fields: [runId], references: [id], onDelete: Cascade)
  project        Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
  toolCalls      ToolCall[]
  llmCalls       LlmCall[]

  @@index([runId, sequenceNumber])
  @@index([projectId, startedAt(sort: Desc)])
  @@map("steps")
}

enum CallStatus {
  success
  error
}

model ToolCall {
  id           String     @id @default(uuid())
  stepId       String     @map("step_id")
  runId        String     @map("run_id")
  projectId    String     @map("project_id")
  toolName     String     @map("tool_name")
  input        Json       @default("{}")
  output       Json       @default("{}")
  status       CallStatus @default(success)
  latencyMs    Int        @map("latency_ms")
  errorMessage String?    @map("error_message")
  startedAt    DateTime   @map("started_at")
  step         Step       @relation(fields: [stepId], references: [id], onDelete: Cascade)
  run          AgentRun   @relation(fields: [runId], references: [id], onDelete: Cascade)
  project      Project    @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([runId])
  @@index([projectId, toolName, startedAt(sort: Desc)])
  @@index([projectId, latencyMs(sort: Desc)])
  @@map("tool_calls")
}

model LlmCall {
  id               String   @id @default(uuid())
  stepId           String   @map("step_id")
  runId            String   @map("run_id")
  projectId        String   @map("project_id")
  model            String
  provider         String
  promptTokens     Int      @default(0) @map("prompt_tokens")
  completionTokens Int      @default(0) @map("completion_tokens")
  totalTokens      Int      @default(0) @map("total_tokens")
  cost             Decimal  @default(0) @db.Decimal(12, 6)
  latencyMs        Int      @map("latency_ms")
  temperature      Float?
  messages         Json?
  response         Json?
  startedAt        DateTime @map("started_at")
  step             Step     @relation(fields: [stepId], references: [id], onDelete: Cascade)
  run              AgentRun @relation(fields: [runId], references: [id], onDelete: Cascade)
  project          Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([runId])
  @@index([projectId, model, startedAt(sort: Desc)])
  @@index([projectId, latencyMs(sort: Desc)])
  @@map("llm_calls")
}

enum AlertType {
  error_spike
  failure_rate
  cost_threshold
}

model AlertRule {
  id              String         @id @default(uuid())
  projectId       String         @map("project_id")
  name            String
  type            AlertType
  config          Json
  webhookUrl      String         @map("webhook_url")
  enabled         Boolean        @default(true)
  lastTriggeredAt DateTime?      @map("last_triggered_at")
  createdAt       DateTime       @default(now()) @map("created_at")
  updatedAt       DateTime       @updatedAt @map("updated_at")
  project         Project        @relation(fields: [projectId], references: [id], onDelete: Cascade)
  history         AlertHistory[]

  @@index([projectId, enabled])
  @@map("alert_rules")
}

model AlertHistory {
  id            String    @id @default(uuid())
  ruleId        String    @map("rule_id")
  projectId     String    @map("project_id")
  triggeredAt   DateTime  @map("triggered_at")
  payload       Json
  webhookStatus Int?      @map("webhook_status")
  rule          AlertRule @relation(fields: [ruleId], references: [id], onDelete: Cascade)
  project       Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([ruleId, triggeredAt(sort: Desc)])
  @@index([projectId, triggeredAt(sort: Desc)])
  @@map("alert_history")
}
```

- [ ] **Step 2: Create Prisma client singleton**

```typescript
// apps/web/lib/db/prisma.ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

- [ ] **Step 3: Start Postgres and push schema**

Run: `docker run --name sentro-db -e POSTGRES_USER=sentro -e POSTGRES_PASSWORD=sentro -e POSTGRES_DB=sentro -p 5432:5432 -d postgres:16-alpine`
Expected: Container starts.

Create `.env` file in `apps/web/`:
```bash
DATABASE_URL="postgresql://sentro:sentro@localhost:5432/sentro?schema=public"
SESSION_SECRET="dev-secret-change-me"
```

Run: `cd apps/web && npx prisma db push`
Expected: Schema pushed successfully, all tables created.

Run: `cd apps/web && npx prisma generate`
Expected: Prisma Client generated.

- [ ] **Step 4: Verify schema with Prisma Studio**

Run: `cd apps/web && npx prisma studio`
Expected: Opens browser showing all tables: users, sessions, projects, event_groups, events, agent_runs, steps, tool_calls, llm_calls, alert_rules, alert_history.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/db/schema.prisma apps/web/lib/db/prisma.ts apps/web/.env.example
git commit -m "feat: add prisma schema with all tables, indexes, and relationships"
```

---

### Task 3: SDK — Types & Transport

**Files:**
- Create: `packages/sdk/src/types.ts`
- Create: `packages/sdk/src/transport.ts`
- Create: `packages/sdk/tests/transport.test.ts`

- [ ] **Step 1: Write SDK types**

```typescript
// packages/sdk/src/types.ts

export interface SentroConfig {
  dsn: string;
  capturePrompts?: boolean;
  flushIntervalMs?: number;
  maxBatchSize?: number;
  defaultTags?: Record<string, string>;
}

export interface ParsedDsn {
  host: string;
  token: string;
  projectId: string;
}

export type EventLevel = "error" | "warning" | "info" | "debug";

export type IngestEventType =
  | "event"
  | "run.start"
  | "run.end"
  | "step.start"
  | "step.end"
  | "tool_call.start"
  | "tool_call.end"
  | "llm_call.start"
  | "llm_call.end";

export interface IngestEvent {
  type: IngestEventType;
  timestamp: string;
  [key: string]: unknown;
}

export interface IngestPayload {
  dsn: string;
  batch: IngestEvent[];
}

export interface StartRunOptions {
  agent: string;
  goal?: string;
  model?: string;
  trigger?: string;
  metadata?: Record<string, unknown>;
}

export interface EndRunOptions {
  status: "success" | "failure" | "timeout";
  errorType?: string;
  errorMessage?: string;
}

export interface ToolCallOptions {
  input?: Record<string, unknown>;
}

export interface EndToolCallOptions {
  result?: unknown;
  error?: string;
}

export interface LlmCallOptions {
  model: string;
  provider?: string;
  messages?: Array<{ role: string; content: string }>;
  temperature?: number;
}

export interface EndLlmCallOptions {
  response?: unknown;
  promptTokens?: number;
  completionTokens?: number;
  cost?: number;
}
```

- [ ] **Step 2: Write the failing transport test**

```typescript
// packages/sdk/tests/transport.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Transport } from "../src/transport";
import type { ParsedDsn, IngestEvent } from "../src/types";

const mockDsn: ParsedDsn = {
  host: "http://localhost:3000",
  token: "test-token",
  projectId: "proj_1",
};

describe("Transport", () => {
  let transport: Transport;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn().mockResolvedValue({ ok: true, status: 202 });
    global.fetch = fetchSpy;
    transport = new Transport(mockDsn, {
      flushIntervalMs: 100,
      maxBatchSize: 3,
    });
  });

  afterEach(() => {
    transport.shutdown();
    vi.restoreAllMocks();
  });

  it("buffers events and flushes on interval", async () => {
    const event: IngestEvent = {
      type: "event",
      timestamp: new Date().toISOString(),
      level: "error",
      message: "test error",
    };

    transport.send(event);
    expect(fetchSpy).not.toHaveBeenCalled();

    // Wait for flush interval
    await new Promise((r) => setTimeout(r, 150));

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.dsn).toBe("proj_1");
    expect(body.batch).toHaveLength(1);
    expect(body.batch[0].message).toBe("test error");
  });

  it("flushes when batch size is reached", async () => {
    for (let i = 0; i < 3; i++) {
      transport.send({
        type: "event",
        timestamp: new Date().toISOString(),
        message: `error ${i}`,
      });
    }

    // Should flush immediately when maxBatchSize is hit
    await new Promise((r) => setTimeout(r, 10));

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.batch).toHaveLength(3);
  });

  it("sends correct headers with auth token", async () => {
    transport.send({
      type: "event",
      timestamp: new Date().toISOString(),
      message: "test",
    });

    await new Promise((r) => setTimeout(r, 150));

    expect(fetchSpy.mock.calls[0][1].headers).toEqual({
      "Content-Type": "application/json",
      Authorization: "Bearer test-token",
    });
  });

  it("drops events silently when fetch fails", async () => {
    fetchSpy.mockRejectedValue(new Error("Network error"));

    transport.send({
      type: "event",
      timestamp: new Date().toISOString(),
      message: "test",
    });

    await new Promise((r) => setTimeout(r, 150));

    // Should not throw — events are dropped silently
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("flushes remaining events on shutdown", async () => {
    transport.send({
      type: "event",
      timestamp: new Date().toISOString(),
      message: "final event",
    });

    await transport.shutdown();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.batch[0].message).toBe("final event");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd packages/sdk && npx vitest run tests/transport.test.ts`
Expected: FAIL — `Cannot find module '../src/transport'`

- [ ] **Step 4: Implement transport**

```typescript
// packages/sdk/src/transport.ts
import type { ParsedDsn, IngestEvent, IngestPayload } from "./types";

interface TransportOptions {
  flushIntervalMs?: number;
  maxBatchSize?: number;
}

export class Transport {
  private dsn: ParsedDsn;
  private buffer: IngestEvent[] = [];
  private flushIntervalMs: number;
  private maxBatchSize: number;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(dsn: ParsedDsn, options: TransportOptions = {}) {
    this.dsn = dsn;
    this.flushIntervalMs = options.flushIntervalMs ?? 1000;
    this.maxBatchSize = options.maxBatchSize ?? 100;
    this.startTimer();
  }

  send(event: IngestEvent): void {
    this.buffer.push(event);
    if (this.buffer.length >= this.maxBatchSize) {
      this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const batch = this.buffer.splice(0);
    const payload: IngestPayload = {
      dsn: this.dsn.projectId,
      batch,
    };

    try {
      await fetch(`${this.dsn.host}/api/ingest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.dsn.token}`,
        },
        body: JSON.stringify(payload),
      });
    } catch {
      // Drop events silently — no local queue for v1
    }
  }

  async shutdown(): Promise<void> {
    this.stopTimer();
    await this.flush();
  }

  private startTimer(): void {
    this.timer = setInterval(() => this.flush(), this.flushIntervalMs);
  }

  private stopTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd packages/sdk && npx vitest run tests/transport.test.ts`
Expected: All 5 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/sdk/src/types.ts packages/sdk/src/transport.ts packages/sdk/tests/transport.test.ts
git commit -m "feat(sdk): add types and transport layer with batching"
```

---

### Task 4: SDK — Client, Run, Step, ToolCall, LlmCall

**Files:**
- Create: `packages/sdk/src/client.ts`
- Create: `packages/sdk/src/run.ts`
- Create: `packages/sdk/src/step.ts`
- Create: `packages/sdk/src/tool-call.ts`
- Create: `packages/sdk/src/llm-call.ts`
- Create: `packages/sdk/src/index.ts`
- Create: `packages/sdk/tests/client.test.ts`
- Create: `packages/sdk/tests/run.test.ts`

- [ ] **Step 1: Write the failing client test**

```typescript
// packages/sdk/tests/client.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Sentro } from "../src/client";

describe("Sentro Client", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn().mockResolvedValue({ ok: true, status: 202 });
    global.fetch = fetchSpy;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("parses DSN correctly", () => {
    const sentro = new Sentro({
      dsn: "http://mytoken@localhost:3000/api/ingest/proj_abc",
    });

    // Verify by sending an event and checking the auth header
    sentro.captureMessage("test", "info");
    return sentro.flush().then(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy.mock.calls[0][0]).toBe(
        "http://localhost:3000/api/ingest"
      );
      expect(fetchSpy.mock.calls[0][1].headers.Authorization).toBe(
        "Bearer mytoken"
      );
      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body.dsn).toBe("proj_abc");
    });
  });

  it("captures exceptions", async () => {
    const sentro = new Sentro({
      dsn: "http://token@localhost:3000/api/ingest/proj_1",
    });

    const error = new Error("Something broke");
    error.stack = "Error: Something broke\n    at test.ts:1:1";
    sentro.captureException(error);
    await sentro.flush();

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.batch[0].type).toBe("event");
    expect(body.batch[0].level).toBe("error");
    expect(body.batch[0].message).toBe("Something broke");
    expect(body.batch[0].stackTrace).toContain("at test.ts:1:1");
  });

  it("captures messages with level", async () => {
    const sentro = new Sentro({
      dsn: "http://token@localhost:3000/api/ingest/proj_1",
    });

    sentro.captureMessage("Disk space low", "warning");
    await sentro.flush();

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.batch[0].level).toBe("warning");
    expect(body.batch[0].message).toBe("Disk space low");
  });

  it("attaches tags and context to events", async () => {
    const sentro = new Sentro({
      dsn: "http://token@localhost:3000/api/ingest/proj_1",
    });

    sentro.setTags({ service: "api", version: "1.0" });
    sentro.setContext({ userId: "123" });
    sentro.captureMessage("test", "info");
    await sentro.flush();

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.batch[0].tags).toEqual({ service: "api", version: "1.0" });
    expect(body.batch[0].context).toEqual({ userId: "123" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/sdk && npx vitest run tests/client.test.ts`
Expected: FAIL — `Cannot find module '../src/client'`

- [ ] **Step 3: Implement client.ts**

```typescript
// packages/sdk/src/client.ts
import { Transport } from "./transport";
import { SentroRun } from "./run";
import type {
  SentroConfig,
  ParsedDsn,
  EventLevel,
  StartRunOptions,
} from "./types";

function parseDsn(dsn: string): ParsedDsn {
  // Format: http://token@host:port/api/ingest/projectId
  const url = new URL(dsn);
  const token = url.username;
  url.username = "";
  const pathParts = url.pathname.split("/");
  const projectId = pathParts.pop()!;
  // Reconstruct host without trailing path segment
  const host = `${url.protocol}//${url.host}`;

  return { host, token, projectId };
}

export class Sentro {
  private transport: Transport;
  private dsn: ParsedDsn;
  private config: SentroConfig;
  private tags: Record<string, string> = {};
  private context: Record<string, unknown> = {};

  constructor(config: SentroConfig) {
    this.config = config;
    this.dsn = parseDsn(config.dsn);
    this.transport = new Transport(this.dsn, {
      flushIntervalMs: config.flushIntervalMs,
      maxBatchSize: config.maxBatchSize,
    });
    if (config.defaultTags) {
      this.tags = { ...config.defaultTags };
    }
  }

  setTags(tags: Record<string, string>): void {
    Object.assign(this.tags, tags);
  }

  setContext(context: Record<string, unknown>): void {
    Object.assign(this.context, context);
  }

  captureException(error: Error): void {
    this.transport.send({
      type: "event",
      timestamp: new Date().toISOString(),
      level: "error" as EventLevel,
      message: error.message,
      stackTrace: error.stack ?? null,
      tags: { ...this.tags },
      context: { ...this.context },
    });
  }

  captureMessage(message: string, level: EventLevel = "info"): void {
    this.transport.send({
      type: "event",
      timestamp: new Date().toISOString(),
      level,
      message,
      stackTrace: null,
      tags: { ...this.tags },
      context: { ...this.context },
    });
  }

  startRun(options: StartRunOptions): SentroRun {
    return new SentroRun(this.transport, this.config, options);
  }

  async trace<T>(
    agent: string,
    options: Omit<StartRunOptions, "agent">,
    fn: (run: SentroRun) => Promise<T>
  ): Promise<T> {
    const run = this.startRun({ ...options, agent });
    try {
      const result = await fn(run);
      run.end({ status: "success" });
      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      run.end({
        status: "failure",
        errorType: err.constructor.name,
        errorMessage: err.message,
      });
      throw error;
    }
  }

  async flush(): Promise<void> {
    await this.transport.flush();
  }

  async shutdown(): Promise<void> {
    await this.transport.shutdown();
  }
}
```

- [ ] **Step 4: Implement run.ts**

```typescript
// packages/sdk/src/run.ts
import { SentroStep } from "./step";
import { Transport } from "./transport";
import type { SentroConfig, StartRunOptions, EndRunOptions } from "./types";

export class SentroRun {
  readonly id: string;
  private transport: Transport;
  private config: SentroConfig;
  private stepCounter = 0;

  constructor(
    transport: Transport,
    config: SentroConfig,
    options: StartRunOptions
  ) {
    this.id = crypto.randomUUID();
    this.transport = transport;
    this.config = config;

    this.transport.send({
      type: "run.start",
      timestamp: new Date().toISOString(),
      runId: this.id,
      agent: options.agent,
      goal: options.goal ?? null,
      model: options.model ?? null,
      trigger: options.trigger ?? null,
      metadata: options.metadata ?? {},
    });
  }

  step(content: string): SentroStep {
    this.stepCounter++;
    return new SentroStep(this.transport, this.config, {
      runId: this.id,
      sequenceNumber: this.stepCounter,
      content,
    });
  }

  async trace<T>(
    content: string,
    fn: (step: SentroStep) => Promise<T>
  ): Promise<T> {
    const s = this.step(content);
    try {
      const result = await fn(s);
      s.end();
      return result;
    } catch (error) {
      s.end();
      throw error;
    }
  }

  end(options: EndRunOptions): void {
    this.transport.send({
      type: "run.end",
      timestamp: new Date().toISOString(),
      runId: this.id,
      status: options.status,
      errorType: options.errorType ?? null,
      errorMessage: options.errorMessage ?? null,
    });
  }

  error(error: Error): void {
    this.end({
      status: "failure",
      errorType: error.constructor.name,
      errorMessage: error.message,
    });
  }
}
```

- [ ] **Step 5: Implement step.ts**

```typescript
// packages/sdk/src/step.ts
import { SentroToolCall } from "./tool-call";
import { SentroLlmCall } from "./llm-call";
import { Transport } from "./transport";
import type {
  SentroConfig,
  ToolCallOptions,
  LlmCallOptions,
} from "./types";

interface StepInit {
  runId: string;
  sequenceNumber: number;
  content: string;
}

export class SentroStep {
  readonly id: string;
  private transport: Transport;
  private config: SentroConfig;
  private runId: string;

  constructor(transport: Transport, config: SentroConfig, init: StepInit) {
    this.id = crypto.randomUUID();
    this.transport = transport;
    this.config = config;
    this.runId = init.runId;

    this.transport.send({
      type: "step.start",
      timestamp: new Date().toISOString(),
      stepId: this.id,
      runId: init.runId,
      sequenceNumber: init.sequenceNumber,
      content: init.content,
    });
  }

  toolCall(toolName: string, options: ToolCallOptions = {}): SentroToolCall {
    return new SentroToolCall(this.transport, {
      stepId: this.id,
      runId: this.runId,
      toolName,
      input: options.input ?? {},
    });
  }

  async traceToolCall<T>(
    toolName: string,
    input: Record<string, unknown>,
    fn: () => Promise<T>
  ): Promise<T> {
    const tc = this.toolCall(toolName, { input });
    try {
      const result = await fn();
      tc.end({ result });
      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      tc.end({ error: err.message });
      throw error;
    }
  }

  llmCall(options: LlmCallOptions): SentroLlmCall {
    return new SentroLlmCall(this.transport, this.config, {
      stepId: this.id,
      runId: this.runId,
      ...options,
    });
  }

  end(): void {
    this.transport.send({
      type: "step.end",
      timestamp: new Date().toISOString(),
      stepId: this.id,
      runId: this.runId,
    });
  }
}
```

- [ ] **Step 6: Implement tool-call.ts**

```typescript
// packages/sdk/src/tool-call.ts
import { Transport } from "./transport";
import type { EndToolCallOptions } from "./types";

interface ToolCallInit {
  stepId: string;
  runId: string;
  toolName: string;
  input: Record<string, unknown>;
}

export class SentroToolCall {
  readonly id: string;
  private transport: Transport;
  private init: ToolCallInit;

  constructor(transport: Transport, init: ToolCallInit) {
    this.id = crypto.randomUUID();
    this.transport = transport;
    this.init = init;

    this.transport.send({
      type: "tool_call.start",
      timestamp: new Date().toISOString(),
      toolCallId: this.id,
      stepId: init.stepId,
      runId: init.runId,
      toolName: init.toolName,
      input: init.input,
    });
  }

  end(options: EndToolCallOptions = {}): void {
    this.transport.send({
      type: "tool_call.end",
      timestamp: new Date().toISOString(),
      toolCallId: this.id,
      stepId: this.init.stepId,
      runId: this.init.runId,
      toolName: this.init.toolName,
      output: options.result ?? null,
      status: options.error ? "error" : "success",
      errorMessage: options.error ?? null,
    });
  }

  error(error: Error): void {
    this.end({ error: error.message });
  }
}
```

- [ ] **Step 7: Implement llm-call.ts**

```typescript
// packages/sdk/src/llm-call.ts
import { Transport } from "./transport";
import type { SentroConfig, EndLlmCallOptions } from "./types";

interface LlmCallInit {
  stepId: string;
  runId: string;
  model: string;
  provider?: string;
  messages?: Array<{ role: string; content: string }>;
  temperature?: number;
}

export class SentroLlmCall {
  readonly id: string;
  private transport: Transport;
  private config: SentroConfig;
  private init: LlmCallInit;

  constructor(transport: Transport, config: SentroConfig, init: LlmCallInit) {
    this.id = crypto.randomUUID();
    this.transport = transport;
    this.config = config;
    this.init = init;

    this.transport.send({
      type: "llm_call.start",
      timestamp: new Date().toISOString(),
      llmCallId: this.id,
      stepId: init.stepId,
      runId: init.runId,
      model: init.model,
      provider: init.provider ?? "unknown",
      messages: config.capturePrompts ? (init.messages ?? null) : null,
      temperature: init.temperature ?? null,
    });
  }

  end(options: EndLlmCallOptions = {}): void {
    this.transport.send({
      type: "llm_call.end",
      timestamp: new Date().toISOString(),
      llmCallId: this.id,
      stepId: this.init.stepId,
      runId: this.init.runId,
      model: this.init.model,
      provider: this.init.provider ?? "unknown",
      promptTokens: options.promptTokens ?? 0,
      completionTokens: options.completionTokens ?? 0,
      totalTokens: (options.promptTokens ?? 0) + (options.completionTokens ?? 0),
      cost: options.cost ?? 0,
      response: this.config.capturePrompts ? (options.response ?? null) : null,
    });
  }
}
```

- [ ] **Step 8: Create index.ts exports**

```typescript
// packages/sdk/src/index.ts
export { Sentro } from "./client";
export { SentroRun } from "./run";
export { SentroStep } from "./step";
export { SentroToolCall } from "./tool-call";
export { SentroLlmCall } from "./llm-call";
export type {
  SentroConfig,
  EventLevel,
  StartRunOptions,
  EndRunOptions,
  ToolCallOptions,
  EndToolCallOptions,
  LlmCallOptions,
  EndLlmCallOptions,
} from "./types";
```

- [ ] **Step 9: Run all tests**

Run: `cd packages/sdk && npx vitest run`
Expected: All tests PASS (client + transport).

- [ ] **Step 10: Write run integration test**

```typescript
// packages/sdk/tests/run.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Sentro } from "../src/client";

describe("Agent Run Tracking", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;
  let sentro: Sentro;

  beforeEach(() => {
    fetchSpy = vi.fn().mockResolvedValue({ ok: true, status: 202 });
    global.fetch = fetchSpy;
    sentro = new Sentro({
      dsn: "http://token@localhost:3000/api/ingest/proj_1",
      flushIntervalMs: 60000, // disable auto-flush for tests
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("tracks a full agent run with steps, tool calls, and llm calls", async () => {
    const run = sentro.startRun({
      agent: "test-agent",
      goal: "Test goal",
      model: "claude-sonnet-4-6",
    });

    const step = run.step("Doing something");
    const tool = step.toolCall("db.query", { input: { sql: "SELECT 1" } });
    tool.end({ result: { rows: [1] } });

    const llm = step.llmCall({
      model: "claude-sonnet-4-6",
      messages: [{ role: "user", content: "Hello" }],
    });
    llm.end({ promptTokens: 10, completionTokens: 5, cost: 0.001 });

    step.end();
    run.end({ status: "success" });

    await sentro.flush();

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    const types = body.batch.map((e: { type: string }) => e.type);

    expect(types).toEqual([
      "run.start",
      "step.start",
      "tool_call.start",
      "tool_call.end",
      "llm_call.start",
      "llm_call.end",
      "step.end",
      "run.end",
    ]);

    // Verify run.start payload
    const runStart = body.batch[0];
    expect(runStart.agent).toBe("test-agent");
    expect(runStart.goal).toBe("Test goal");

    // Verify run.end payload
    const runEnd = body.batch[7];
    expect(runEnd.status).toBe("success");
    expect(runEnd.runId).toBe(runStart.runId);
  });

  it("trace wrapper auto-ends on success", async () => {
    const result = await sentro.trace(
      "test-agent",
      { goal: "Auto test" },
      async (run) => {
        const step = run.step("step 1");
        step.end();
        return "done";
      }
    );

    expect(result).toBe("done");
    await sentro.flush();

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    const runEnd = body.batch.find(
      (e: { type: string }) => e.type === "run.end"
    );
    expect(runEnd.status).toBe("success");
  });

  it("trace wrapper auto-errors on throw", async () => {
    await expect(
      sentro.trace("test-agent", { goal: "Fail test" }, async () => {
        throw new Error("Boom");
      })
    ).rejects.toThrow("Boom");

    await sentro.flush();

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    const runEnd = body.batch.find(
      (e: { type: string }) => e.type === "run.end"
    );
    expect(runEnd.status).toBe("failure");
    expect(runEnd.errorType).toBe("Error");
    expect(runEnd.errorMessage).toBe("Boom");
  });

  it("respects capturePrompts config", async () => {
    const privateSentro = new Sentro({
      dsn: "http://token@localhost:3000/api/ingest/proj_1",
      capturePrompts: false,
      flushIntervalMs: 60000,
    });

    const run = privateSentro.startRun({ agent: "test" });
    const step = run.step("ask llm");
    const llm = step.llmCall({
      model: "gpt-4",
      messages: [{ role: "user", content: "secret prompt" }],
    });
    llm.end({ response: "secret response", promptTokens: 10, completionTokens: 5 });
    step.end();
    run.end({ status: "success" });
    await privateSentro.flush();

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    const llmStart = body.batch.find(
      (e: { type: string }) => e.type === "llm_call.start"
    );
    const llmEnd = body.batch.find(
      (e: { type: string }) => e.type === "llm_call.end"
    );
    expect(llmStart.messages).toBeNull();
    expect(llmEnd.response).toBeNull();
  });
});
```

- [ ] **Step 11: Run all SDK tests**

Run: `cd packages/sdk && npx vitest run`
Expected: All tests PASS.

- [ ] **Step 12: Build SDK**

Run: `cd packages/sdk && npx tsc`
Expected: Compiles to `dist/` with no errors.

- [ ] **Step 13: Commit**

```bash
git add packages/sdk/
git commit -m "feat(sdk): add client, run, step, tool call, and llm call tracking"
```

---

### Task 5: Auth System

**Files:**
- Create: `apps/web/lib/auth/password.ts`
- Create: `apps/web/lib/auth/session.ts`
- Create: `apps/web/lib/auth/middleware.ts`
- Create: `apps/web/app/api/auth/setup/route.ts`
- Create: `apps/web/app/api/auth/login/route.ts`
- Create: `apps/web/app/api/auth/logout/route.ts`
- Create: `apps/web/app/api/health/route.ts`

- [ ] **Step 1: Implement password.ts**

```typescript
// apps/web/lib/auth/password.ts
import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
```

- [ ] **Step 2: Implement session.ts**

```typescript
// apps/web/lib/auth/session.ts
import { prisma } from "@/lib/db/prisma";
import { cookies } from "next/headers";
import crypto from "crypto";

const SESSION_COOKIE = "sentro_session";
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function createSession(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await prisma.session.create({
    data: { userId, token, expiresAt },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  return token;
}

export async function validateSession(): Promise<{
  userId: string;
} | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token },
    select: { userId: true, expiresAt: true },
  });

  if (!session || session.expiresAt < new Date()) {
    return null;
  }

  return { userId: session.userId };
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { token } });
  }
  cookieStore.delete(SESSION_COOKIE);
}
```

- [ ] **Step 3: Implement middleware.ts**

```typescript
// apps/web/lib/auth/middleware.ts
import { NextResponse } from "next/server";
import { validateSession } from "./session";

export async function requireAuth(): Promise<
  { userId: string } | NextResponse
> {
  const session = await validateSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return session;
}
```

- [ ] **Step 4: Implement setup route**

```typescript
// apps/web/app/api/auth/setup/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  // Check if a user already exists — setup is one-time only
  const existingUser = await prisma.user.findFirst();
  if (existingUser) {
    return NextResponse.json(
      { error: "Setup already completed" },
      { status: 400 }
    );
  }

  const body = await request.json();
  const { email, password } = body;

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required" },
      { status: 400 }
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 }
    );
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { email, passwordHash },
  });

  await createSession(user.id);

  return NextResponse.json({ ok: true }, { status: 201 });
}
```

- [ ] **Step 5: Implement login route**

```typescript
// apps/web/app/api/auth/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { email, password } = body;

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required" },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json(
      { error: "Invalid credentials" },
      { status: 401 }
    );
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return NextResponse.json(
      { error: "Invalid credentials" },
      { status: 401 }
    );
  }

  await createSession(user.id);

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 6: Implement logout route**

```typescript
// apps/web/app/api/auth/logout/route.ts
import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth/session";

export async function POST() {
  await destroySession();
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 7: Implement health route**

```typescript
// apps/web/app/api/health/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok" });
  } catch {
    return NextResponse.json({ status: "error" }, { status: 503 });
  }
}
```

- [ ] **Step 8: Commit**

```bash
git add apps/web/lib/auth/ apps/web/app/api/auth/ apps/web/app/api/health/
git commit -m "feat: add auth system with setup wizard, login, logout, and session management"
```

---

### Task 6: Ingestion Pipeline

**Files:**
- Create: `apps/web/lib/ingestion/validate.ts`
- Create: `apps/web/lib/ingestion/fingerprint.ts`
- Create: `apps/web/lib/ingestion/buffer.ts`
- Create: `apps/web/lib/ingestion/processor.ts`
- Create: `apps/web/app/api/ingest/route.ts`

- [ ] **Step 1: Implement validate.ts**

```typescript
// apps/web/lib/ingestion/validate.ts
import { z } from "zod";

const ingestEventSchema = z.object({
  type: z.enum([
    "event",
    "run.start",
    "run.end",
    "step.start",
    "step.end",
    "tool_call.start",
    "tool_call.end",
    "llm_call.start",
    "llm_call.end",
  ]),
  timestamp: z.string().datetime(),
}).passthrough();

const ingestPayloadSchema = z.object({
  dsn: z.string().min(1),
  batch: z.array(ingestEventSchema).min(1).max(1000),
});

export type ValidatedPayload = z.infer<typeof ingestPayloadSchema>;

export function validatePayload(data: unknown): {
  success: true;
  data: ValidatedPayload;
} | {
  success: false;
  error: string;
} {
  const result = ingestPayloadSchema.safeParse(data);
  if (!result.success) {
    return { success: false, error: result.error.message };
  }
  return { success: true, data: result.data };
}
```

- [ ] **Step 2: Implement fingerprint.ts**

```typescript
// apps/web/lib/ingestion/fingerprint.ts
import crypto from "crypto";

/**
 * Generate a fingerprint for grouping similar events.
 *
 * - If the event provides an explicit fingerprint, use it.
 * - For errors: hash exception type + top stack frame.
 * - For agent failures: hash agent_name + error type.
 * - Fallback: hash the message.
 */
export function generateFingerprint(event: Record<string, unknown>): string {
  // Explicit fingerprint from SDK
  if (typeof event.fingerprint === "string") {
    return event.fingerprint;
  }

  let input: string;

  if (event.stackTrace && typeof event.stackTrace === "string") {
    // Error with stack trace — use first meaningful stack line
    const lines = (event.stackTrace as string).split("\n");
    const firstFrame = lines.find((l) => l.trim().startsWith("at ")) ?? lines[0];
    input = `${event.message}::${firstFrame?.trim()}`;
  } else if (event.type === "event" && event.message) {
    // Plain message — hash the message itself
    input = `msg::${event.level}::${event.message}`;
  } else {
    input = `unknown::${JSON.stringify(event).slice(0, 200)}`;
  }

  return crypto.createHash("sha256").update(input).digest("hex").slice(0, 16);
}
```

- [ ] **Step 3: Implement buffer.ts**

```typescript
// apps/web/lib/ingestion/buffer.ts
import type { ValidatedPayload } from "./validate";
import { processFlush } from "./processor";

interface BufferedBatch {
  projectId: string;
  events: Record<string, unknown>[];
}

const buffer: BufferedBatch[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;

const FLUSH_INTERVAL_MS = 1000;
const MAX_BUFFER_SIZE = 100;

function totalEvents(): number {
  return buffer.reduce((sum, b) => sum + b.events.length, 0);
}

export function addToBatch(payload: ValidatedPayload): void {
  buffer.push({
    projectId: payload.dsn,
    events: payload.batch,
  });

  if (totalEvents() >= MAX_BUFFER_SIZE) {
    flush();
  }
}

export async function flush(): Promise<void> {
  if (buffer.length === 0) return;

  const batches = buffer.splice(0);

  // Group by project
  const byProject = new Map<string, Record<string, unknown>[]>();
  for (const batch of batches) {
    const existing = byProject.get(batch.projectId) ?? [];
    existing.push(...batch.events);
    byProject.set(batch.projectId, existing);
  }

  const promises = Array.from(byProject.entries()).map(
    ([projectId, events]) => processFlush(projectId, events)
  );

  await Promise.allSettled(promises);
}

export function startFlushTimer(): void {
  if (flushTimer) return;
  flushTimer = setInterval(flush, FLUSH_INTERVAL_MS);
}

export function stopFlushTimer(): void {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
}
```

- [ ] **Step 4: Implement processor.ts**

```typescript
// apps/web/lib/ingestion/processor.ts
import { prisma } from "@/lib/db/prisma";
import { generateFingerprint } from "./fingerprint";
import type { EventLevel, RunStatus, StepType, CallStatus } from "@prisma/client";

export async function processFlush(
  projectDsnToken: string,
  events: Record<string, unknown>[]
): Promise<void> {
  // Look up project by DSN token
  const project = await prisma.project.findUnique({
    where: { dsnToken: projectDsnToken },
  });
  if (!project) return; // Unknown project — drop silently

  const projectId = project.id;

  // Track run state across events in this batch
  const runStartTimes = new Map<string, string>();

  for (const event of events) {
    const type = event.type as string;
    const timestamp = event.timestamp as string;

    switch (type) {
      case "event": {
        const fingerprint = generateFingerprint(event);
        const level = (event.level as EventLevel) ?? "error";
        const message = (event.message as string) ?? "";
        const title =
          message.length > 200 ? message.slice(0, 200) + "..." : message;
        const now = new Date(timestamp);

        // Upsert event group
        const group = await prisma.eventGroup.upsert({
          where: {
            projectId_fingerprint: { projectId, fingerprint },
          },
          create: {
            projectId,
            fingerprint,
            title,
            level,
            firstSeen: now,
            lastSeen: now,
            count: 1,
          },
          update: {
            lastSeen: now,
            count: { increment: 1 },
          },
        });

        // Insert event
        await prisma.event.create({
          data: {
            projectId,
            groupId: group.id,
            runId: (event.runId as string) ?? null,
            fingerprint,
            level,
            message,
            stackTrace: (event.stackTrace as string) ?? null,
            tags: (event.tags as object) ?? {},
            context: (event.context as object) ?? {},
            timestamp: now,
          },
        });
        break;
      }

      case "run.start": {
        const runId = event.runId as string;
        runStartTimes.set(runId, timestamp);

        await prisma.agentRun.create({
          data: {
            id: runId,
            projectId,
            agentName: (event.agent as string) ?? "unknown",
            trigger: (event.trigger as string) ?? null,
            goal: (event.goal as string) ?? null,
            model: (event.model as string) ?? null,
            status: "running" as RunStatus,
            startedAt: new Date(timestamp),
            metadata: (event.metadata as object) ?? {},
          },
        });
        break;
      }

      case "run.end": {
        const runId = event.runId as string;
        const status = event.status as RunStatus;

        // Calculate totals from child records
        const [tokenAgg, costAgg] = await Promise.all([
          prisma.llmCall.aggregate({
            where: { runId },
            _sum: { totalTokens: true },
          }),
          prisma.llmCall.aggregate({
            where: { runId },
            _sum: { cost: true },
          }),
        ]);

        await prisma.agentRun.update({
          where: { id: runId },
          data: {
            status,
            finishedAt: new Date(timestamp),
            errorType: (event.errorType as string) ?? null,
            errorMessage: (event.errorMessage as string) ?? null,
            totalTokens: tokenAgg._sum.totalTokens ?? 0,
            totalCost: costAgg._sum.cost ?? 0,
          },
        });
        break;
      }

      case "step.start": {
        await prisma.step.create({
          data: {
            id: event.stepId as string,
            runId: event.runId as string,
            projectId,
            sequenceNumber: (event.sequenceNumber as number) ?? 0,
            type: "action" as StepType,
            content: (event.content as string) ?? "",
            startedAt: new Date(timestamp),
          },
        });
        break;
      }

      case "step.end": {
        await prisma.step.update({
          where: { id: event.stepId as string },
          data: { finishedAt: new Date(timestamp) },
        });
        break;
      }

      case "tool_call.start": {
        await prisma.toolCall.create({
          data: {
            id: event.toolCallId as string,
            stepId: event.stepId as string,
            runId: event.runId as string,
            projectId,
            toolName: (event.toolName as string) ?? "unknown",
            input: (event.input as object) ?? {},
            status: "success" as CallStatus,
            latencyMs: 0,
            startedAt: new Date(timestamp),
          },
        });
        break;
      }

      case "tool_call.end": {
        const startRecord = await prisma.toolCall.findUnique({
          where: { id: event.toolCallId as string },
          select: { startedAt: true },
        });
        const latencyMs = startRecord
          ? new Date(timestamp).getTime() - startRecord.startedAt.getTime()
          : 0;

        await prisma.toolCall.update({
          where: { id: event.toolCallId as string },
          data: {
            output: (event.output as object) ?? {},
            status: (event.status as CallStatus) ?? "success",
            latencyMs,
            errorMessage: (event.errorMessage as string) ?? null,
          },
        });
        break;
      }

      case "llm_call.start": {
        await prisma.llmCall.create({
          data: {
            id: event.llmCallId as string,
            stepId: event.stepId as string,
            runId: event.runId as string,
            projectId,
            model: (event.model as string) ?? "unknown",
            provider: (event.provider as string) ?? "unknown",
            messages: (event.messages as object) ?? null,
            temperature: (event.temperature as number) ?? null,
            latencyMs: 0,
            startedAt: new Date(timestamp),
          },
        });
        break;
      }

      case "llm_call.end": {
        const startLlm = await prisma.llmCall.findUnique({
          where: { id: event.llmCallId as string },
          select: { startedAt: true },
        });
        const llmLatency = startLlm
          ? new Date(timestamp).getTime() - startLlm.startedAt.getTime()
          : 0;

        await prisma.llmCall.update({
          where: { id: event.llmCallId as string },
          data: {
            promptTokens: (event.promptTokens as number) ?? 0,
            completionTokens: (event.completionTokens as number) ?? 0,
            totalTokens: (event.totalTokens as number) ?? 0,
            cost: (event.cost as number) ?? 0,
            latencyMs: llmLatency,
            response: (event.response as object) ?? null,
          },
        });
        break;
      }
    }
  }
}
```

- [ ] **Step 5: Implement rate limiter and ingest route**

```typescript
// apps/web/app/api/ingest/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { validatePayload } from "@/lib/ingestion/validate";
import { addToBatch, startFlushTimer } from "@/lib/ingestion/buffer";

// In-memory rate limit counters: dsnToken -> { count, resetAt }
const rateLimits = new Map<
  string,
  { count: number; resetAt: number }
>();

function checkRateLimit(
  dsnToken: string,
  limit: number
): boolean {
  const now = Date.now();
  const entry = rateLimits.get(dsnToken);

  if (!entry || now > entry.resetAt) {
    rateLimits.set(dsnToken, { count: 1, resetAt: now + 60_000 });
    return true;
  }

  if (entry.count >= limit) {
    return false;
  }

  entry.count++;
  return true;
}

// Start the flush timer on first import
startFlushTimer();

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const validation = validatePayload(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error },
      { status: 400 }
    );
  }

  // Verify DSN token from Authorization header
  const authHeader = request.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (!token) {
    return NextResponse.json({ error: "Missing auth token" }, { status: 401 });
  }

  // Look up project to verify token and get rate limit
  const project = await prisma.project.findUnique({
    where: { dsnToken: token },
    select: { dsnToken: true, rateLimitPerMinute: true },
  });

  if (!project) {
    return NextResponse.json({ error: "Invalid DSN token" }, { status: 401 });
  }

  // Rate limit check
  if (!checkRateLimit(token, project.rateLimitPerMinute)) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429 }
    );
  }

  addToBatch(validation.data);

  return NextResponse.json({ ok: true }, { status: 202 });
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/lib/ingestion/ apps/web/app/api/ingest/
git commit -m "feat: add event ingestion pipeline with validation, fingerprinting, buffering, and rate limiting"
```

---

### Task 7: Project CRUD API

**Files:**
- Create: `apps/web/app/api/projects/route.ts`
- Create: `apps/web/app/api/projects/[projectId]/route.ts`

- [ ] **Step 1: Implement projects list/create route**

```typescript
// apps/web/app/api/projects/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/middleware";
import crypto from "crypto";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      dsnToken: true,
      retentionDays: true,
      rateLimitPerMinute: true,
      createdAt: true,
    },
  });

  return NextResponse.json(projects);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  const { name } = body;

  if (!name || typeof name !== "string") {
    return NextResponse.json(
      { error: "Project name is required" },
      { status: 400 }
    );
  }

  const dsnToken = crypto.randomBytes(16).toString("hex");

  const project = await prisma.project.create({
    data: { name, dsnToken },
  });

  return NextResponse.json(
    {
      id: project.id,
      name: project.name,
      dsnToken: project.dsnToken,
      dsn: `${process.env.NEXT_PUBLIC_APP_URL}/api/ingest/${project.dsnToken}`,
    },
    { status: 201 }
  );
}
```

- [ ] **Step 2: Implement project detail route**

```typescript
// apps/web/app/api/projects/[projectId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/middleware";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { projectId } = await params;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(project);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { projectId } = await params;
  const body = await request.json();

  const project = await prisma.project.update({
    where: { id: projectId },
    data: {
      ...(body.name && { name: body.name }),
      ...(body.retentionDays && { retentionDays: body.retentionDays }),
      ...(body.rateLimitPerMinute && {
        rateLimitPerMinute: body.rateLimitPerMinute,
      }),
    },
  });

  return NextResponse.json(project);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { projectId } = await params;

  await prisma.project.delete({ where: { id: projectId } });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/api/projects/
git commit -m "feat: add project CRUD API routes"
```

---

### Task 8: Issues & Events API

**Files:**
- Create: `apps/web/app/api/projects/[projectId]/issues/route.ts`
- Create: `apps/web/app/api/projects/[projectId]/issues/[groupId]/route.ts`
- Create: `apps/web/app/api/projects/[projectId]/events/route.ts`

- [ ] **Step 1: Implement issues list route**

```typescript
// apps/web/app/api/projects/[projectId]/issues/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/middleware";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { projectId } = await params;
  const searchParams = request.nextUrl.searchParams;
  const status = searchParams.get("status") ?? "open";
  const limit = parseInt(searchParams.get("limit") ?? "50", 10);
  const cursor = searchParams.get("cursor");

  const groups = await prisma.eventGroup.findMany({
    where: {
      projectId,
      status: status as "open" | "resolved" | "ignored",
      ...(cursor && { id: { lt: cursor } }),
    },
    orderBy: { lastSeen: "desc" },
    take: limit,
    include: {
      _count: {
        select: { events: true },
      },
    },
  });

  // Count affected agent runs per group
  const groupsWithRunCount = await Promise.all(
    groups.map(async (group) => {
      const affectedRuns = await prisma.event.findMany({
        where: { groupId: group.id, runId: { not: null } },
        select: { runId: true },
        distinct: ["runId"],
      });
      return {
        ...group,
        eventCount: group._count.events,
        affectedRunCount: affectedRuns.length,
      };
    })
  );

  return NextResponse.json(groupsWithRunCount);
}
```

- [ ] **Step 2: Implement issue detail route**

```typescript
// apps/web/app/api/projects/[projectId]/issues/[groupId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/middleware";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string; groupId: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { groupId } = await params;

  const group = await prisma.eventGroup.findUnique({
    where: { id: groupId },
    include: {
      events: {
        orderBy: { timestamp: "desc" },
        take: 50,
      },
    },
  });

  if (!group) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(group);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; groupId: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { groupId } = await params;
  const body = await request.json();

  if (body.status && !["open", "resolved", "ignored"].includes(body.status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const group = await prisma.eventGroup.update({
    where: { id: groupId },
    data: { status: body.status },
  });

  return NextResponse.json(group);
}
```

- [ ] **Step 3: Implement events route**

```typescript
// apps/web/app/api/projects/[projectId]/events/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/middleware";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { projectId } = await params;
  const searchParams = request.nextUrl.searchParams;
  const groupId = searchParams.get("groupId");
  const limit = parseInt(searchParams.get("limit") ?? "50", 10);

  const events = await prisma.event.findMany({
    where: {
      projectId,
      ...(groupId && { groupId }),
    },
    orderBy: { timestamp: "desc" },
    take: limit,
  });

  return NextResponse.json(events);
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/api/projects/\[projectId\]/issues/ apps/web/app/api/projects/\[projectId\]/events/
git commit -m "feat: add issues and events API routes"
```

---

### Task 9: Agent Runs & Performance API

**Files:**
- Create: `apps/web/app/api/projects/[projectId]/runs/route.ts`
- Create: `apps/web/app/api/projects/[projectId]/runs/[runId]/route.ts`
- Create: `apps/web/app/api/projects/[projectId]/performance/route.ts`

- [ ] **Step 1: Implement runs list route**

```typescript
// apps/web/app/api/projects/[projectId]/runs/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/middleware";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { projectId } = await params;
  const searchParams = request.nextUrl.searchParams;
  const agent = searchParams.get("agent");
  const status = searchParams.get("status");
  const limit = parseInt(searchParams.get("limit") ?? "50", 10);
  const hours = parseInt(searchParams.get("hours") ?? "24", 10);

  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  const [runs, stats] = await Promise.all([
    prisma.agentRun.findMany({
      where: {
        projectId,
        startedAt: { gte: since },
        ...(agent && { agentName: agent }),
        ...(status && { status: status as "running" | "success" | "failure" | "timeout" }),
      },
      orderBy: { startedAt: "desc" },
      take: limit,
      include: {
        _count: { select: { steps: true } },
      },
    }),
    prisma.agentRun.aggregate({
      where: { projectId, startedAt: { gte: since } },
      _count: true,
      _sum: { totalTokens: true, totalCost: true },
    }),
  ]);

  // Calculate success rate
  const successCount = await prisma.agentRun.count({
    where: { projectId, startedAt: { gte: since }, status: "success" },
  });

  const totalCount = stats._count;
  const successRate = totalCount > 0 ? (successCount / totalCount) * 100 : 0;

  // Calculate average duration from completed runs
  const completedRuns = await prisma.agentRun.findMany({
    where: {
      projectId,
      startedAt: { gte: since },
      finishedAt: { not: null },
    },
    select: { startedAt: true, finishedAt: true },
  });

  const avgDurationMs =
    completedRuns.length > 0
      ? completedRuns.reduce(
          (sum, r) => sum + (r.finishedAt!.getTime() - r.startedAt.getTime()),
          0
        ) / completedRuns.length
      : 0;

  return NextResponse.json({
    runs: runs.map((r) => ({
      ...r,
      stepCount: r._count.steps,
    })),
    stats: {
      totalRuns: totalCount,
      successRate: Math.round(successRate * 10) / 10,
      avgDurationMs: Math.round(avgDurationMs),
      totalTokens: stats._sum.totalTokens ?? 0,
      totalCost: Number(stats._sum.totalCost ?? 0),
    },
  });
}
```

- [ ] **Step 2: Implement run detail route**

```typescript
// apps/web/app/api/projects/[projectId]/runs/[runId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/middleware";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string; runId: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { runId } = await params;

  const run = await prisma.agentRun.findUnique({
    where: { id: runId },
    include: {
      steps: {
        orderBy: { sequenceNumber: "asc" },
        include: {
          toolCalls: true,
          llmCalls: true,
        },
      },
      events: {
        orderBy: { timestamp: "desc" },
        take: 10,
      },
    },
  });

  if (!run) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(run);
}
```

- [ ] **Step 3: Implement performance route**

```typescript
// apps/web/app/api/projects/[projectId]/performance/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/middleware";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { projectId } = await params;
  const hours = parseInt(
    request.nextUrl.searchParams.get("hours") ?? "24",
    10
  );
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  const [slowestTools, slowestLlm, llmByModel] = await Promise.all([
    // Slowest tool calls
    prisma.toolCall.findMany({
      where: { projectId, startedAt: { gte: since } },
      orderBy: { latencyMs: "desc" },
      take: 20,
      select: {
        id: true,
        toolName: true,
        latencyMs: true,
        status: true,
        startedAt: true,
        runId: true,
      },
    }),

    // Slowest LLM calls
    prisma.llmCall.findMany({
      where: { projectId, startedAt: { gte: since } },
      orderBy: { latencyMs: "desc" },
      take: 20,
      select: {
        id: true,
        model: true,
        latencyMs: true,
        totalTokens: true,
        cost: true,
        startedAt: true,
        runId: true,
      },
    }),

    // LLM cost/tokens grouped by model
    prisma.llmCall.groupBy({
      by: ["model"],
      where: { projectId, startedAt: { gte: since } },
      _sum: { totalTokens: true, cost: true },
      _count: true,
      _avg: { latencyMs: true },
    }),
  ]);

  return NextResponse.json({
    slowestToolCalls: slowestTools,
    slowestLlmCalls: slowestLlm,
    llmByModel: llmByModel.map((m) => ({
      model: m.model,
      calls: m._count,
      totalTokens: m._sum.totalTokens ?? 0,
      totalCost: Number(m._sum.cost ?? 0),
      avgLatencyMs: Math.round(m._avg.latencyMs ?? 0),
    })),
  });
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/api/projects/\[projectId\]/runs/ apps/web/app/api/projects/\[projectId\]/performance/
git commit -m "feat: add agent runs, run detail, and performance API routes"
```

---

### Task 10: Alerts API & Background Jobs

**Files:**
- Create: `apps/web/app/api/projects/[projectId]/alerts/route.ts`
- Create: `apps/web/app/api/projects/[projectId]/alerts/[alertId]/route.ts`
- Create: `apps/web/lib/alerts/evaluator.ts`
- Create: `apps/web/lib/alerts/webhook.ts`
- Create: `apps/web/lib/jobs/worker.ts`
- Create: `apps/web/lib/jobs/alert-check.ts`
- Create: `apps/web/lib/jobs/cleanup.ts`

- [ ] **Step 1: Implement alerts API routes**

```typescript
// apps/web/app/api/projects/[projectId]/alerts/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/middleware";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { projectId } = await params;

  const rules = await prisma.alertRule.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { history: true } },
    },
  });

  return NextResponse.json(rules);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { projectId } = await params;
  const body = await request.json();

  if (!body.name || !body.type || !body.config || !body.webhookUrl) {
    return NextResponse.json(
      { error: "name, type, config, and webhookUrl are required" },
      { status: 400 }
    );
  }

  if (!["error_spike", "failure_rate", "cost_threshold"].includes(body.type)) {
    return NextResponse.json({ error: "Invalid alert type" }, { status: 400 });
  }

  const rule = await prisma.alertRule.create({
    data: {
      projectId,
      name: body.name,
      type: body.type,
      config: body.config,
      webhookUrl: body.webhookUrl,
    },
  });

  return NextResponse.json(rule, { status: 201 });
}
```

- [ ] **Step 2: Implement alert detail route**

```typescript
// apps/web/app/api/projects/[projectId]/alerts/[alertId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/middleware";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; alertId: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { alertId } = await params;
  const body = await request.json();

  const rule = await prisma.alertRule.update({
    where: { id: alertId },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.config !== undefined && { config: body.config }),
      ...(body.webhookUrl !== undefined && { webhookUrl: body.webhookUrl }),
      ...(body.enabled !== undefined && { enabled: body.enabled }),
    },
  });

  return NextResponse.json(rule);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string; alertId: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { alertId } = await params;
  await prisma.alertRule.delete({ where: { id: alertId } });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Implement webhook delivery**

```typescript
// apps/web/lib/alerts/webhook.ts

export async function deliverWebhook(
  url: string,
  payload: Record<string, unknown>
): Promise<number | null> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });
    return response.status;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Implement alert evaluator**

```typescript
// apps/web/lib/alerts/evaluator.ts
import { prisma } from "@/lib/db/prisma";
import { deliverWebhook } from "./webhook";
import type { AlertRule } from "@prisma/client";

interface AlertConfig {
  threshold: number;
  windowMinutes: number;
  agentName?: string;
}

export async function evaluateAlertRules(): Promise<void> {
  const rules = await prisma.alertRule.findMany({
    where: { enabled: true },
  });

  for (const rule of rules) {
    const triggered = await evaluateRule(rule);
    if (triggered) {
      await triggerAlert(rule, triggered);
    }
  }
}

async function evaluateRule(
  rule: AlertRule
): Promise<Record<string, unknown> | null> {
  const config = rule.config as unknown as AlertConfig;
  const since = new Date(
    Date.now() - (config.windowMinutes ?? 5) * 60 * 1000
  );

  switch (rule.type) {
    case "error_spike": {
      const count = await prisma.event.count({
        where: {
          projectId: rule.projectId,
          level: "error",
          receivedAt: { gte: since },
        },
      });
      if (count >= config.threshold) {
        return { type: "error_spike", count, threshold: config.threshold };
      }
      return null;
    }

    case "failure_rate": {
      const [total, failures] = await Promise.all([
        prisma.agentRun.count({
          where: {
            projectId: rule.projectId,
            startedAt: { gte: since },
            ...(config.agentName && { agentName: config.agentName }),
          },
        }),
        prisma.agentRun.count({
          where: {
            projectId: rule.projectId,
            startedAt: { gte: since },
            status: "failure",
            ...(config.agentName && { agentName: config.agentName }),
          },
        }),
      ]);

      if (total === 0) return null;
      const failureRate = (failures / total) * 100;
      if (failureRate >= config.threshold) {
        return {
          type: "failure_rate",
          failureRate: Math.round(failureRate * 10) / 10,
          threshold: config.threshold,
          total,
          failures,
        };
      }
      return null;
    }

    case "cost_threshold": {
      const result = await prisma.agentRun.aggregate({
        where: {
          projectId: rule.projectId,
          startedAt: { gte: since },
          ...(config.agentName && { agentName: config.agentName }),
        },
        _sum: { totalCost: true },
      });

      const totalCost = Number(result._sum.totalCost ?? 0);
      if (totalCost >= config.threshold) {
        return {
          type: "cost_threshold",
          totalCost,
          threshold: config.threshold,
        };
      }
      return null;
    }

    default:
      return null;
  }
}

async function triggerAlert(
  rule: AlertRule,
  payload: Record<string, unknown>
): Promise<void> {
  const webhookPayload = {
    alert: rule.name,
    type: rule.type,
    projectId: rule.projectId,
    triggeredAt: new Date().toISOString(),
    ...payload,
  };

  const webhookStatus = await deliverWebhook(rule.webhookUrl, webhookPayload);

  await prisma.$transaction([
    prisma.alertHistory.create({
      data: {
        ruleId: rule.id,
        projectId: rule.projectId,
        triggeredAt: new Date(),
        payload: webhookPayload,
        webhookStatus,
      },
    }),
    prisma.alertRule.update({
      where: { id: rule.id },
      data: { lastTriggeredAt: new Date() },
    }),
  ]);
}
```

- [ ] **Step 5: Implement background jobs**

```typescript
// apps/web/lib/jobs/alert-check.ts
import { evaluateAlertRules } from "@/lib/alerts/evaluator";

export async function runAlertCheck(): Promise<void> {
  await evaluateAlertRules();
}
```

```typescript
// apps/web/lib/jobs/cleanup.ts
import { prisma } from "@/lib/db/prisma";

export async function runCleanup(): Promise<void> {
  const projects = await prisma.project.findMany({
    select: { id: true, retentionDays: true },
  });

  for (const project of projects) {
    const cutoff = new Date(
      Date.now() - project.retentionDays * 24 * 60 * 60 * 1000
    );

    // Delete old events (groups are kept with counts)
    await prisma.event.deleteMany({
      where: { projectId: project.id, receivedAt: { lt: cutoff } },
    });

    // Delete old tool calls and llm calls via their runs
    const oldRuns = await prisma.agentRun.findMany({
      where: { projectId: project.id, startedAt: { lt: cutoff } },
      select: { id: true },
    });

    const oldRunIds = oldRuns.map((r) => r.id);
    if (oldRunIds.length > 0) {
      await prisma.toolCall.deleteMany({
        where: { runId: { in: oldRunIds } },
      });
      await prisma.llmCall.deleteMany({
        where: { runId: { in: oldRunIds } },
      });
      await prisma.step.deleteMany({
        where: { runId: { in: oldRunIds } },
      });
      await prisma.agentRun.deleteMany({
        where: { id: { in: oldRunIds } },
      });
    }

    // Delete old alert history
    await prisma.alertHistory.deleteMany({
      where: { projectId: project.id, triggeredAt: { lt: cutoff } },
    });
  }
}
```

```typescript
// apps/web/lib/jobs/worker.ts
import PgBoss from "pg-boss";
import { runAlertCheck } from "./alert-check";
import { runCleanup } from "./cleanup";

let boss: PgBoss | null = null;

export async function startWorker(): Promise<void> {
  if (boss) return;

  boss = new PgBoss(process.env.DATABASE_URL!);

  boss.on("error", (error) => {
    console.error("[pg-boss] Error:", error);
  });

  await boss.start();

  // Alert check — every 60 seconds
  await boss.schedule("alert-check", "* * * * *");
  await boss.work("alert-check", async () => {
    await runAlertCheck();
  });

  // Cleanup — daily at 3am
  await boss.schedule("cleanup", "0 3 * * *");
  await boss.work("cleanup", async () => {
    await runCleanup();
  });

  console.log("[pg-boss] Worker started");
}

export async function stopWorker(): Promise<void> {
  if (boss) {
    await boss.stop();
    boss = null;
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/api/projects/\[projectId\]/alerts/ apps/web/lib/alerts/ apps/web/lib/jobs/
git commit -m "feat: add alerting system with evaluation engine, webhooks, and background jobs"
```

---

### Task 11: Dashboard UI — Layout & Setup

**Files:**
- Create: `apps/web/app/globals.css`
- Create: `apps/web/app/layout.tsx`
- Create: `apps/web/app/page.tsx`
- Create: `apps/web/app/setup/page.tsx`
- Create: `apps/web/app/login/page.tsx`
- Create: `apps/web/tailwind.config.ts`
- Create: `apps/web/postcss.config.js`

- [ ] **Step 1: Create Tailwind config**

```typescript
// apps/web/tailwind.config.ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
```

```javascript
// apps/web/postcss.config.js
module.exports = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
```

- [ ] **Step 2: Create globals.css**

```css
/* apps/web/app/globals.css */
@import "tailwindcss";

body {
  @apply bg-gray-950 text-gray-100;
}
```

- [ ] **Step 3: Create root layout**

```tsx
// apps/web/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sentro",
  description: "Error tracking and agent observability",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-gray-950 text-gray-100 antialiased">
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Create root page (redirect logic)**

```tsx
// apps/web/app/page.tsx
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { validateSession } from "@/lib/auth/session";

export default async function Home() {
  const user = await prisma.user.findFirst();
  if (!user) {
    redirect("/setup");
  }

  const session = await validateSession();
  if (!session) {
    redirect("/login");
  }

  redirect("/projects");
}
```

- [ ] **Step 5: Create setup page**

```tsx
// apps/web/app/setup/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SetupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error);
      setLoading(false);
      return;
    }

    router.push("/projects");
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-green-500">Sentro</h1>
          <p className="mt-2 text-sm text-gray-400">
            Create your admin account to get started
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-gray-100 placeholder-gray-500 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
              placeholder="admin@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300">
              Password
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-gray-100 placeholder-gray-500 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
              placeholder="At least 8 characters"
            />
          </div>

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-50"
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Create login page**

```tsx
// apps/web/app/login/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error);
      setLoading(false);
      return;
    }

    router.push("/projects");
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-green-500">Sentro</h1>
          <p className="mt-2 text-sm text-gray-400">Sign in to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-gray-100 placeholder-gray-500 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-gray-100 placeholder-gray-500 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
            />
          </div>

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Run dev server to verify setup/login pages render**

Run: `cd apps/web && npm run dev`
Expected: Server starts on http://localhost:3000. Navigate to `/setup` — see the setup form. Navigate to `/login` — see the login form.

- [ ] **Step 8: Commit**

```bash
git add apps/web/app/ apps/web/tailwind.config.ts apps/web/postcss.config.js
git commit -m "feat: add root layout, setup wizard, and login page"
```

---

### Task 12: Dashboard UI — Navigation & Project Pages

**Files:**
- Create: `apps/web/components/nav.tsx`
- Create: `apps/web/components/project-selector.tsx`
- Create: `apps/web/app/(dashboard)/layout.tsx`
- Create: `apps/web/app/(dashboard)/projects/page.tsx`
- Create: `apps/web/app/(dashboard)/projects/new/page.tsx`
- Create: `apps/web/app/(dashboard)/[projectId]/layout.tsx`

- [ ] **Step 1: Create navigation component**

```tsx
// apps/web/components/nav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavProps {
  projectId?: string;
  projectName?: string;
}

const projectTabs = [
  { name: "Issues", href: "issues" },
  { name: "Agent Runs", href: "runs" },
  { name: "Performance", href: "performance" },
  { name: "Alerts", href: "alerts" },
];

export function Nav({ projectId, projectName }: NavProps) {
  const pathname = usePathname();

  return (
    <nav className="border-b border-gray-800 bg-gray-950">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-6">
        <Link href="/projects" className="text-lg font-bold text-green-500">
          Sentro
        </Link>

        {projectName && (
          <span className="rounded bg-gray-800 px-2.5 py-1 text-xs text-gray-200">
            {projectName}
          </span>
        )}

        {projectId && (
          <div className="ml-4 flex gap-3">
            {projectTabs.map((tab) => {
              const href = `/${projectId}/${tab.href}`;
              const isActive = pathname.includes(`/${tab.href}`);
              return (
                <Link
                  key={tab.href}
                  href={href}
                  className={`text-xs font-medium pb-0.5 ${
                    isActive
                      ? "text-purple-400 border-b-2 border-purple-400"
                      : "text-gray-500 hover:text-gray-300"
                  }`}
                >
                  {tab.name}
                </Link>
              );
            })}
          </div>
        )}

        <div className="ml-auto">
          <button
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              window.location.href = "/login";
            }}
            className="text-xs text-gray-500 hover:text-gray-300"
          >
            Sign Out
          </button>
        </div>
      </div>
    </nav>
  );
}
```

- [ ] **Step 2: Create dashboard layout**

```tsx
// apps/web/app/(dashboard)/layout.tsx
import { redirect } from "next/navigation";
import { validateSession } from "@/lib/auth/session";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await validateSession();
  if (!session) {
    redirect("/login");
  }

  return <>{children}</>;
}
```

- [ ] **Step 3: Create projects list page**

```tsx
// apps/web/app/(dashboard)/projects/page.tsx
import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { Nav } from "@/components/nav";

export default async function ProjectsPage() {
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <>
      <Nav />
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Projects</h1>
          <Link
            href="/projects/new"
            className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-500"
          >
            New Project
          </Link>
        </div>

        {projects.length === 0 ? (
          <div className="mt-12 text-center text-gray-500">
            <p>No projects yet.</p>
            <p className="mt-1 text-sm">Create one to start tracking errors and agent runs.</p>
          </div>
        ) : (
          <div className="mt-6 grid gap-4">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/${project.id}/issues`}
                className="rounded-lg border border-gray-800 bg-gray-900 p-4 hover:border-gray-700"
              >
                <div className="font-medium">{project.name}</div>
                <div className="mt-1 text-xs text-gray-500">
                  DSN: {project.dsnToken.slice(0, 8)}...
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
```

- [ ] **Step 4: Create new project page**

```tsx
// apps/web/app/(dashboard)/projects/new/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Nav } from "@/components/nav";

export default function NewProjectPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    id: string;
    dsn: string;
  } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });

    const data = await res.json();
    setLoading(false);

    if (res.ok) {
      setResult(data);
    }
  }

  return (
    <>
      <Nav />
      <div className="mx-auto max-w-lg px-6 py-8">
        <h1 className="text-xl font-semibold">Create Project</h1>

        {result ? (
          <div className="mt-6 space-y-4">
            <p className="text-green-400">Project created!</p>
            <div>
              <label className="block text-sm text-gray-400">Your DSN</label>
              <code className="mt-1 block rounded bg-gray-900 p-3 text-xs text-gray-200 break-all">
                {result.dsn}
              </code>
              <p className="mt-2 text-xs text-gray-500">
                Use this in your SDK configuration.
              </p>
            </div>
            <button
              onClick={() => router.push(`/${result.id}/issues`)}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-500"
            >
              Go to Project
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300">
                Project Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-gray-100 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                placeholder="my-agent-app"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create Project"}
            </button>
          </form>
        )}
      </div>
    </>
  );
}
```

- [ ] **Step 5: Create project-scoped layout with tabs**

```tsx
// apps/web/app/(dashboard)/[projectId]/layout.tsx
import { prisma } from "@/lib/db/prisma";
import { Nav } from "@/components/nav";
import { notFound } from "next/navigation";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true },
  });

  if (!project) notFound();

  return (
    <>
      <Nav projectId={project.id} projectName={project.name} />
      <div className="mx-auto max-w-7xl px-6 py-6">{children}</div>
    </>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/ apps/web/app/\(dashboard\)/
git commit -m "feat: add dashboard layout, navigation, project list, and new project page"
```

---

### Task 13: Dashboard UI — Issues Page

**Files:**
- Create: `apps/web/components/issues-table.tsx`
- Create: `apps/web/app/(dashboard)/[projectId]/issues/page.tsx`
- Create: `apps/web/app/(dashboard)/[projectId]/issues/[groupId]/page.tsx`

- [ ] **Step 1: Create issues table component**

```tsx
// apps/web/components/issues-table.tsx
import Link from "next/link";

interface Issue {
  id: string;
  title: string;
  level: string;
  lastSeen: string;
  count: number;
  eventCount: number;
  affectedRunCount: number;
}

export function IssuesTable({
  issues,
  projectId,
}: {
  issues: Issue[];
  projectId: string;
}) {
  if (issues.length === 0) {
    return (
      <div className="py-12 text-center text-gray-500">
        No issues found. That&apos;s a good thing!
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-800">
      {issues.map((issue) => (
        <Link
          key={issue.id}
          href={`/${projectId}/issues/${issue.id}`}
          className="flex items-center gap-4 px-2 py-3.5 hover:bg-gray-900/50"
        >
          <div className="flex-1 min-w-0">
            <div className="truncate font-medium text-sm text-gray-100">
              {issue.title}
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-red-400">
              {issue.eventCount.toLocaleString()}
            </div>
            <div className="text-[10px] text-gray-500">events</div>
          </div>
          <div className="text-right min-w-[70px]">
            <div className="text-xs text-gray-300">
              {new Date(issue.lastSeen).toLocaleString()}
            </div>
            <div className="text-[10px] text-gray-500">last seen</div>
          </div>
          {issue.affectedRunCount > 0 && (
            <div className="rounded bg-purple-500/15 px-2 py-0.5 text-[10px] text-purple-400">
              {issue.affectedRunCount} runs
            </div>
          )}
        </Link>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create issues list page**

```tsx
// apps/web/app/(dashboard)/[projectId]/issues/page.tsx
import { prisma } from "@/lib/db/prisma";
import { IssuesTable } from "@/components/issues-table";

export default async function IssuesPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { projectId } = await params;
  const { status = "open" } = await searchParams;

  const groups = await prisma.eventGroup.findMany({
    where: {
      projectId,
      status: status as "open" | "resolved" | "ignored",
    },
    orderBy: { lastSeen: "desc" },
    take: 50,
  });

  const issues = await Promise.all(
    groups.map(async (group) => {
      const affectedRuns = await prisma.event.findMany({
        where: { groupId: group.id, runId: { not: null } },
        select: { runId: true },
        distinct: ["runId"],
      });
      return {
        id: group.id,
        title: group.title,
        level: group.level,
        lastSeen: group.lastSeen.toISOString(),
        count: group.count,
        eventCount: group.count,
        affectedRunCount: affectedRuns.length,
      };
    })
  );

  const statusOptions = ["open", "resolved", "ignored"] as const;

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        {statusOptions.map((s) => (
          <a
            key={s}
            href={`/${projectId}/issues?status=${s}`}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              status === s
                ? "bg-amber-500 text-black"
                : "bg-gray-800 text-gray-400 hover:text-gray-200"
            }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </a>
        ))}
      </div>

      <IssuesTable issues={issues} projectId={projectId} />
    </div>
  );
}
```

- [ ] **Step 3: Create issue detail page**

```tsx
// apps/web/app/(dashboard)/[projectId]/issues/[groupId]/page.tsx
import { prisma } from "@/lib/db/prisma";
import { notFound } from "next/navigation";

export default async function IssueDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; groupId: string }>;
}) {
  const { projectId, groupId } = await params;

  const group = await prisma.eventGroup.findUnique({
    where: { id: groupId },
    include: {
      events: {
        orderBy: { timestamp: "desc" },
        take: 50,
      },
    },
  });

  if (!group || group.projectId !== projectId) notFound();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-lg font-semibold">{group.title}</h1>
        <div className="mt-2 flex gap-4 text-xs text-gray-400">
          <span>
            First seen: {group.firstSeen.toLocaleString()}
          </span>
          <span>
            Last seen: {group.lastSeen.toLocaleString()}
          </span>
          <span>{group.count} events</span>
        </div>
      </div>

      <div className="space-y-3">
        {group.events.map((event) => (
          <div
            key={event.id}
            className="rounded-lg border border-gray-800 bg-gray-900 p-4"
          >
            <div className="flex items-center justify-between">
              <span
                className={`rounded px-2 py-0.5 text-[10px] font-medium ${
                  event.level === "error"
                    ? "bg-red-500/15 text-red-400"
                    : event.level === "warning"
                      ? "bg-amber-500/15 text-amber-400"
                      : "bg-blue-500/15 text-blue-400"
                }`}
              >
                {event.level}
              </span>
              <span className="text-xs text-gray-500">
                {event.timestamp.toLocaleString()}
              </span>
            </div>
            <p className="mt-2 text-sm">{event.message}</p>
            {event.stackTrace && (
              <pre className="mt-3 overflow-x-auto rounded bg-gray-950 p-3 text-xs text-gray-400">
                {event.stackTrace}
              </pre>
            )}
            {Object.keys(event.tags as object).length > 0 && (
              <div className="mt-3 flex gap-2">
                {Object.entries(event.tags as Record<string, string>).map(
                  ([k, v]) => (
                    <span
                      key={k}
                      className="rounded bg-gray-800 px-2 py-0.5 text-[10px] text-gray-400"
                    >
                      {k}: {v}
                    </span>
                  )
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/issues-table.tsx apps/web/app/\(dashboard\)/\[projectId\]/issues/
git commit -m "feat: add issues list and issue detail pages"
```

---

### Task 14: Dashboard UI — Agent Runs & Step Replay

**Files:**
- Create: `apps/web/components/run-stats.tsx`
- Create: `apps/web/components/runs-table.tsx`
- Create: `apps/web/components/step-timeline.tsx`
- Create: `apps/web/components/tool-call-detail.tsx`
- Create: `apps/web/components/llm-call-detail.tsx`
- Create: `apps/web/app/(dashboard)/[projectId]/runs/page.tsx`
- Create: `apps/web/app/(dashboard)/[projectId]/runs/[runId]/page.tsx`

- [ ] **Step 1: Create run stats bar component**

```tsx
// apps/web/components/run-stats.tsx
interface RunStatsProps {
  totalRuns: number;
  successRate: number;
  avgDurationMs: number;
  totalCost: number;
  totalTokens: number;
}

export function RunStats({
  totalRuns,
  successRate,
  avgDurationMs,
  totalCost,
  totalTokens,
}: RunStatsProps) {
  return (
    <div className="flex gap-8 border-b border-gray-800 pb-4 mb-4">
      <div>
        <div className="text-2xl font-bold text-green-400">
          {totalRuns.toLocaleString()}
        </div>
        <div className="text-[10px] text-gray-500">Total runs (24h)</div>
      </div>
      <div>
        <div className="text-2xl font-bold text-green-400">
          {successRate}%
        </div>
        <div className="text-[10px] text-gray-500">Success rate</div>
      </div>
      <div>
        <div className="text-2xl font-bold text-gray-100">
          {(avgDurationMs / 1000).toFixed(1)}s
        </div>
        <div className="text-[10px] text-gray-500">Avg duration</div>
      </div>
      <div>
        <div className="text-2xl font-bold text-amber-400">
          ${totalCost.toFixed(2)}
        </div>
        <div className="text-[10px] text-gray-500">Total cost (24h)</div>
      </div>
      <div>
        <div className="text-2xl font-bold text-gray-100">
          {totalTokens >= 1000
            ? `${(totalTokens / 1000).toFixed(0)}k`
            : totalTokens}
        </div>
        <div className="text-[10px] text-gray-500">Tokens used</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create runs table component**

```tsx
// apps/web/components/runs-table.tsx
import Link from "next/link";

interface Run {
  id: string;
  agentName: string;
  goal: string | null;
  status: string;
  stepCount: number;
  startedAt: string;
  finishedAt: string | null;
  totalCost: number | string;
}

export function RunsTable({
  runs,
  projectId,
}: {
  runs: Run[];
  projectId: string;
}) {
  if (runs.length === 0) {
    return (
      <div className="py-12 text-center text-gray-500">
        No agent runs recorded yet.
      </div>
    );
  }

  const statusColor: Record<string, string> = {
    success: "bg-green-500",
    failure: "bg-red-500",
    running: "bg-blue-500",
    timeout: "bg-amber-500",
  };

  return (
    <div className="divide-y divide-gray-800">
      {runs.map((run) => {
        const durationMs =
          run.finishedAt
            ? new Date(run.finishedAt).getTime() -
              new Date(run.startedAt).getTime()
            : null;

        return (
          <Link
            key={run.id}
            href={`/${projectId}/runs/${run.id}`}
            className="flex items-center gap-3 px-2 py-3.5 hover:bg-gray-900/50"
          >
            <div
              className={`h-2 w-2 rounded-full ${statusColor[run.status] ?? "bg-gray-500"}`}
            />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm">{run.agentName}</div>
              {run.goal && (
                <div className="text-xs text-gray-500 truncate">
                  {run.goal}
                </div>
              )}
            </div>
            <div className="text-xs text-gray-400">
              {run.stepCount} steps
            </div>
            {durationMs !== null && (
              <div className="text-xs text-gray-400">
                {(durationMs / 1000).toFixed(1)}s
              </div>
            )}
            <div className="text-xs text-amber-400">
              ${Number(run.totalCost).toFixed(3)}
            </div>
            <div className="text-xs text-gray-500 min-w-[60px] text-right">
              {new Date(run.startedAt).toLocaleTimeString()}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Create step timeline component**

```tsx
// apps/web/components/step-timeline.tsx
import { ToolCallDetail } from "./tool-call-detail";
import { LlmCallDetail } from "./llm-call-detail";

interface Step {
  id: string;
  sequenceNumber: number;
  content: string;
  startedAt: string;
  finishedAt: string | null;
  toolCalls: ToolCall[];
  llmCalls: LlmCallData[];
}

interface ToolCall {
  id: string;
  toolName: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  status: string;
  latencyMs: number;
  errorMessage: string | null;
}

interface LlmCallData {
  id: string;
  model: string;
  provider: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number | string;
  latencyMs: number;
  messages: unknown;
  response: unknown;
}

export function StepTimeline({ steps }: { steps: Step[] }) {
  return (
    <div className="space-y-0">
      {steps.map((step, i) => {
        const isLast = i === steps.length - 1;
        const hasFailed = step.toolCalls.some((tc) => tc.status === "error");

        return (
          <div key={step.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${
                  hasFailed
                    ? "bg-red-500 text-white"
                    : "bg-green-500 text-black"
                }`}
              >
                {step.sequenceNumber}
              </div>
              {!isLast && (
                <div
                  className={`w-0.5 flex-1 min-h-[40px] ${
                    hasFailed ? "bg-red-500" : "bg-green-500"
                  }`}
                />
              )}
            </div>
            <div className="flex-1 pb-6">
              <div className="font-medium text-sm">{step.content}</div>

              {step.toolCalls.map((tc) => (
                <ToolCallDetail key={tc.id} toolCall={tc} />
              ))}

              {step.llmCalls.map((lc) => (
                <LlmCallDetail key={lc.id} llmCall={lc} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Create tool call detail component**

```tsx
// apps/web/components/tool-call-detail.tsx
interface ToolCallProps {
  toolCall: {
    toolName: string;
    input: Record<string, unknown>;
    output: Record<string, unknown>;
    status: string;
    latencyMs: number;
    errorMessage: string | null;
  };
}

export function ToolCallDetail({ toolCall }: ToolCallProps) {
  const isError = toolCall.status === "error";

  return (
    <div
      className={`mt-2 rounded p-2.5 text-xs ${
        isError
          ? "border border-red-500/30 bg-red-500/10"
          : "bg-gray-950"
      }`}
    >
      <div className={isError ? "text-red-400" : "text-blue-400"}>
        {isError ? "✗" : "→"} Tool: {toolCall.toolName}
        <span className="ml-2 text-gray-500">{toolCall.latencyMs}ms</span>
      </div>
      {toolCall.errorMessage && (
        <div className="mt-1 text-red-300">{toolCall.errorMessage}</div>
      )}
      {!isError && Object.keys(toolCall.output).length > 0 && (
        <pre className="mt-1 text-gray-500 overflow-x-auto">
          {JSON.stringify(toolCall.output, null, 2)}
        </pre>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Create LLM call detail component**

```tsx
// apps/web/components/llm-call-detail.tsx
interface LlmCallProps {
  llmCall: {
    model: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cost: number | string;
    latencyMs: number;
    messages: unknown;
    response: unknown;
  };
}

export function LlmCallDetail({ llmCall }: LlmCallProps) {
  return (
    <div className="mt-2 rounded bg-gray-950 p-2.5 text-xs">
      <div className="text-purple-400">
        LLM: {llmCall.model}
      </div>
      <div className="mt-1 text-gray-500">
        {llmCall.totalTokens.toLocaleString()} tokens · {llmCall.latencyMs}ms ·
        ${Number(llmCall.cost).toFixed(4)}
      </div>
      {llmCall.messages && (
        <details className="mt-2">
          <summary className="cursor-pointer text-gray-500 hover:text-gray-300">
            Show prompt
          </summary>
          <pre className="mt-1 overflow-x-auto text-gray-400">
            {JSON.stringify(llmCall.messages, null, 2)}
          </pre>
        </details>
      )}
      {llmCall.response && (
        <details className="mt-1">
          <summary className="cursor-pointer text-gray-500 hover:text-gray-300">
            Show response
          </summary>
          <pre className="mt-1 overflow-x-auto text-gray-400">
            {JSON.stringify(llmCall.response, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Create agent runs page**

```tsx
// apps/web/app/(dashboard)/[projectId]/runs/page.tsx
import { prisma } from "@/lib/db/prisma";
import { RunStats } from "@/components/run-stats";
import { RunsTable } from "@/components/runs-table";

export default async function RunsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [runs, totalCount, successCount, agg, completedRuns] =
    await Promise.all([
      prisma.agentRun.findMany({
        where: { projectId, startedAt: { gte: since } },
        orderBy: { startedAt: "desc" },
        take: 50,
        include: { _count: { select: { steps: true } } },
      }),
      prisma.agentRun.count({
        where: { projectId, startedAt: { gte: since } },
      }),
      prisma.agentRun.count({
        where: { projectId, startedAt: { gte: since }, status: "success" },
      }),
      prisma.agentRun.aggregate({
        where: { projectId, startedAt: { gte: since } },
        _sum: { totalTokens: true, totalCost: true },
      }),
      prisma.agentRun.findMany({
        where: {
          projectId,
          startedAt: { gte: since },
          finishedAt: { not: null },
        },
        select: { startedAt: true, finishedAt: true },
      }),
    ]);

  const successRate =
    totalCount > 0
      ? Math.round((successCount / totalCount) * 1000) / 10
      : 0;
  const avgDurationMs =
    completedRuns.length > 0
      ? completedRuns.reduce(
          (sum, r) => sum + (r.finishedAt!.getTime() - r.startedAt.getTime()),
          0
        ) / completedRuns.length
      : 0;

  return (
    <div>
      <RunStats
        totalRuns={totalCount}
        successRate={successRate}
        avgDurationMs={avgDurationMs}
        totalCost={Number(agg._sum.totalCost ?? 0)}
        totalTokens={agg._sum.totalTokens ?? 0}
      />

      <RunsTable
        projectId={projectId}
        runs={runs.map((r) => ({
          id: r.id,
          agentName: r.agentName,
          goal: r.goal,
          status: r.status,
          stepCount: r._count.steps,
          startedAt: r.startedAt.toISOString(),
          finishedAt: r.finishedAt?.toISOString() ?? null,
          totalCost: r.totalCost,
        }))}
      />
    </div>
  );
}
```

- [ ] **Step 7: Create run detail page with step replay**

```tsx
// apps/web/app/(dashboard)/[projectId]/runs/[runId]/page.tsx
import { prisma } from "@/lib/db/prisma";
import { StepTimeline } from "@/components/step-timeline";
import { notFound } from "next/navigation";

export default async function RunDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; runId: string }>;
}) {
  const { projectId, runId } = await params;

  const run = await prisma.agentRun.findUnique({
    where: { id: runId },
    include: {
      steps: {
        orderBy: { sequenceNumber: "asc" },
        include: {
          toolCalls: true,
          llmCalls: true,
        },
      },
    },
  });

  if (!run || run.projectId !== projectId) notFound();

  const durationMs = run.finishedAt
    ? run.finishedAt.getTime() - run.startedAt.getTime()
    : null;

  const statusColor: Record<string, string> = {
    success: "bg-green-500/15 text-green-400",
    failure: "bg-red-500/15 text-red-400",
    running: "bg-blue-500/15 text-blue-400",
    timeout: "bg-amber-500/15 text-amber-400",
  };

  return (
    <div>
      {/* Run header */}
      <div className="mb-6 border-b border-gray-800 pb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold">{run.agentName}</h1>
          <span
            className={`rounded px-2 py-0.5 text-[11px] font-medium ${statusColor[run.status] ?? ""}`}
          >
            {run.status.toUpperCase()}
          </span>
        </div>
        {run.goal && (
          <p className="mt-1 text-sm text-gray-400">Goal: {run.goal}</p>
        )}
        <div className="mt-3 flex gap-6 text-xs text-gray-500">
          {durationMs !== null && (
            <span>
              Duration: <span className="text-gray-200">{(durationMs / 1000).toFixed(1)}s</span>
            </span>
          )}
          <span>
            Tokens: <span className="text-gray-200">{run.totalTokens.toLocaleString()}</span>
          </span>
          <span>
            Cost: <span className="text-amber-400">${Number(run.totalCost).toFixed(4)}</span>
          </span>
          {run.model && (
            <span>
              Model: <span className="text-gray-200">{run.model}</span>
            </span>
          )}
        </div>
        {run.errorMessage && (
          <div className="mt-3 rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
            {run.errorType}: {run.errorMessage}
          </div>
        )}
      </div>

      {/* Step timeline */}
      <StepTimeline
        steps={run.steps.map((s) => ({
          id: s.id,
          sequenceNumber: s.sequenceNumber,
          content: s.content,
          startedAt: s.startedAt.toISOString(),
          finishedAt: s.finishedAt?.toISOString() ?? null,
          toolCalls: s.toolCalls.map((tc) => ({
            id: tc.id,
            toolName: tc.toolName,
            input: tc.input as Record<string, unknown>,
            output: tc.output as Record<string, unknown>,
            status: tc.status,
            latencyMs: tc.latencyMs,
            errorMessage: tc.errorMessage,
          })),
          llmCalls: s.llmCalls.map((lc) => ({
            id: lc.id,
            model: lc.model,
            provider: lc.provider,
            promptTokens: lc.promptTokens,
            completionTokens: lc.completionTokens,
            totalTokens: lc.totalTokens,
            cost: lc.cost,
            latencyMs: lc.latencyMs,
            messages: lc.messages,
            response: lc.response,
          })),
        }))}
      />
    </div>
  );
}
```

- [ ] **Step 8: Commit**

```bash
git add apps/web/components/run-stats.tsx apps/web/components/runs-table.tsx apps/web/components/step-timeline.tsx apps/web/components/tool-call-detail.tsx apps/web/components/llm-call-detail.tsx apps/web/app/\(dashboard\)/\[projectId\]/runs/
git commit -m "feat: add agent runs page and step replay view"
```

---

### Task 15: Dashboard UI — Performance & Alerts Pages

**Files:**
- Create: `apps/web/app/(dashboard)/[projectId]/performance/page.tsx`
- Create: `apps/web/components/performance-charts.tsx`
- Create: `apps/web/app/(dashboard)/[projectId]/alerts/page.tsx`
- Create: `apps/web/app/(dashboard)/[projectId]/alerts/new/page.tsx`
- Create: `apps/web/components/alert-form.tsx`

- [ ] **Step 1: Create performance charts component**

```tsx
// apps/web/components/performance-charts.tsx
"use client";

interface ToolCallRow {
  id: string;
  toolName: string;
  latencyMs: number;
  status: string;
  runId: string;
}

interface LlmCallRow {
  id: string;
  model: string;
  latencyMs: number;
  totalTokens: number;
  cost: number | string;
  runId: string;
}

interface ModelStats {
  model: string;
  calls: number;
  totalTokens: number;
  totalCost: number;
  avgLatencyMs: number;
}

export function PerformanceCharts({
  slowestToolCalls,
  slowestLlmCalls,
  llmByModel,
  projectId,
}: {
  slowestToolCalls: ToolCallRow[];
  slowestLlmCalls: LlmCallRow[];
  llmByModel: ModelStats[];
  projectId: string;
}) {
  return (
    <div className="space-y-8">
      {/* LLM by model */}
      <section>
        <h2 className="text-sm font-semibold text-gray-300 mb-3">
          LLM Usage by Model
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-800 text-left text-gray-500">
                <th className="pb-2">Model</th>
                <th className="pb-2">Calls</th>
                <th className="pb-2">Tokens</th>
                <th className="pb-2">Cost</th>
                <th className="pb-2">Avg Latency</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {llmByModel.map((m) => (
                <tr key={m.model}>
                  <td className="py-2 text-gray-200">{m.model}</td>
                  <td className="py-2 text-gray-400">{m.calls}</td>
                  <td className="py-2 text-gray-400">
                    {m.totalTokens.toLocaleString()}
                  </td>
                  <td className="py-2 text-amber-400">
                    ${m.totalCost.toFixed(4)}
                  </td>
                  <td className="py-2 text-gray-400">{m.avgLatencyMs}ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Slowest tool calls */}
      <section>
        <h2 className="text-sm font-semibold text-gray-300 mb-3">
          Slowest Tool Calls
        </h2>
        <div className="space-y-1">
          {slowestToolCalls.map((tc) => (
            <a
              key={tc.id}
              href={`/${projectId}/runs/${tc.runId}`}
              className="flex items-center gap-3 rounded px-2 py-2 text-xs hover:bg-gray-900"
            >
              <span className="font-medium text-blue-400 min-w-[140px]">
                {tc.toolName}
              </span>
              <div className="flex-1 h-1.5 rounded-full bg-gray-800">
                <div
                  className="h-full rounded-full bg-amber-500"
                  style={{
                    width: `${Math.min((tc.latencyMs / (slowestToolCalls[0]?.latencyMs || 1)) * 100, 100)}%`,
                  }}
                />
              </div>
              <span className="text-gray-400 min-w-[60px] text-right">
                {tc.latencyMs}ms
              </span>
              <span
                className={`min-w-[50px] text-right ${tc.status === "error" ? "text-red-400" : "text-green-400"}`}
              >
                {tc.status}
              </span>
            </a>
          ))}
        </div>
      </section>

      {/* Slowest LLM calls */}
      <section>
        <h2 className="text-sm font-semibold text-gray-300 mb-3">
          Slowest LLM Calls
        </h2>
        <div className="space-y-1">
          {slowestLlmCalls.map((lc) => (
            <a
              key={lc.id}
              href={`/${projectId}/runs/${lc.runId}`}
              className="flex items-center gap-3 rounded px-2 py-2 text-xs hover:bg-gray-900"
            >
              <span className="font-medium text-purple-400 min-w-[140px]">
                {lc.model}
              </span>
              <div className="flex-1 h-1.5 rounded-full bg-gray-800">
                <div
                  className="h-full rounded-full bg-purple-500"
                  style={{
                    width: `${Math.min((lc.latencyMs / (slowestLlmCalls[0]?.latencyMs || 1)) * 100, 100)}%`,
                  }}
                />
              </div>
              <span className="text-gray-400 min-w-[60px] text-right">
                {lc.latencyMs}ms
              </span>
              <span className="text-gray-500 min-w-[60px] text-right">
                {lc.totalTokens} tok
              </span>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Create performance page**

```tsx
// apps/web/app/(dashboard)/[projectId]/performance/page.tsx
import { PerformanceCharts } from "@/components/performance-charts";

export default async function PerformancePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL}/api/projects/${projectId}/performance?hours=24`,
    { cache: "no-store" }
  );

  if (!res.ok) {
    return <div className="text-red-400">Failed to load performance data</div>;
  }

  const data = await res.json();

  return (
    <div>
      <h1 className="text-lg font-semibold mb-6">Performance</h1>
      <PerformanceCharts
        slowestToolCalls={data.slowestToolCalls}
        slowestLlmCalls={data.slowestLlmCalls}
        llmByModel={data.llmByModel}
        projectId={projectId}
      />
    </div>
  );
}
```

- [ ] **Step 3: Create alert form component**

```tsx
// apps/web/components/alert-form.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AlertForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [type, setType] = useState("error_spike");
  const [threshold, setThreshold] = useState("");
  const [windowMinutes, setWindowMinutes] = useState("5");
  const [agentName, setAgentName] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const config: Record<string, unknown> = {
      threshold: Number(threshold),
      windowMinutes: Number(windowMinutes),
    };
    if (agentName) config.agentName = agentName;

    const res = await fetch(`/api/projects/${projectId}/alerts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, type, config, webhookUrl }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error);
      return;
    }

    router.push(`/${projectId}/alerts`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
      <div>
        <label className="block text-sm font-medium text-gray-300">Name</label>
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-green-500 focus:outline-none"
          placeholder="High error rate alert"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300">Type</label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-green-500 focus:outline-none"
        >
          <option value="error_spike">Error Spike</option>
          <option value="failure_rate">Agent Failure Rate</option>
          <option value="cost_threshold">Cost Threshold</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300">
          Threshold
          {type === "error_spike" && " (event count)"}
          {type === "failure_rate" && " (% failure rate)"}
          {type === "cost_threshold" && " ($ amount)"}
        </label>
        <input
          type="number"
          required
          value={threshold}
          onChange={(e) => setThreshold(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-green-500 focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300">
          Time Window (minutes)
        </label>
        <input
          type="number"
          required
          value={windowMinutes}
          onChange={(e) => setWindowMinutes(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-green-500 focus:outline-none"
        />
      </div>

      {(type === "failure_rate" || type === "cost_threshold") && (
        <div>
          <label className="block text-sm font-medium text-gray-300">
            Agent Name (optional — leave blank for all)
          </label>
          <input
            type="text"
            value={agentName}
            onChange={(e) => setAgentName(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-green-500 focus:outline-none"
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-300">
          Webhook URL
        </label>
        <input
          type="url"
          required
          value={webhookUrl}
          onChange={(e) => setWebhookUrl(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-green-500 focus:outline-none"
          placeholder="https://hooks.slack.com/services/..."
        />
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-50"
      >
        {loading ? "Creating..." : "Create Alert"}
      </button>
    </form>
  );
}
```

- [ ] **Step 4: Create alerts list page**

```tsx
// apps/web/app/(dashboard)/[projectId]/alerts/page.tsx
import Link from "next/link";
import { prisma } from "@/lib/db/prisma";

export default async function AlertsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const rules = await prisma.alertRule.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { history: true } } },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-semibold">Alerts</h1>
        <Link
          href={`/${projectId}/alerts/new`}
          className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-500"
        >
          New Alert
        </Link>
      </div>

      {rules.length === 0 ? (
        <div className="py-12 text-center text-gray-500">
          No alert rules configured yet.
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className="flex items-center gap-4 rounded-lg border border-gray-800 bg-gray-900 p-4"
            >
              <div
                className={`h-2 w-2 rounded-full ${rule.enabled ? "bg-green-500" : "bg-gray-600"}`}
              />
              <div className="flex-1">
                <div className="font-medium text-sm">{rule.name}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {rule.type.replace("_", " ")} ·{" "}
                  {rule._count.history} times triggered
                  {rule.lastTriggeredAt && (
                    <> · Last: {rule.lastTriggeredAt.toLocaleString()}</>
                  )}
                </div>
              </div>
              <span
                className={`rounded px-2 py-0.5 text-[10px] font-medium ${
                  rule.enabled
                    ? "bg-green-500/15 text-green-400"
                    : "bg-gray-800 text-gray-500"
                }`}
              >
                {rule.enabled ? "Active" : "Disabled"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Create new alert page**

```tsx
// apps/web/app/(dashboard)/[projectId]/alerts/new/page.tsx
import { AlertForm } from "@/components/alert-form";

export default async function NewAlertPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  return (
    <div>
      <h1 className="text-lg font-semibold mb-6">Create Alert Rule</h1>
      <AlertForm projectId={projectId} />
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/\(dashboard\)/\[projectId\]/performance/ apps/web/app/\(dashboard\)/\[projectId\]/alerts/ apps/web/components/performance-charts.tsx apps/web/components/alert-form.tsx
git commit -m "feat: add performance dashboard and alerts management pages"
```

---

### Task 16: Docker Deployment

**Files:**
- Create: `Dockerfile`
- Create: `docker-compose.yml`

- [ ] **Step 1: Create Dockerfile**

```dockerfile
# Dockerfile
FROM node:22-alpine AS base

# Install dependencies
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY packages/sdk/package.json packages/sdk/
RUN npm ci

# Build SDK
FROM base AS sdk-build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY packages/sdk/ packages/sdk/
COPY tsconfig.json ./
RUN cd packages/sdk && npx tsc

# Build web app
FROM base AS web-build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=sdk-build /app/packages/sdk/dist packages/sdk/dist
COPY --from=sdk-build /app/packages/sdk/package.json packages/sdk/
COPY apps/web/ apps/web/
COPY tsconfig.json turbo.json package.json ./

# Generate Prisma client
RUN cd apps/web && npx prisma generate

# Build Next.js
RUN cd apps/web && npm run build

# Production
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=web-build /app/apps/web/.next/standalone ./
COPY --from=web-build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=web-build /app/apps/web/public ./apps/web/public

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/web/server.js"]
```

- [ ] **Step 2: Update next.config.ts for standalone output**

```typescript
// apps/web/next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@sentro/sdk"],
};

export default nextConfig;
```

- [ ] **Step 3: Create docker-compose.yml**

```yaml
# docker-compose.yml
version: "3.8"

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: "postgresql://sentro:sentro@db:5432/sentro?schema=public"
      SESSION_SECRET: "${SESSION_SECRET:-change-me-in-production}"
      NEXT_PUBLIC_APP_URL: "http://localhost:3000"
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: sentro
      POSTGRES_PASSWORD: sentro
      POSTGRES_DB: sentro
    ports:
      - "5432:5432"
    volumes:
      - sentro-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U sentro"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped

volumes:
  sentro-data:
```

- [ ] **Step 4: Test Docker build**

Run: `docker compose build`
Expected: Build completes successfully.

Run: `docker compose up -d`
Expected: Both containers start. `http://localhost:3000` shows the setup page.

Run: `docker compose down`

- [ ] **Step 5: Commit**

```bash
git add Dockerfile docker-compose.yml apps/web/next.config.ts
git commit -m "feat: add Docker deployment with compose (app + postgres)"
```

---

### Task 17: End-to-End Smoke Test

**Files:** None new — this verifies everything works together.

- [ ] **Step 1: Start the stack**

Run: `docker compose up -d`
Expected: Both containers healthy.

- [ ] **Step 2: Complete setup**

Run:
```bash
curl -X POST http://localhost:3000/api/auth/setup \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@test.com", "password": "testpass123"}'
```
Expected: `{"ok": true}` with status 201.

- [ ] **Step 3: Login and create a project**

```bash
# Login and capture cookie
curl -c cookies.txt -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@test.com", "password": "testpass123"}'

# Create project
curl -b cookies.txt -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -d '{"name": "test-project"}'
```

Expected: Returns project with `id` and `dsnToken`. Save the `dsnToken`.

- [ ] **Step 4: Send test events via SDK format**

```bash
DSN_TOKEN="<token from step 3>"

# Send an error event
curl -X POST http://localhost:3000/api/ingest \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DSN_TOKEN" \
  -d '{
    "dsn": "'$DSN_TOKEN'",
    "batch": [
      {
        "type": "event",
        "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
        "level": "error",
        "message": "TypeError: Cannot read property id of undefined",
        "stackTrace": "Error: TypeError\n    at processOrder (order.ts:42:10)"
      }
    ]
  }'
```
Expected: `{"ok": true}` with status 202.

- [ ] **Step 5: Send a full agent run**

```bash
RUN_ID=$(uuidgen)
STEP_ID=$(uuidgen)
TOOL_ID=$(uuidgen)
LLM_ID=$(uuidgen)

curl -X POST http://localhost:3000/api/ingest \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DSN_TOKEN" \
  -d '{
    "dsn": "'$DSN_TOKEN'",
    "batch": [
      {"type": "run.start", "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'", "runId": "'$RUN_ID'", "agent": "test-agent", "goal": "Process test order", "model": "claude-sonnet-4-6"},
      {"type": "step.start", "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'", "stepId": "'$STEP_ID'", "runId": "'$RUN_ID'", "sequenceNumber": 1, "content": "Looking up order"},
      {"type": "tool_call.start", "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'", "toolCallId": "'$TOOL_ID'", "stepId": "'$STEP_ID'", "runId": "'$RUN_ID'", "toolName": "db.query", "input": {"sql": "SELECT * FROM orders WHERE id = 1"}},
      {"type": "tool_call.end", "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'", "toolCallId": "'$TOOL_ID'", "stepId": "'$STEP_ID'", "runId": "'$RUN_ID'", "output": {"id": 1, "total": 99}, "status": "success"},
      {"type": "llm_call.start", "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'", "llmCallId": "'$LLM_ID'", "stepId": "'$STEP_ID'", "runId": "'$RUN_ID'", "model": "claude-sonnet-4-6", "provider": "anthropic"},
      {"type": "llm_call.end", "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'", "llmCallId": "'$LLM_ID'", "stepId": "'$STEP_ID'", "runId": "'$RUN_ID'", "model": "claude-sonnet-4-6", "promptTokens": 150, "completionTokens": 20, "totalTokens": 170, "cost": 0.001},
      {"type": "step.end", "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'", "stepId": "'$STEP_ID'", "runId": "'$RUN_ID'"},
      {"type": "run.end", "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'", "runId": "'$RUN_ID'", "status": "success"}
    ]
  }'
```
Expected: `{"ok": true}` with status 202.

- [ ] **Step 6: Verify data in dashboard**

Wait 2 seconds for the buffer to flush, then:

```bash
# Check issues
curl -b cookies.txt http://localhost:3000/api/projects/<projectId>/issues | jq

# Check runs
curl -b cookies.txt http://localhost:3000/api/projects/<projectId>/runs | jq

# Check run detail
curl -b cookies.txt http://localhost:3000/api/projects/<projectId>/runs/$RUN_ID | jq
```

Expected:
- Issues endpoint returns 1 group with 1 event
- Runs endpoint returns 1 run with stats
- Run detail shows the step with tool call and LLM call

- [ ] **Step 7: Open dashboard in browser**

Navigate to `http://localhost:3000`. Log in. Verify:
- Projects page shows "test-project"
- Issues page shows the TypeError
- Agent Runs page shows the test run with stats
- Click into the run — see the step timeline with tool call and LLM call details

- [ ] **Step 8: Clean up and final commit**

```bash
docker compose down
rm cookies.txt
git add -A
git commit -m "chore: verify end-to-end flow works"
```
