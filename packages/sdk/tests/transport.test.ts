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
