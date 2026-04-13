import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";

export async function POST(req: NextRequest) {
  try {
    const existingUser = await prisma.user.findFirst();
    if (existingUser) {
      return NextResponse.json({ error: "Setup already completed" }, { status: 400 });
    }

    const body = await req.json();
    const { email, password } = body;

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
    }

    if (!password || typeof password !== "string" || password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(password);
    let user;
    try {
      user = await prisma.user.create({
        data: { email, passwordHash },
      });
    } catch (err: unknown) {
      if (err && typeof err === "object" && "code" in err && err.code === "P2002") {
        return NextResponse.json({ error: "Setup already completed" }, { status: 400 });
      }
      throw err;
    }

    await createSession(user.id);

    return NextResponse.json({ message: "Setup completed successfully" }, { status: 201 });
  } catch (error) {
    console.error("Setup error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
