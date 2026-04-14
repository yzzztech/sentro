import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { projectId } = await params;

  const prompts = await prisma.prompt.findMany({
    where: { projectId },
    orderBy: { updatedAt: "desc" },
    include: {
      versions: {
        orderBy: { version: "desc" },
        take: 1,
      },
    },
  });

  return NextResponse.json({ prompts });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { projectId } = await params;
  const body = await req.json();
  const { name, description, promptBody, variables, tags } = body;

  if (!name || !promptBody) {
    return NextResponse.json({ error: "name and promptBody are required" }, { status: 400 });
  }

  const prompt = await prisma.prompt.upsert({
    where: { projectId_name: { projectId, name } },
    create: { projectId, name, description },
    update: { description },
  });

  const latestVersion = await prisma.promptVersion.findFirst({
    where: { promptId: prompt.id },
    orderBy: { version: "desc" },
    select: { version: true },
  });

  const version = await prisma.promptVersion.create({
    data: {
      promptId: prompt.id,
      projectId,
      version: (latestVersion?.version ?? 0) + 1,
      body: promptBody,
      variables: variables ?? [],
      tags: tags ?? [],
    },
  });

  return NextResponse.json({ prompt, version }, { status: 201 });
}
