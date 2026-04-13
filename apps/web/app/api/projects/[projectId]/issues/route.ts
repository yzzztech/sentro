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

  const status = searchParams.get("status") ?? "open";
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 200);
  const cursor = searchParams.get("cursor") ?? undefined;

  const groups = await prisma.eventGroup.findMany({
    where: {
      projectId,
      status: status as "open" | "resolved" | "ignored",
    },
    orderBy: { lastSeen: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = groups.length > limit;
  const page = hasMore ? groups.slice(0, limit) : groups;
  const nextCursor = hasMore ? page[page.length - 1]?.id : undefined;

  // Count distinct affected agent runs per group
  const groupIds = page.map((g) => g.id);

  const affectedRunCounts = await prisma.event.groupBy({
    by: ["groupId"],
    where: {
      groupId: { in: groupIds },
      runId: { not: null },
    },
    _count: {
      runId: true,
    },
  });

  const runCountMap = new Map(
    affectedRunCounts.map((r) => [r.groupId, r._count.runId])
  );

  const result = page.map((group) => ({
    ...group,
    eventCount: group.count,
    affectedRunCount: runCountMap.get(group.id) ?? 0,
  }));

  return NextResponse.json({ groups: result, nextCursor });
}
