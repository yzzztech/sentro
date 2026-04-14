import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; name: string; version: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { projectId, name, version } = await params;
  const { tag, exclusive } = await req.json();

  if (!tag) {
    return NextResponse.json({ error: "tag is required" }, { status: 400 });
  }

  const prompt = await prisma.prompt.findUnique({
    where: { projectId_name: { projectId, name } },
  });
  if (!prompt) return NextResponse.json({ error: "Prompt not found" }, { status: 404 });

  // If exclusive, remove this tag from all other versions first
  if (exclusive) {
    const allVersions = await prisma.promptVersion.findMany({
      where: { promptId: prompt.id, tags: { has: tag } },
    });
    for (const v of allVersions) {
      await prisma.promptVersion.update({
        where: { id: v.id },
        data: { tags: v.tags.filter((t: string) => t !== tag) },
      });
    }
  }

  // Add tag to target version
  const target = await prisma.promptVersion.findUnique({
    where: { promptId_version: { promptId: prompt.id, version: parseInt(version, 10) } },
  });
  if (!target) return NextResponse.json({ error: "Version not found" }, { status: 404 });

  const newTags = Array.from(new Set([...target.tags, tag]));
  const updated = await prisma.promptVersion.update({
    where: { id: target.id },
    data: { tags: newTags },
  });

  return NextResponse.json({ version: updated });
}
