import { requireSession } from "@/lib/auth-guard";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSession();

  return <>{children}</>;
}