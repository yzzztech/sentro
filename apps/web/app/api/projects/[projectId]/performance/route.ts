import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { projectId } = await params;
  const { searchParams } = new URL(request.url);

  const hours = parseInt(searchParams.get("hours") ?? "24", 10);
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  const [slowestToolCalls, slowestLlmCalls, llmByModel] = await Promise.all([
    prisma.toolCall.findMany({
      where: {
        projectId,
        startedAt: { gte: since },
      },
      select: {
        id: true,
        toolName: true,
        latencyMs: true,
        status: true,
        startedAt: true,
        runId: true,
      },
      orderBy: { latencyMs: "desc" },
      take: 20,
    }),

    prisma.llmCall.findMany({
      where: {
        projectId,
        startedAt: { gte: since },
      },
      select: {
        id: true,
        model: true,
        latencyMs: true,
        totalTokens: true,
        cost: true,
        startedAt: true,
        runId: true,
      },
      orderBy: { latencyMs: "desc" },
      take: 20,
    }),

    prisma.llmCall.groupBy({
      by: ["model"],
      where: {
        projectId,
        startedAt: { gte: since },
      },
      _sum: {
        totalTokens: true,
        cost: true,
      },
      _count: {
        id: true,
      },
      _avg: {
        latencyMs: true,
      },
    }),
  ]);

  return NextResponse.json({
    slowestToolCalls,
    slowestLlmCalls,
    llmByModel,
  });
}
