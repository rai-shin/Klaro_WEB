import { requireSession } from "@/lib/auth-guard";

export default async function PatientsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSession();

  return <>{children}</>;
}