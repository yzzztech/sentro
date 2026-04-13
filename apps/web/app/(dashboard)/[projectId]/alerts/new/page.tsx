import AlertForm from "@/components/alert-form";

interface NewAlertPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function NewAlertPage({ params }: NewAlertPageProps) {
  const { projectId } = await params;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-100">New Alert Rule</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Get notified via webhook when a condition is met.
        </p>
      </div>

      <AlertForm projectId={projectId} />
    </div>
  );
}
