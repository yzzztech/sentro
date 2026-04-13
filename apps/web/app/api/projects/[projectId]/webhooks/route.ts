import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { WebhookEvent } from "@prisma/client";
import { validateWebhookUrl } from "@/lib/webhooks/validate-url";

const VALID_EVENTS = Object.values(WebhookEvent);

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { projectId } = await params;

  const webhooks = await prisma.webhook.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ webhooks });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { projectId } = await params;
  const body = await request.json();

  const { name, url, events, secret, filters, enabled } = body;

  if (url) {
    const urlValidation = await validateWebhookUrl(url);
    if (!urlValidation.valid) {
      return NextResponse.json(
        { error: `Invalid webhook URL: ${urlValidation.error}` },
        { status: 400 }
      );
    }
  }

  if (!name || !url || !Array.isArray(events) || events.length === 0) {
    return NextResponse.json(
      { error: "name, url, and events (non-empty array) are required" },
      { status: 400 }
    );
  }

  const invalidEvents = events.filter((e: string) => !VALID_EVENTS.includes(e as WebhookEvent));
  if (invalidEvents.length > 0) {
    return NextResponse.json(
      { error: `Invalid event types: ${invalidEvents.join(", ")}. Valid values: ${VALID_EVENTS.join(", ")}` },
      { status: 400 }
    );
  }

  const webhook = await prisma.webhook.create({
    data: {
      projectId,
      name,
      url,
      events: events as WebhookEvent[],
      secret: secret ?? crypto.randomBytes(32).toString("hex"),
      filters: filters ?? {},
      enabled: enabled !== undefined ? Boolean(enabled) : true,
    },
  });

  return NextResponse.json({ webhook }, { status: 201 });
}
