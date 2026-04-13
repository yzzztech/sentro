import { redirect } from "next/navigation";
import { validateSession } from "@/lib/auth/session";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await validateSession();
  if (!session) {
    redirect("/login");
  }

  return <>{children}</>;
}
