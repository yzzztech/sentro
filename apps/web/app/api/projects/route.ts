import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { requireAuth } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const projects = await prisma.project.findMany({
    where: { userId: auth.userId },
    select: {
      id: true,
      name: true,
      dsnToken: true,
      retentionDays: true,
      rateLimitPerMinute: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ projects });
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  const { name } = body;

  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const dsnToken = crypto.randomBytes(16).toString("hex");

  const project = await prisma.project.create({
    data: {
      name,
      dsnToken,
      userId: auth.userId,
    },
  });

  const dsnUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/ingest/${project.dsnToken}`;

  return NextResponse.json({ project, dsnUrl }, { status: 201 });
}
