import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; name: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { projectId, name } = await params;
  const searchParams = req.nextUrl.searchParams;
  const tag = searchParams.get("tag");
  const version = searchParams.get("version");

  const prompt = await prisma.prompt.findUnique({
    where: { projectId_name: { projectId, name } },
  });
  if (!prompt) {
    return NextResponse.json({ error: "Prompt not found" }, { status: 404 });
  }

  let selectedVersion;
  if (version) {
    selectedVersion = await prisma.promptVersion.findUnique({
      where: { promptId_version: { promptId: prompt.id, version: parseInt(version, 10) } },
    });
  } else if (tag) {
    selectedVersion = await prisma.promptVersion.findFirst({
      where: { promptId: prompt.id, tags: { has: tag } },
      orderBy: { version: "desc" },
    });
  } else {
    // Latest
    selectedVersion = await prisma.promptVersion.findFirst({
      where: { promptId: prompt.id },
      orderBy: { version: "desc" },
    });
  }

  if (!selectedVersion) {
    return NextResponse.json({ error: "No version found" }, { status: 404 });
  }

  return NextResponse.json({ prompt, version: selectedVersion });
}
