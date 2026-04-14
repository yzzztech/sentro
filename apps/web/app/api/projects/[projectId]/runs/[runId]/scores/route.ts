import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string; runId: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { runId } = await params;

  const scores = await prisma.score.findMany({
    where: { runId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ scores });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; runId: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { projectId, runId } = await params;
  const body = await req.json();
  const { name, value, comment, source, metadata } = body;

  if (!name || typeof value !== "number") {
    return NextResponse.json({ error: "name and numeric value are required" }, { status: 400 });
  }

  const score = await prisma.score.upsert({
    where: {
      runId_name_source: {
        runId,
        name,
        source: source ?? "human",
      },
    },
    create: {
      projectId,
      runId,
      name,
      value,
      comment,
      source: source ?? "human",
      metadata: metadata ?? {},
    },
    update: {
      value,
      comment,
      metadata: metadata ?? {},
    },
  });

  return NextResponse.json({ score }, { status: 201 });
}
