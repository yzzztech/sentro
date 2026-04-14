import { prisma } from "@/lib/db/prisma";
import Link from "next/link";
import PromptVersions from "@/components/prompt-versions";

interface Props {
  params: Promise<{ projectId: string; name: string }>;
}

export default async function PromptDetailPage({ params }: Props) {
  const { projectId, name } = await params;

  const prompt = await prisma.prompt.findUnique({
    where: { projectId_name: { projectId, name } },
    include: {
      versions: { orderBy: { version: "desc" } },
    },
  });

  if (!prompt) {
    return <div className="text-gray-500">Prompt not found.</div>;
  }

  return (
    <div>
      <Link href={`/${projectId}/prompts`} className="text-sm text-gray-400 hover:text-gray-200">
        ← Back to prompts
      </Link>
      <h1 className="text-2xl font-bold text-gray-100 mt-2">{prompt.name}</h1>
      {prompt.description && <p className="text-sm text-gray-400 mt-1">{prompt.description}</p>}
      <div className="mt-6">
        <PromptVersions
          projectId={projectId}
          promptName={prompt.name}
          versions={prompt.versions.map((v) => ({
            version: v.version,
            body: v.body,
            tags: v.tags,
            createdAt: v.createdAt,
          }))}
        />
      </div>
    </div>
  );
}
