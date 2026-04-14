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
  const dataset = await prisma.dataset.findUnique({
    where: { projectId_name: { projectId: project.id, name } },
    include: {
      items: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!dataset) {
    return NextResponse.json({ error: "Dataset not found" }, { status: 404 });
  }

  return NextResponse.json({
    name: dataset.name,
    description: dataset.description,
    items: dataset.items.map((i) => ({
      id: i.id,
      input: i.input,
      expectedOutput: i.expectedOutput,
      metadata: i.metadata,
    })),
  });
}
