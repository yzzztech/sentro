import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; datasetId: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { projectId, datasetId } = await params;
  const { runId } = await req.json();

  if (!runId) {
    return NextResponse.json({ error: "runId is required" }, { status: 400 });
  }

  const run = await prisma.agentRun.findFirst({
    where: { id: runId, projectId },
    include: {
      llmCalls: {
        orderBy: { startedAt: "desc" },
        take: 1,
      },
    },
  });

  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  // Extract final LLM response as expected output
  const lastLlm = run.llmCalls[0];
  const expectedOutput = lastLlm?.response ?? null;

  const item = await prisma.datasetItem.create({
    data: {
      projectId,
      datasetId,
      input: { goal: run.goal, agent: run.agentName, model: run.model },
      expectedOutput,
      metadata: { importedFromRunId: runId },
      sourceRunId: runId,
    },
  });

  return NextResponse.json({ item }, { status: 201 });
}
