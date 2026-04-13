import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { validateSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function RootPage() {
  const anyUser = await prisma.user.findFirst();
  if (!anyUser) {
    redirect("/setup");
  }

  const session = await validateSession();
  if (!session) {
    redirect("/login");
  }

  redirect("/projects");
}
