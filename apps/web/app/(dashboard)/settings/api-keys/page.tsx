import { redirect } from "next/navigation";
import { validateSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import ApiKeysManager from "@/components/api-keys-manager";
import Nav from "@/components/nav";

export default async function ApiKeysPage() {
  const session = await validateSession();
  if (!session) redirect("/login");

  const keys = await prisma.apiKey.findMany({
    where: { userId: session.userId },
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

  const initialKeys = keys.map((k) => ({
    id: k.id,
    name: k.name,
    prefix: k.prefix,
    lastUsedAt: k.lastUsedAt ? k.lastUsedAt.toISOString() : null,
    revokedAt: k.revokedAt ? k.revokedAt.toISOString() : null,
    createdAt: k.createdAt.toISOString(),
  }));

  return (
    <div className="min-h-screen bg-gray-950 flex">
      <Nav />
      <main className="flex-1 min-w-0 px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-100">API Keys</h1>
          <p className="text-sm text-gray-500 mt-1">
            Personal API keys for scripts, CLIs, and third-party tools. Keys have the
            same access as your user account. Send as{" "}
            <code className="text-gray-300">Authorization: Bearer sk_...</code>.
          </p>
        </div>

        <ApiKeysManager initialKeys={initialKeys} />
      </main>
    </div>
  );
}
