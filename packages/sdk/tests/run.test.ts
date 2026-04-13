import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Sentro } from "../src/client";

const DSN = "http://tok@localhost:3000/api/ingest/proj_run";

function getBatch(fetchSpy: ReturnType<typeof vi.fn>, callIndex = 0): Record<string, unknown>[] {
  const body = JSON.parse(fetchSpy.mock.calls[callIndex][1].body);
  return body.batch;
}

describe("SentroRun integration", () => {
  let sentro: Sentro;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn().mockResolvedValue({ ok: true, status: 202 });
    global.fetch = fetchSpy;
    sentro = new Sentro({ dsn: DSN, flushIntervalMs: 60000 });
  });

  afterEach(async () => {
    await sentro.shutdown();
    vi.restoreAllMocks();
  });

  it("full agent run flow — produces events in correct order", async () => {
    const run = sentro.startRun({ agent: "my-agent", goal: "do something" });
    const step = run.step("step 1");
    const tc = step.toolCall("search", { input: { query: "hello" } });
    await tc.end({ result: ["result1"] });
    const llm = step.llmCall({ model: "gpt-4o", provider: "openai" });
    await llm.end({ promptTokens: 100, completionTokens: 50 });
    await step.end();
    await run.end({ status: "success" });
    await sentro.flush();

    const batch = getBatch(fetchSpy);
    const types = batch.map((e) => e.type);
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

    // Verify run event fields
    const runStart = batch[0] as Record<string, unknown>;
    expect(runStart.agent).toBe("my-agent");
    expect(runStart.goal).toBe("do something");
    expect(typeof runStart.runId).toBe("string");

    // Verify tool_call.end
    const tcEnd = batch[3] as Record<string, unknown>;
    expect(tcEnd.status).toBe("success");
    expect(tcEnd.result).toEqual(["result1"]);

    // Verify run.end
    const runEnd = batch[7] as Record<string, unknown>;
    expect(runEnd.status).toBe("success");
  });

  it("step sequence numbers auto-increment", async () => {
    const run = sentro.startRun({ agent: "seq-agent" });
    const s1 = run.step("step one");
    await s1.end();
    const s2 = run.step("step two");
    await s2.end();
    await run.end({ status: "success" });
    await sentro.flush();

    const batch = getBatch(fetchSpy);
    const stepStarts = batch.filter((e) => e.type === "step.start");
    expect(stepStarts[0].seq).toBe(1);
    expect(stepStarts[1].seq).toBe(2);
  });

  it("trace() wrapper auto-ends run on success", async () => {
    const result = await sentro.trace("trace-agent", {}, async (run) => {
      const step = run.step("work");
      await step.end();
      return "done";
    });
    await sentro.flush();

    expect(result).toBe("done");
    const batch = getBatch(fetchSpy);
    const types = batch.map((e) => e.type);
    expect(types).toContain("run.start");
    expect(types).toContain("run.end");
    const runEnd = batch.find((e) => e.type === "run.end") as Record<string, unknown>;
    expect(runEnd.status).toBe("success");
  });

  it("trace() wrapper auto-errors run on throw", async () => {
    await expect(
      sentro.trace("error-agent", {}, async (_run) => {
        throw new Error("agent failed");
      })
    ).rejects.toThrow("agent failed");
    await sentro.flush();

    const batch = getBatch(fetchSpy);
    const runEnd = batch.find((e) => e.type === "run.end") as Record<string, unknown>;
    expect(runEnd).toBeDefined();
    expect(runEnd.status).toBe("failure");
    expect(runEnd.errorMessage).toBe("agent failed");
  });

  it("run.error() sends run.end with failure status", async () => {
    const run = sentro.startRun({ agent: "fail-agent" });
    await run.error(new Error("critical failure"));
    await sentro.flush();

    const batch = getBatch(fetchSpy);
    const runEnd = batch.find((e) => e.type === "run.end") as Record<string, unknown>;
    expect(runEnd.status).toBe("failure");
    expect(runEnd.errorMessage).toBe("critical failure");
    expect(runEnd.errorType).toBe("Error");
  });

  it("capturePrompts: false omits messages and response from llm events", async () => {
    const s = new Sentro({ dsn: DSN, flushIntervalMs: 60000, capturePrompts: false });
    const run = s.startRun({ agent: "llm-agent" });
    const step = run.step("llm step");
    const llm = step.llmCall({
      model: "gpt-4o",
      messages: [{ role: "user", content: "hello" }],
    });
    await llm.end({ response: "hi there", promptTokens: 10 });
    await step.end();
    await run.end({ status: "success" });
    await s.flush();

    const batch = getBatch(fetchSpy);
    const llmStart = batch.find((e) => e.type === "llm_call.start") as Record<string, unknown>;
    const llmEnd = batch.find((e) => e.type === "llm_call.end") as Record<string, unknown>;

    expect(llmStart.messages).toBeUndefined();
    expect(llmEnd.response).toBeUndefined();
    expect(llmEnd.promptTokens).toBe(10);

    await s.shutdown();
  });

  it("capturePrompts: true includes messages and response in llm events", async () => {
    const s = new Sentro({ dsn: DSN, flushIntervalMs: 60000, capturePrompts: true });
    const run = s.startRun({ agent: "llm-agent" });
    const step = run.step("llm step");
    const llm = step.llmCall({
      model: "gpt-4o",
      messages: [{ role: "user", content: "hello" }],
    });
    await llm.end({ response: "hi there", promptTokens: 10 });
    await step.end();
    await run.end({ status: "success" });
    await s.flush();

    const batch = getBatch(fetchSpy);
    const llmStart = batch.find((e) => e.type === "llm_call.start") as Record<string, unknown>;
    const llmEnd = batch.find((e) => e.type === "llm_call.end") as Record<string, unknown>;

    expect(llmStart.messages).toEqual([{ role: "user", content: "hello" }]);
    expect(llmEnd.response).toBe("hi there");

    await s.shutdown();
  });

  it("toolCall error sets status to error", async () => {
    const run = sentro.startRun({ agent: "tool-agent" });
    const step = run.step("tool step");
    const tc = step.toolCall("fetch_url");
    await tc.error(new Error("timeout"));
    await step.end();
    await run.end({ status: "failure" });
    await sentro.flush();

    const batch = getBatch(fetchSpy);
    const tcEnd = batch.find((e) => e.type === "tool_call.end") as Record<string, unknown>;
    expect(tcEnd.status).toBe("error");
    expect(tcEnd.error).toBe("timeout");
  });

  it("traceToolCall auto-ends on success and auto-errors on throw", async () => {
    // Success case
    const run1 = sentro.startRun({ agent: "trace-tool-agent" });
    const step1 = run1.step("step");
    const val = await step1.traceToolCall("compute", { x: 1 }, async () => "result");
    expect(val).toBe("result");
    await step1.end();
    await run1.end({ status: "success" });
    await sentro.flush();

    let batch = getBatch(fetchSpy, 0);
    let tcEnd = batch.find((e) => e.type === "tool_call.end") as Record<string, unknown>;
    expect(tcEnd.status).toBe("success");

    // Error case
    fetchSpy.mockClear();
    const run2 = sentro.startRun({ agent: "trace-tool-agent" });
    const step2 = run2.step("step");
    await expect(
      step2.traceToolCall("broken", {}, async () => {
        throw new Error("tool broke");
      })
    ).rejects.toThrow("tool broke");
    await step2.end();
    await run2.end({ status: "failure" });
    await sentro.flush();

    batch = getBatch(fetchSpy, 0);
    tcEnd = batch.find((e) => e.type === "tool_call.end") as Record<string, unknown>;
    expect(tcEnd.status).toBe("error");
    expect(tcEnd.error).toBe("tool broke");
  });
});
