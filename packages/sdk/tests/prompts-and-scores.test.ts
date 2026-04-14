import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Sentro } from "../src/client";

const DSN = "http://mytoken@localhost:3000/api/ingest/proj_abc";

describe("getPrompt", () => {
  let sentro: Sentro;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        name: "p",
        body: "hello",
        version: 1,
        variables: [],
        tags: [],
      }),
    });
    global.fetch = fetchSpy;
    sentro = new Sentro({ dsn: DSN, flushIntervalMs: 60000 });
  });

  afterEach(async () => {
    await sentro.shutdown();
    vi.restoreAllMocks();
  });

  it("sends GET with Authorization header", async () => {
    await sentro.getPrompt("my-prompt");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("http://localhost:3000/api/v1/prompts/my-prompt");
    expect(init.headers.Authorization).toBe("Bearer mytoken");
  });

  it("appends tag query param", async () => {
    await sentro.getPrompt("my-prompt", { tag: "production" });

    const [url] = fetchSpy.mock.calls[0];
    expect(url.endsWith("?tag=production")).toBe(true);
  });

  it("appends version query param", async () => {
    await sentro.getPrompt("my-prompt", { version: 3 });

    const [url] = fetchSpy.mock.calls[0];
    expect(url.endsWith("?version=3")).toBe(true);
  });

  it("URL encodes prompt name", async () => {
    await sentro.getPrompt("my prompt/v2");

    const [url] = fetchSpy.mock.calls[0];
    expect(url).toBe(
      `http://localhost:3000/api/v1/prompts/${encodeURIComponent("my prompt/v2")}`
    );
    expect(url).toContain("my%20prompt%2Fv2");
  });

  it("returns parsed JSON body", async () => {
    const result = await sentro.getPrompt("my-prompt");
    expect(result).toEqual({
      name: "p",
      body: "hello",
      version: 1,
      variables: [],
      tags: [],
    });
  });

  it("throws on non-ok response", async () => {
    fetchSpy.mockResolvedValueOnce({ ok: false, status: 404 });
    await expect(sentro.getPrompt("missing")).rejects.toThrow(/404/);
  });
});

describe("getDataset", () => {
  let sentro: Sentro;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        name: "my-dataset",
        description: null,
        items: [
          {
            id: "item_1",
            input: { q: "hi" },
            expectedOutput: "hello",
            metadata: {},
          },
        ],
      }),
    });
    global.fetch = fetchSpy;
    sentro = new Sentro({ dsn: DSN, flushIntervalMs: 60000 });
  });

  afterEach(async () => {
    await sentro.shutdown();
    vi.restoreAllMocks();
  });

  it("fetches dataset items with auth", async () => {
    const result = await sentro.getDataset("my-dataset");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(
      "http://localhost:3000/api/v1/datasets/my-dataset/items"
    );
    expect(init.headers.Authorization).toBe("Bearer mytoken");
    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe("item_1");
  });

  it("throws on non-ok response", async () => {
    fetchSpy.mockResolvedValueOnce({ ok: false, status: 500 });
    await expect(sentro.getDataset("missing")).rejects.toThrow(/500/);
  });
});

describe("score", () => {
  let sentro: Sentro;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = fetchSpy;
    sentro = new Sentro({ dsn: DSN, flushIntervalMs: 60000 });
  });

  afterEach(async () => {
    await sentro.shutdown();
    vi.restoreAllMocks();
  });

  it("sends POST to /api/v1/scores with payload", async () => {
    await sentro.score("run_1", "correctness", 0.95);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("http://localhost:3000/api/v1/scores");
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(init.headers.Authorization).toBe("Bearer mytoken");

    const body = JSON.parse(init.body);
    expect(body.runId).toBe("run_1");
    expect(body.name).toBe("correctness");
    expect(body.value).toBe(0.95);
    expect(body.source).toBe("programmatic");
  });

  it("passes comment and metadata when provided", async () => {
    await sentro.score("run_2", "quality", 0.8, {
      comment: "looks great",
      metadata: { reviewer: "alice", batch: 7 },
    });

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.comment).toBe("looks great");
    expect(body.metadata).toEqual({ reviewer: "alice", batch: 7 });
  });

  it("accepts source: human", async () => {
    await sentro.score("run_3", "helpfulness", 1.0, { source: "human" });

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.source).toBe("human");
  });

  it("accepts source: llm_judge", async () => {
    await sentro.score("run_4", "faithfulness", 0.7, { source: "llm_judge" });

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.source).toBe("llm_judge");
  });
});
