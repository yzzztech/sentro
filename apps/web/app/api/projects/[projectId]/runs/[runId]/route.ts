import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string; runId: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { projectId, runId } = await params;

  const run = await prisma.agentRun.findFirst({
    where: { id: runId, projectId },
    include: {
      steps: {
        orderBy: { sequenceNumber: "asc" },
        include: {
          toolCalls: true,
          llmCalls: true,
        },
      },
      events: {
        orderBy: { timestamp: "desc" },
        take: 10,
      },
    },
  });

  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  return NextResponse.json({ run });
}
