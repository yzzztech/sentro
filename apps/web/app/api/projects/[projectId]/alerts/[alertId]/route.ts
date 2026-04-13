import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; alertId: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { projectId, alertId } = await params;
  const body = await request.json();

  const { name, config, webhookUrl, enabled } = body;

  const updated = await prisma.alertRule.updateMany({
    where: { id: alertId, projectId },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(config !== undefined ? { config } : {}),
      ...(webhookUrl !== undefined ? { webhookUrl } : {}),
      ...(enabled !== undefined ? { enabled } : {}),
    },
  });

  if (updated.count === 0) {
    return NextResponse.json({ error: "Alert rule not found" }, { status: 404 });
  }

  const rule = await prisma.alertRule.findUnique({
    where: { id: alertId },
  });

  return NextResponse.json({ rule });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string; alertId: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { projectId, alertId } = await params;

  const deleted = await prisma.alertRule.deleteMany({
    where: { id: alertId, projectId },
  });

  if (deleted.count === 0) {
    return NextResponse.json({ error: "Alert rule not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
