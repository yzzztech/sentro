import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { validateWebhookUrl } from "@/lib/webhooks/validate-url";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { projectId } = await params;

  const rules = await prisma.alertRule.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: { history: true },
      },
    },
  });

  return NextResponse.json({ rules });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { projectId } = await params;
  const body = await request.json();

  const { name, type, config, webhookUrl } = body;

  if (webhookUrl) {
    const urlValidation = await validateWebhookUrl(webhookUrl);
    if (!urlValidation.valid) {
      return NextResponse.json(
        { error: `Invalid webhook URL: ${urlValidation.error}` },
        { status: 400 }
      );
    }
  }

  if (!name || !type || !config || !webhookUrl) {
    return NextResponse.json(
      { error: "name, type, config, and webhookUrl are required" },
      { status: 400 }
    );
  }

  const validTypes = ["error_spike", "failure_rate", "cost_threshold"];
  if (!validTypes.includes(type)) {
    return NextResponse.json(
      { error: "type must be one of: error_spike, failure_rate, cost_threshold" },
      { status: 400 }
    );
  }

  const rule = await prisma.alertRule.create({
    data: {
      projectId,
      name,
      type,
      config,
      webhookUrl,
    },
  });

  return NextResponse.json({ rule }, { status: 201 });
}
