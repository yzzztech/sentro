import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    project: {
      findUnique: vi.fn(),
    },
    webhook: {
      findMany: vi.fn(),
    },
  },
}));

import { dispatchWebhooks, WebhookEvent } from "@/lib/webhooks/dispatcher";
import { prisma } from "@/lib/db/prisma";

// Mock global fetch for webhook delivery
const mockFetch = vi.fn().mockResolvedValue({ ok: true });
global.fetch = mockFetch as unknown as typeof fetch;

function mockProject(id = "proj_1") {
  const project = { id, name: "Test Project" };
  vi.mocked(prisma.project.findUnique).mockResolvedValue(project as never);
  return project;
}

describe("dispatchWebhooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockClear();
    vi.mocked(prisma.webhook.findMany).mockResolvedValue([]);
    vi.mocked(prisma.project.findUnique).mockResolvedValue(null);
  });

  it("returns early when project not found", async () => {
    await dispatchWebhooks("nonexistent", WebhookEvent.error_new, {
      groupId: "g1",
      title: "test",
    });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns early when no matching webhooks exist", async () => {
    mockProject("proj_1");
    vi.mocked(prisma.webhook.findMany).mockResolvedValue([]);

    await dispatchWebhooks("proj_1", WebhookEvent.error_new, {
      groupId: "g1",
      title: "test",
    });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("fires webhooks with correct headers and payload", async () => {
    mockProject("proj_1");
    vi.mocked(prisma.webhook.findMany).mockResolvedValue([
      {
        id: "wh_1",
        url: "https://example.com/hook",
        secret: "my-secret",
        events: [WebhookEvent.error_new],
        enabled: true,
        filters: {},
      } as never,
    ]);

    await dispatchWebhooks("proj_1", WebhookEvent.error_new, {
      groupId: "g1",
      title: "Test Error",
      level: "error",
      message: "Something broke",
    });

    // Wait for async Promise.allSettled
    await new Promise((r) => setTimeout(r, 50));

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];

    expect(url).toBe("https://example.com/hook");
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(init.headers["X-Sentro-Event"]).toBe("error_new");
    expect(init.headers["X-Sentro-Delivery"]).toBeDefined();
    expect(init.headers["X-Sentro-Signature"]).toMatch(/^sha256=/);

    const body = JSON.parse(init.body);
    expect(body.event).toBe("error_new");
    expect(body.project.id).toBe("proj_1");
    expect(body.project.name).toBe("Test Project");
    expect(body.data.groupId).toBe("g1");
    expect(body.data.title).toBe("Test Error");
  });

  it("does not include HMAC signature when webhook has no secret", async () => {
    mockProject("proj_2");
    vi.mocked(prisma.webhook.findMany).mockResolvedValue([
      {
        id: "wh_2",
        url: "https://no-secret.example.com/hook",
        secret: null,
        events: [WebhookEvent.run_completed],
        enabled: true,
        filters: {},
      } as never,
    ]);

    await dispatchWebhooks("proj_2", WebhookEvent.run_completed, {
      runId: "r1",
      status: "success",
    });

    await new Promise((r) => setTimeout(r, 50));

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers["X-Sentro-Signature"]).toBeUndefined();
  });

  it("filters webhooks by agentName", async () => {
    mockProject("proj_3");
    vi.mocked(prisma.webhook.findMany).mockResolvedValue([
      {
        id: "wh_3",
        url: "https://filtered.example.com/hook",
        secret: null,
        events: [WebhookEvent.run_completed],
        enabled: true,
        filters: { agentName: "my-agent" },
      } as never,
    ]);

    // Payload has different agentName — should be filtered out
    await dispatchWebhooks("proj_3", WebhookEvent.run_completed, {
      runId: "r1",
      agentName: "other-agent",
      status: "success",
    });

    await new Promise((r) => setTimeout(r, 50));

    // Should not fire because agentName doesn't match
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("filters webhooks by costThreshold for cost_spike events", async () => {
    mockProject("proj_4");
    vi.mocked(prisma.webhook.findMany).mockResolvedValue([
      {
        id: "wh_4",
        url: "https://cost.example.com/hook",
        secret: null,
        events: [WebhookEvent.cost_spike],
        enabled: true,
        filters: { costThreshold: 5 },
      } as never,
    ]);

    // Cost below threshold — should be filtered out
    await dispatchWebhooks("proj_4", WebhookEvent.cost_spike, {
      runId: "r1",
      totalCost: 1,
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(mockFetch).not.toHaveBeenCalled();

    // Cost above threshold — should fire
    await dispatchWebhooks("proj_4", WebhookEvent.cost_spike, {
      runId: "r2",
      totalCost: 10,
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("filters by driftType for drift_detected events", async () => {
    mockProject("proj_5");
    vi.mocked(prisma.webhook.findMany).mockResolvedValue([
      {
        id: "wh_5",
        url: "https://drift.example.com/hook",
        secret: null,
        events: [WebhookEvent.drift_detected],
        enabled: true,
        filters: { driftType: "loop_detected" },
      } as never,
    ]);

    // Wrong drift type
    await dispatchWebhooks("proj_5", WebhookEvent.drift_detected, {
      runId: "r1",
      driftType: "token_burn",
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(mockFetch).not.toHaveBeenCalled();

    // Correct drift type
    await dispatchWebhooks("proj_5", WebhookEvent.drift_detected, {
      runId: "r2",
      driftType: "loop_detected",
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("supports array driftType filters", async () => {
    mockProject("proj_6");
    vi.mocked(prisma.webhook.findMany).mockResolvedValue([
      {
        id: "wh_6",
        url: "https://multi-drift.example.com/hook",
        secret: null,
        events: [WebhookEvent.drift_detected],
        enabled: true,
        filters: { driftType: ["loop_detected", "token_burn"] },
      } as never,
    ]);

    await dispatchWebhooks("proj_6", WebhookEvent.drift_detected, {
      runId: "r1",
      driftType: "token_burn",
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
