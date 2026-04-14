import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; datasetId: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { datasetId } = await params;
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") ?? "100", 10), 500);

  const items = await prisma.datasetItem.findMany({
    where: { datasetId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json({ items });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; datasetId: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { projectId, datasetId } = await params;
  const { input, expectedOutput, metadata, sourceRunId } = await req.json();

  if (input === undefined) {
    return NextResponse.json({ error: "input is required" }, { status: 400 });
  }

  const item = await prisma.datasetItem.create({
    data: {
      projectId,
      datasetId,
      input,
      expectedOutput: expectedOutput ?? null,
      metadata: metadata ?? {},
      sourceRunId: sourceRunId ?? null,
    },
  });

  return NextResponse.json({ item }, { status: 201 });
}
