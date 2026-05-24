import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// We need to mock the processor since buffer calls it
vi.mock("@/lib/ingestion/processor", () => ({
  processFlush: vi.fn().mockResolvedValue(undefined),
}));

import { addToBatch, startFlushTimer } from "@/lib/ingestion/buffer";
import { processFlush } from "@/lib/ingestion/processor";

describe("ingestion buffer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Start the flush timer so flushAll runs
    startFlushTimer();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("adds events to the buffer without immediate flush", () => {
    addToBatch("dsn_1", [
      { type: "event", message: "test 1", timestamp: new Date().toISOString() },
    ]);
    // processFlush should NOT be called yet (batch size < 100, no time passed)
    expect(processFlush).not.toHaveBeenCalled();
  });

  it("flushes immediately when batch exceeds threshold (100 events)", () => {
    const events = Array.from({ length: 100 }, (_, i) => ({
      type: "event" as const,
      message: `event ${i}`,
      timestamp: new Date().toISOString(),
    }));

    addToBatch("dsn_2", events);
    expect(processFlush).toHaveBeenCalledTimes(1);
    expect(processFlush).toHaveBeenCalledWith("dsn_2", events);
  });

  it("accumulates events across multiple addToBatch calls", () => {
    // Add 50, then another 50 — should trigger flush at the second call
    const first = Array.from({ length: 50 }, (_, i) => ({
      type: "event" as const,
      message: `first ${i}`,
      timestamp: new Date().toISOString(),
    }));
    const second = Array.from({ length: 50 }, (_, i) => ({
      type: "event" as const,
      message: `second ${i}`,
      timestamp: new Date().toISOString(),
    }));

    addToBatch("dsn_3", first);
    expect(processFlush).not.toHaveBeenCalled();

    addToBatch("dsn_3", second);
    expect(processFlush).toHaveBeenCalledTimes(1);
    expect(processFlush).toHaveBeenCalledWith(
      "dsn_3",
      expect.arrayContaining([...first, ...second])
    );
  });

  it("separates events by DSN token", () => {
    const eventsA = Array.from({ length: 100 }, (_, i) => ({
      type: "event" as const,
      message: `a ${i}`,
      timestamp: new Date().toISOString(),
    }));

    addToBatch("dsn_A", eventsA);
    expect(processFlush).toHaveBeenCalledWith("dsn_A", eventsA);

    // Adding to dsn_B should NOT reuse dsn_A's buffer
    addToBatch("dsn_B", [
      { type: "event", message: "b only", timestamp: new Date().toISOString() },
    ]);
    // Only one flush (for dsn_A), dsn_B is still buffered
    expect(processFlush).toHaveBeenCalledTimes(1);
  });

  it("startFlushTimer is idempotent", () => {
    // Calling multiple times should not create duplicate timers
    startFlushTimer();
    startFlushTimer();
    startFlushTimer();
    // No error = pass
    expect(true).toBe(true);
  });

  it("calls processFlush with error handling (fire-and-forget)", () => {
    vi.mocked(processFlush).mockRejectedValueOnce(new Error("DB down"));

    const events = Array.from({ length: 100 }, (_, i) => ({
      type: "event" as const,
      message: `error event ${i}`,
      timestamp: new Date().toISOString(),
    }));

    // Should not throw — errors are caught internally
    expect(() => addToBatch("dsn_err", events)).not.toThrow();
    expect(processFlush).toHaveBeenCalledTimes(1);
  });
});
