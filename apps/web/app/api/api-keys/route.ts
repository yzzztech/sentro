import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { generateApiKey } from "@/lib/auth/api-key";
import { logAudit } from "@/lib/audit";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const keys = await prisma.apiKey.findMany({
    where: { userId: auth.userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      prefix: true,
      lastUsedAt: true,
      revokedAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ keys });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const generated = generateApiKey();
  const record = await prisma.apiKey.create({
    data: {
      userId: auth.userId,
      name,
      keyHash: generated.keyHash,
      prefix: generated.prefix,
    },
    select: { id: true, name: true, prefix: true, createdAt: true },
  });

  await logAudit({
    action: "api_key.create",
    resource: "api_key",
    resourceId: record.id,
    userId: auth.userId,
    metadata: { name: record.name, prefix: record.prefix },
  });

  // plaintext is returned ONCE, never stored
  return NextResponse.json(
    { key: { ...record, plaintext: generated.plaintext } },
    { status: 201 }
  );
}
