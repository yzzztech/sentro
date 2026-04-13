import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string; groupId: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { projectId, groupId } = await params;

  const group = await prisma.eventGroup.findFirst({
    where: { id: groupId, projectId },
    include: {
      events: {
        orderBy: { timestamp: "desc" },
        take: 50,
      },
    },
  });

  if (!group) {
    return NextResponse.json({ error: "Issue not found" }, { status: 404 });
  }

  return NextResponse.json({ group });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; groupId: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { projectId, groupId } = await params;
  const body = await request.json();

  const validStatuses = ["open", "resolved", "ignored"];
  if (!body.status || !validStatuses.includes(body.status)) {
    return NextResponse.json(
      { error: "status must be one of: open, resolved, ignored" },
      { status: 400 }
    );
  }

  const group = await prisma.eventGroup.updateMany({
    where: { id: groupId, projectId },
    data: { status: body.status },
  });

  if (group.count === 0) {
    return NextResponse.json({ error: "Issue not found" }, { status: 404 });
  }

  const updated = await prisma.eventGroup.findUnique({
    where: { id: groupId },
  });

  return NextResponse.json({ group: updated });
}
