import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { WebhookEvent } from "@prisma/client";

const VALID_EVENTS = Object.values(WebhookEvent);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; webhookId: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { projectId, webhookId } = await params;
  const body = await request.json();

  const { name, url, events, secret, filters, enabled } = body;

  if (events !== undefined) {
    if (!Array.isArray(events) || events.length === 0) {
      return NextResponse.json({ error: "events must be a non-empty array" }, { status: 400 });
    }
    const invalidEvents = events.filter((e: string) => !VALID_EVENTS.includes(e as WebhookEvent));
    if (invalidEvents.length > 0) {
      return NextResponse.json(
        { error: `Invalid event types: ${invalidEvents.join(", ")}` },
        { status: 400 }
      );
    }
  }

  const updated = await prisma.webhook.updateMany({
    where: { id: webhookId, projectId },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(url !== undefined ? { url } : {}),
      ...(events !== undefined ? { events: events as WebhookEvent[] } : {}),
      ...(secret !== undefined ? { secret } : {}),
      ...(filters !== undefined ? { filters } : {}),
      ...(enabled !== undefined ? { enabled: Boolean(enabled) } : {}),
    },
  });

  if (updated.count === 0) {
    return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
  }

  const webhook = await prisma.webhook.findUnique({ where: { id: webhookId } });
  return NextResponse.json({ webhook });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string; webhookId: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { projectId, webhookId } = await params;

  const deleted = await prisma.webhook.deleteMany({
    where: { id: webhookId, projectId },
  });

  if (deleted.count === 0) {
    return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
