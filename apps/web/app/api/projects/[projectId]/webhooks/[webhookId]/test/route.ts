import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import crypto from "crypto";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string; webhookId: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { projectId, webhookId } = await params;

  const webhook = await prisma.webhook.findFirst({
    where: { id: webhookId, projectId },
    include: { project: { select: { id: true, name: true } } },
  });

  if (!webhook) {
    return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
  }

  const deliveryId = crypto.randomUUID();
  const bodyObj = {
    event: "test",
    timestamp: new Date().toISOString(),
    project: { id: webhook.project.id, name: webhook.project.name },
    data: { message: "This is a test payload from Sentro." },
  };
  const body = JSON.stringify(bodyObj);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Sentro-Event": "test",
    "X-Sentro-Delivery": deliveryId,
  };

  if (webhook.secret) {
    const sig = crypto
      .createHmac("sha256", webhook.secret)
      .update(body)
      .digest("hex");
    headers["X-Sentro-Signature"] = `sha256=${sig}`;
  }

  try {
    const res = await fetch(webhook.url, { method: "POST", headers, body });
    return NextResponse.json({ status: res.status, ok: res.ok, deliveryId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
