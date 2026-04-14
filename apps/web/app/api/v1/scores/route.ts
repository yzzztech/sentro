import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!bearerToken) {
    return NextResponse.json({ error: "Bearer token required" }, { status: 401 });
  }

  const project = await prisma.project.findUnique({ where: { dsnToken: bearerToken } });
  if (!project) {
    return NextResponse.json({ error: "Invalid DSN" }, { status: 401 });
  }

  const body = await req.json();
  const { runId, name, value, comment, source, metadata } = body;

  if (!runId || !name || typeof value !== "number") {
    return NextResponse.json({ error: "runId, name, and numeric value are required" }, { status: 400 });
  }

  const validSources = ["human", "llm_judge", "programmatic"];
  const scoreSource = validSources.includes(source) ? source : "programmatic";

  // Verify the run belongs to this project
  const run = await prisma.agentRun.findFirst({
    where: { id: runId, projectId: project.id },
    select: { id: true },
  });
  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  const score = await prisma.score.upsert({
    where: {
      runId_name_source: { runId, name, source: scoreSource },
    },
    create: {
      projectId: project.id,
      runId,
      name,
      value,
      comment,
      source: scoreSource,
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
