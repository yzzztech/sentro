import crypto from "crypto";
import { prisma } from "@/lib/db/prisma";
import { WebhookEvent } from "@prisma/client";

export { WebhookEvent };

function matchesFilters(filters: Record<string, unknown>, payload: Record<string, unknown>, event: WebhookEvent): boolean {
  if (!filters || Object.keys(filters).length === 0) return true;

  if (filters.agentName && typeof filters.agentName === "string") {
    const payloadAgent =
      payload.agentName ?? payload.agent ?? payload.agent_name;
    if (payloadAgent !== filters.agentName) return false;
  }

  if (filters.errorLevel && typeof filters.errorLevel === "string") {
    const payloadLevel = payload.level ?? payload.errorLevel;
    if (payloadLevel !== filters.errorLevel) return false;
  }

  if (event === WebhookEvent.cost_spike && filters.costThreshold !== undefined) {
    const threshold = Number(filters.costThreshold);
    const cost = Number(payload.totalCost ?? 0);
    if (isNaN(threshold) || cost < threshold) return false;
  }

  return true;
}

function buildSignature(body: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

async function fireWebhook(
  webhook: { id: string; url: string; secret: string | null },
  event: WebhookEvent,
  bodyObj: Record<string, unknown>
): Promise<void> {
  const deliveryId = crypto.randomUUID();
  const body = JSON.stringify(bodyObj);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Sentro-Event": event,
    "X-Sentro-Delivery": deliveryId,
  };

  if (webhook.secret) {
    headers["X-Sentro-Signature"] = `sha256=${buildSignature(body, webhook.secret)}`;
  }

  const res = await fetch(webhook.url, { method: "POST", headers, body });

  if (!res.ok) {
    console.error(
      `[webhooks] delivery ${deliveryId} to ${webhook.url} failed: HTTP ${res.status}`
    );
  }
}

export async function dispatchWebhooks(
  projectId: string,
  event: WebhookEvent,
  payload: Record<string, unknown>
): Promise<void> {
  // Fetch project + matching webhooks
  const [project, webhooks] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId }, select: { id: true, name: true } }),
    prisma.webhook.findMany({
      where: { projectId, enabled: true, events: { has: event } },
    }),
  ]);

  if (!project || webhooks.length === 0) return;

  const timestamp = new Date().toISOString();

  const bodyObj = {
    event,
    timestamp,
    project: { id: project.id, name: project.name },
    data: payload,
  };

  // Filter then fire — fire-and-forget via allSettled
  const tasks = webhooks
    .filter((wh) => matchesFilters(wh.filters as Record<string, unknown>, payload, event))
    .map((wh) => fireWebhook(wh, event, bodyObj));

  Promise.allSettled(tasks).then((results) => {
    results.forEach((r) => {
      if (r.status === "rejected") {
        console.error("[webhooks] unhandled error firing webhook:", r.reason);
      }
    });
  });
}
