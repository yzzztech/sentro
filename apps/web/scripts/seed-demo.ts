/**
 * Seed demo data for new Sentro installations.
 *
 * Run: cd apps/web && npx tsx scripts/seed-demo.ts
 * Or:  docker compose exec app node --experimental-strip-types apps/web/scripts/seed-demo.ts
 */

import { PrismaClient } from "@prisma/client";
import crypto from "node:crypto";

const prisma = new PrismaClient();

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

function hoursAgo(n: number): Date {
  return new Date(Date.now() - n * 60 * 60 * 1000);
}

function random<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

async function main() {
  console.log("Seeding demo data...");

  // Find or create a user to own the project (Sentro currently has a single-user model)
  const existingUser = await prisma.user.findFirst();
  if (!existingUser) {
    console.log("No user found — run setup first via /setup in the dashboard.");
    return;
  }

  // Remove existing demo project if any (cascades to all child records)
  await prisma.project.deleteMany({ where: { name: "Demo Agent App" } });

  // Create demo project
  const project = await prisma.project.create({
    data: {
      name: "Demo Agent App",
      userId: existingUser.id,
      dsnToken: crypto.randomBytes(16).toString("hex"),
    },
  });
  console.log(`Project created: ${project.id}`);
  console.log(`DSN token: ${project.dsnToken}`);

  const agents = [
    { name: "order-classifier", goal: "Classify incoming customer orders", model: "gpt-4o" },
    { name: "support-bot", goal: "Answer customer support questions", model: "claude-sonnet-4-6" },
    { name: "code-reviewer", goal: "Review pull request diffs", model: "gpt-4o" },
    { name: "email-drafter", goal: "Draft outbound sales emails", model: "claude-haiku-4-5-20251001" },
  ];

  // Create runs over the last 7 days
  const runs: any[] = [];
  for (let i = 0; i < 50; i++) {
    const agent = random(agents);
    const startedAt = daysAgo(Math.random() * 7);
    const durationMs = 500 + Math.random() * 30000;
    const finishedAt = new Date(startedAt.getTime() + durationMs);
    const status = Math.random() < 0.85 ? "success" : Math.random() < 0.7 ? "failure" : "timeout";
    const sessionId = Math.random() < 0.4 ? `sess_${Math.floor(Math.random() * 10)}` : null;
    const userId = sessionId ? `user_${sessionId.split("_")[1]}` : null;
    const totalTokens = Math.round(200 + Math.random() * 5000);
    const totalCost = totalTokens * (0.00002 + Math.random() * 0.00008);

    const run = await prisma.agentRun.create({
      data: {
        projectId: project.id,
        agentName: agent.name,
        goal: agent.goal,
        model: agent.model,
        trigger: random(["api", "scheduled", "manual"]),
        status: status as any,
        totalTokens,
        totalCost,
        sessionId,
        userId,
        errorType: status === "failure" ? random(["TimeoutError", "RateLimitError", "ValidationError"]) : null,
        errorMessage: status === "failure" ? "Demo error for illustration" : null,
        startedAt,
        finishedAt,
        metadata: { demo: true },
      },
    });
    runs.push(run);

    // Create 3-8 steps per run
    const stepCount = 3 + Math.floor(Math.random() * 6);
    let stepStart = startedAt.getTime();
    for (let s = 0; s < stepCount; s++) {
      const stepDuration = durationMs / stepCount;
      const step = await prisma.step.create({
        data: {
          runId: run.id,
          projectId: project.id,
          sequenceNumber: s,
          type: random(["thought", "action", "observation"]) as any,
          content: random([
            "Analyzing the input",
            "Calling external API",
            "Processing response",
            "Making a decision",
            "Formatting output",
          ]),
          startedAt: new Date(stepStart),
          finishedAt: new Date(stepStart + stepDuration),
        },
      });

      // Add 0-2 tool calls per step
      const toolCount = Math.floor(Math.random() * 3);
      for (let t = 0; t < toolCount; t++) {
        await prisma.toolCall.create({
          data: {
            stepId: step.id,
            runId: run.id,
            projectId: project.id,
            toolName: random(["web_search", "database_query", "send_email", "fetch_url", "parse_json"]),
            input: { query: "demo input" },
            output: { result: "demo result" },
            status: (Math.random() < 0.9 ? "success" : "error") as any,
            latencyMs: Math.round(100 + Math.random() * 2000),
            startedAt: new Date(stepStart),
          },
        });
      }

      // Add 0-1 LLM call per step
      if (Math.random() < 0.7) {
        const prompt = Math.round(100 + Math.random() * 500);
        const completion = Math.round(50 + Math.random() * 300);
        await prisma.llmCall.create({
          data: {
            stepId: step.id,
            runId: run.id,
            projectId: project.id,
            model: agent.model,
            provider: agent.model.startsWith("claude") ? "anthropic" : "openai",
            promptTokens: prompt,
            completionTokens: completion,
            totalTokens: prompt + completion,
            cost: (prompt * 0.00002 + completion * 0.00008),
            temperature: 0.7,
            latencyMs: Math.round(500 + Math.random() * 3000),
            startedAt: new Date(stepStart),
            messages: [{ role: "user", content: "Demo input to the LLM" }] as any,
            response: { role: "assistant", content: "Demo response from the LLM" } as any,
          },
        });
      }

      stepStart += stepDuration;
    }
  }
  console.log(`Created ${runs.length} runs with steps, tool calls, and LLM calls`);

  // Create some error events
  const errorFingerprints = ["err_db_timeout", "err_llm_ratelimit", "err_parse_json", "err_auth_failed", "err_unknown"];
  for (const fp of errorFingerprints) {
    const count = 1 + Math.floor(Math.random() * 10);
    const group = await prisma.eventGroup.create({
      data: {
        projectId: project.id,
        fingerprint: fp,
        title: `Demo error: ${fp.replace(/_/g, " ")}`,
        level: random(["error", "warning", "info"]) as any,
        firstSeen: daysAgo(6),
        lastSeen: hoursAgo(Math.random() * 24),
        count,
      },
    });
    for (let i = 0; i < count; i++) {
      await prisma.event.create({
        data: {
          projectId: project.id,
          groupId: group.id,
          runId: runs[Math.floor(Math.random() * runs.length)].id,
          fingerprint: fp,
          level: group.level,
          message: `${group.title} (occurrence ${i + 1})`,
          stackTrace: `  at demoFunc (demo.ts:42)\n  at main (demo.ts:7)`,
          tags: { env: "demo" },
          context: {},
          timestamp: hoursAgo(Math.random() * 168),
        },
      });
    }
  }
  console.log(`Created ${errorFingerprints.length} error groups with events`);

  // Create prompts
  const prompts = [
    {
      name: "order-classifier-prompt",
      description: "Classify order intent from customer message",
      versions: [
        { body: "Classify this order intent: {order}", tags: [] as string[] },
        { body: "You are a classifier. Given: {order}\nReturn one of: cancel, update, refund, info", tags: ["staging"] },
        { body: "Classify the customer intent from the following: {order}\nCategories: cancel, update, refund, info\nRespond with just the category.", tags: ["production"] },
      ],
    },
    {
      name: "support-bot-system",
      description: "System prompt for customer support",
      versions: [
        { body: "You are a helpful support agent.", tags: [] as string[] },
        { body: "You are a helpful support agent for ACME Corp. Be concise and polite.", tags: ["production"] },
      ],
    },
    {
      name: "code-review-prompt",
      description: "Prompt for reviewing PR diffs",
      versions: [
        { body: "Review this code diff and flag issues: {diff}", tags: ["production"] },
      ],
    },
  ];

  for (const p of prompts) {
    const prompt = await prisma.prompt.create({
      data: {
        projectId: project.id,
        name: p.name,
        description: p.description,
      },
    });
    for (let v = 0; v < p.versions.length; v++) {
      await prisma.promptVersion.create({
        data: {
          promptId: prompt.id,
          projectId: project.id,
          version: v + 1,
          body: p.versions[v].body,
          variables: [],
          tags: p.versions[v].tags,
        },
      });
    }
  }
  console.log(`Created ${prompts.length} prompts with versions`);

  // Create datasets
  const orderDataset = await prisma.dataset.create({
    data: {
      projectId: project.id,
      name: "order-classification-tests",
      description: "Test fixtures for the order classifier",
    },
  });
  const orderItems = [
    { input: { order: "I want to cancel order #123" }, expectedOutput: "cancel" },
    { input: { order: "Can I change my shipping address?" }, expectedOutput: "update" },
    { input: { order: "This product is broken, I want my money back" }, expectedOutput: "refund" },
    { input: { order: "Where is my order?" }, expectedOutput: "info" },
    { input: { order: "I want to add another item to order #456" }, expectedOutput: "update" },
  ];
  for (const item of orderItems) {
    await prisma.datasetItem.create({
      data: {
        projectId: project.id,
        datasetId: orderDataset.id,
        input: item.input,
        expectedOutput: item.expectedOutput,
      },
    });
  }

  const supportDataset = await prisma.dataset.create({
    data: {
      projectId: project.id,
      name: "support-qa-tests",
      description: "Common support questions",
    },
  });
  const supportItems = [
    { input: { question: "How do I reset my password?" }, expectedOutput: "Go to settings → security → reset password." },
    { input: { question: "What are your business hours?" }, expectedOutput: "9 AM to 5 PM EST, Mon-Fri." },
    { input: { question: "Where can I find the pricing?" }, expectedOutput: "See https://example.com/pricing" },
  ];
  for (const item of supportItems) {
    await prisma.datasetItem.create({
      data: {
        projectId: project.id,
        datasetId: supportDataset.id,
        input: item.input,
        expectedOutput: item.expectedOutput,
      },
    });
  }
  console.log("Created 2 datasets with items");

  // Create scores on some runs.
  // Score has @@unique([runId, name, source]) — dedupe by picking one source per (run, name).
  const scoreNames = ["correctness", "helpfulness", "latency"];
  const sources = ["human", "llm_judge", "programmatic"];
  for (const run of runs.slice(0, 30)) {
    for (const name of scoreNames) {
      if (Math.random() < 0.5) {
        const source = random(sources);
        await prisma.score.create({
          data: {
            projectId: project.id,
            runId: run.id,
            name,
            value: 0.3 + Math.random() * 0.7,
            source: source as any,
            comment: Math.random() < 0.3 ? `Auto-scored: ${name}` : null,
          },
        });
      }
    }
  }
  console.log("Created demo scores");

  console.log("\n✓ Demo data seeded successfully");
  console.log(`\nProject name: Demo Agent App`);
  console.log(`Project ID:   ${project.id}`);
  console.log(`DSN token:    ${project.dsnToken}`);
  console.log(`\nUse with the SDK:`);
  console.log(`  DSN = "http://${project.dsnToken}@localhost:3000/api/ingest/${project.dsnToken}"`);
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
