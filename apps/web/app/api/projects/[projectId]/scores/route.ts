import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { projectId } = await params;
  const searchParams = req.nextUrl.searchParams;
  const hours = parseInt(searchParams.get("hours") ?? "168", 10);
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  const aggregated = await prisma.score.groupBy({
    by: ["name", "source"],
    where: { projectId, createdAt: { gte: since } },
    _count: { _all: true },
    _avg: { value: true },
    _min: { value: true },
    _max: { value: true },
  });

  return NextResponse.json({ scores: aggregated });
}
