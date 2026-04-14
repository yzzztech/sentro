import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { projectId } = await params;

  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: auth.userId },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  return NextResponse.json({ project });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { projectId } = await params;
  const body = await request.json();

  const data: {
    name?: string;
    retentionDays?: number;
    rateLimitPerMinute?: number;
    driftLoopSteps?: number;
    driftLoopMinutes?: number;
    driftTokenBurn?: number;
    driftRepeatThreshold?: number;
  } = {};

  if (body.name !== undefined) data.name = body.name;
  if (body.retentionDays !== undefined) data.retentionDays = body.retentionDays;
  if (body.rateLimitPerMinute !== undefined)
    data.rateLimitPerMinute = body.rateLimitPerMinute;
  if (body.driftLoopSteps !== undefined) data.driftLoopSteps = body.driftLoopSteps;
  if (body.driftLoopMinutes !== undefined) data.driftLoopMinutes = body.driftLoopMinutes;
  if (body.driftTokenBurn !== undefined) data.driftTokenBurn = body.driftTokenBurn;
  if (body.driftRepeatThreshold !== undefined) data.driftRepeatThreshold = body.driftRepeatThreshold;

  const existing = await prisma.project.findFirst({
    where: { id: projectId, userId: auth.userId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const project = await prisma.project.update({
    where: { id: projectId },
    data,
  });

  return NextResponse.json({ project });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { projectId } = await params;

  const existing = await prisma.project.findFirst({
    where: { id: projectId, userId: auth.userId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  await prisma.project.delete({
    where: { id: projectId },
  });

  return NextResponse.json({ ok: true });
}
