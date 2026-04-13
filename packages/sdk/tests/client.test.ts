import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Sentro } from "../src/client";

const DSN = "http://mytoken@localhost:3000/api/ingest/proj_abc";

describe("Sentro client", () => {
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

  it("parses DSN — host, token, projectId", async () => {
    sentro.captureMessage("ping");
    await sentro.flush();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("http://localhost:3000/api/ingest");
    expect(init.headers["Authorization"]).toBe("Bearer mytoken");
    const body = JSON.parse(init.body);
    expect(body.dsn).toBe("proj_abc");
  });

  it("captureException sends event with level error, message, and stackTrace", async () => {
    const err = new Error("something went wrong");
    sentro.captureException(err);
    await sentro.flush();

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    const event = body.batch[0];
    expect(event.type).toBe("event");
    expect(event.level).toBe("error");
    expect(event.message).toBe("something went wrong");
    expect(event.stackTrace).toContain("something went wrong");
  });

  it("captureMessage sends event with the specified level", async () => {
    sentro.captureMessage("hello world", "warning");
    await sentro.flush();

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    const event = body.batch[0];
    expect(event.type).toBe("event");
    expect(event.level).toBe("warning");
    expect(event.message).toBe("hello world");
  });

  it("captureMessage defaults to info level", async () => {
    sentro.captureMessage("just info");
    await sentro.flush();

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.batch[0].level).toBe("info");
  });

  it("setTags attaches tags to all events", async () => {
    sentro.setTags({ env: "production", version: "1.2.3" });
    sentro.captureMessage("tagged message");
    await sentro.flush();

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    const event = body.batch[0];
    expect(event.tags).toMatchObject({ env: "production", version: "1.2.3" });
  });

  it("setContext attaches context to all events", async () => {
    sentro.setContext({ userId: "user_123", plan: "pro" });
    sentro.captureMessage("ctx message");
    await sentro.flush();

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    const event = body.batch[0];
    expect(event.context).toMatchObject({ userId: "user_123", plan: "pro" });
  });

  it("setTags merges with defaultTags from config", async () => {
    const s = new Sentro({
      dsn: DSN,
      flushIntervalMs: 60000,
      defaultTags: { service: "my-agent" },
    });
    s.setTags({ env: "staging" });
    s.captureMessage("merged");
    await s.flush();

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    const event = body.batch[0];
    expect(event.tags).toMatchObject({ service: "my-agent", env: "staging" });
    await s.shutdown();
  });
});
