import { requireSession } from "@/lib/auth-guard";

export default async function OCRLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSession();

  return <>{children}</>;
}