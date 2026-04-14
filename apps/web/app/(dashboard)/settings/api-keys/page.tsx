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

        <section className="mt-10">
          <h2 className="text-lg font-semibold text-gray-100">Using your API key</h2>
          <p className="text-sm text-gray-500 mt-1 mb-4">
            Pass the key in the <code className="text-gray-300">Authorization</code> header.
            The same dashboard API routes you use in the browser accept API keys.
          </p>

          <div className="space-y-5 text-sm">
            <Example
              title="List your projects"
              code={`curl -H "Authorization: Bearer sk_..." \\
  https://your-sentro-host/api/projects`}
            />
            <Example
              title="List runs for a project"
              code={`curl -H "Authorization: Bearer sk_..." \\
  https://your-sentro-host/api/projects/$PROJECT_ID/runs`}
            />
            <Example
              title="Get a single run (steps, tool calls, LLM calls)"
              code={`curl -H "Authorization: Bearer sk_..." \\
  https://your-sentro-host/api/projects/$PROJECT_ID/runs/$RUN_ID`}
            />
            <Example
              title="Score a run"
              code={`curl -X POST -H "Authorization: Bearer sk_..." \\
  -H "Content-Type: application/json" \\
  -d '{"name":"quality","value":5,"source":"programmatic"}' \\
  https://your-sentro-host/api/projects/$PROJECT_ID/runs/$RUN_ID/scores`}
            />
            <Example
              title="Fetch a prompt by name"
              code={`curl -H "Authorization: Bearer sk_..." \\
  https://your-sentro-host/api/projects/$PROJECT_ID/prompts/my-prompt`}
            />
          </div>

          <div className="mt-6 text-sm text-gray-500">
            Available route trees under{" "}
            <code className="text-gray-300">/api/projects/:projectId/</code>:{" "}
            <code className="text-gray-300">runs</code>,{" "}
            <code className="text-gray-300">sessions</code>,{" "}
            <code className="text-gray-300">issues</code>,{" "}
            <code className="text-gray-300">events</code>,{" "}
            <code className="text-gray-300">scores</code>,{" "}
            <code className="text-gray-300">datasets</code>,{" "}
            <code className="text-gray-300">prompts</code>,{" "}
            <code className="text-gray-300">alerts</code>,{" "}
            <code className="text-gray-300">webhooks</code>,{" "}
            <code className="text-gray-300">performance</code>,{" "}
            <code className="text-gray-300">playground</code>.
          </div>

          <div className="mt-6 p-4 border border-amber-500/30 bg-amber-500/5 rounded-lg text-sm text-amber-200/90">
            <div className="font-medium">Heads up</div>
            <ul className="list-disc ml-5 mt-1 space-y-1">
              <li>Keys carry your user&apos;s full access. Treat them like passwords.</li>
              <li>Keys are SHA-256 hashed at rest — we can&apos;t recover one. Revoke and re-issue if lost.</li>
              <li>
                For SDK ingestion (sending events <em>into</em> Sentro), keep using your project
                DSN token — not an API key.
              </li>
            </ul>
          </div>
        </section>
      </main>
    </div>
  );
}

function Example({ title, code }: { title: string; code: string }) {
  return (
    <div>
      <div className="text-gray-300 mb-1">{title}</div>
      <pre className="px-3 py-2 bg-gray-950 border border-gray-800 rounded-md font-mono text-xs text-gray-200 overflow-x-auto whitespace-pre">
        {code}
      </pre>
    </div>
  );
}
