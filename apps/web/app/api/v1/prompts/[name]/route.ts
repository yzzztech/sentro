import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const authHeader = req.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!bearerToken) {
    return NextResponse.json({ error: "Bearer token required" }, { status: 401 });
  }

  const project = await prisma.project.findUnique({ where: { dsnToken: bearerToken } });
  if (!project) {
    return NextResponse.json({ error: "Invalid DSN" }, { status: 401 });
  }

  const { name } = await params;
  const tag = req.nextUrl.searchParams.get("tag") ?? "production";
  const version = req.nextUrl.searchParams.get("version");

  const prompt = await prisma.prompt.findUnique({
    where: { projectId_name: { projectId: project.id, name } },
  });
  if (!prompt) return NextResponse.json({ error: "Prompt not found" }, { status: 404 });

  let selectedVersion;
  if (version) {
    selectedVersion = await prisma.promptVersion.findUnique({
      where: { promptId_version: { promptId: prompt.id, version: parseInt(version, 10) } },
    });
  } else {
    selectedVersion = await prisma.promptVersion.findFirst({
      where: { promptId: prompt.id, tags: { has: tag } },
      orderBy: { version: "desc" },
    });
    if (!selectedVersion) {
      // Fallback to latest
      selectedVersion = await prisma.promptVersion.findFirst({
        where: { promptId: prompt.id },
        orderBy: { version: "desc" },
      });
    }
  }

  if (!selectedVersion) {
    return NextResponse.json({ error: "No version found" }, { status: 404 });
  }

  return NextResponse.json({
    name: prompt.name,
    version: selectedVersion.version,
    body: selectedVersion.body,
    variables: selectedVersion.variables,
    tags: selectedVersion.tags,
  });
}
