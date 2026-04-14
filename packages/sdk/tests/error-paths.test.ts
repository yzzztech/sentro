import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Sentro } from "../src/client";

const DSN = "http://tok@localhost:3000/api/ingest/proj_errs";

function getBatch(
  fetchSpy: ReturnType<typeof vi.fn>,
  callIndex = 0
): Record<string, unknown>[] {
  const body = JSON.parse(fetchSpy.mock.calls[callIndex][1].body);
  return body.batch;
}

describe("run.trace error handling", () => {
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

  it("calls step.end and rethrows when fn throws", async () => {
    const run = sentro.startRun({ agent: "run-trace-err" });

    await expect(
      run.trace("content", async () => {
        throw new Error("oops");
      })
    ).rejects.toThrow("oops");

    await run.end({ status: "failure" });
    await sentro.flush();

    const batch = getBatch(fetchSpy);
    const stepStart = batch.find((e) => e.type === "step.start") as Record<string, unknown>;
    const stepEnd = batch.find((e) => e.type === "step.end") as Record<string, unknown>;
    expect(stepStart).toBeDefined();
    expect(stepEnd).toBeDefined();
    // Step.end should reference the same stepId as step.start
    expect(stepEnd.stepId).toBe(stepStart.stepId);
  });
});

describe("step.traceToolCall error handling", () => {
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

  it("calls tool.error and rethrows when fn throws", async () => {
    const run = sentro.startRun({ agent: "step-trace-err" });
    const step = run.step("tool step");

    await expect(
      step.traceToolCall("broken_tool", { x: 1 }, async () => {
        throw new Error("tool exploded");
      })
    ).rejects.toThrow("tool exploded");

    await step.end();
    await run.end({ status: "failure" });
    await sentro.flush();

    const batch = getBatch(fetchSpy);
    const tcEnd = batch.find((e) => e.type === "tool_call.end") as Record<string, unknown>;
    expect(tcEnd).toBeDefined();
    expect(tcEnd.status).toBe("error");
    expect(tcEnd.error).toBe("tool exploded");
  });

  it("wraps non-Error throws as Error in traceToolCall", async () => {
    const run = sentro.startRun({ agent: "step-trace-nonerr" });
    const step = run.step("tool step");

    await expect(
      step.traceToolCall("broken_tool", {}, async () => {
        // eslint-disable-next-line no-throw-literal
        throw "string failure";
      })
    ).rejects.toBe("string failure");

    await step.end();
    await run.end({ status: "failure" });
    await sentro.flush();

    const batch = getBatch(fetchSpy);
    const tcEnd = batch.find((e) => e.type === "tool_call.end") as Record<string, unknown>;
    expect(tcEnd).toBeDefined();
    expect(tcEnd.status).toBe("error");
    expect(tcEnd.error).toBe("string failure");
  });
});

describe("client.trace error handling", () => {
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

  it("calls run.error with wrapped Error when non-Error thrown", async () => {
    await expect(
      sentro.trace("client-nonerr-agent", {}, async () => {
        // eslint-disable-next-line no-throw-literal
        throw "plain string error";
      })
    ).rejects.toBe("plain string error");

    await sentro.flush();

    const batch = getBatch(fetchSpy);
    const runEnd = batch.find((e) => e.type === "run.end") as Record<string, unknown>;
    expect(runEnd).toBeDefined();
    expect(runEnd.status).toBe("failure");
    expect(runEnd.errorType).toBe("Error");
    expect(runEnd.errorMessage).toBe("plain string error");
  });
});

describe("transport buffer", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn().mockResolvedValue({ ok: true, status: 202 });
    global.fetch = fetchSpy;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("flushes immediately when maxBatchSize is reached", async () => {
    const sentro = new Sentro({
      dsn: DSN,
      flushIntervalMs: 60000,
      maxBatchSize: 2,
    });

    // Two captureMessage calls should hit maxBatchSize and trigger an
    // immediate flush — no timer wait required.
    sentro.captureMessage("one");
    sentro.captureMessage("two");

    // Let the microtask queue drain so the async fetch in flush() runs.
    await Promise.resolve();
    await Promise.resolve();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.batch).toHaveLength(2);
    expect(body.batch[0].message).toBe("one");
    expect(body.batch[1].message).toBe("two");

    await sentro.shutdown();
  });
});
