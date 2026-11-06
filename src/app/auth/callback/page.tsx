
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState(
    "Verifying your Klaro account..."
  );

  useEffect(() => {
    let cancelled = false;

    async function verifyAccount() {
      try {
        const { data, error } =
          await authClient.getSession();

        if (cancelled) return;

        if (error || !data?.user) {
          router.replace("/auth");
          return;
        }

        const user = data.user;

        // New Google accounts must be activated
        // by an administrator before accessing Klaro.
        if (!user.isActive) {
          setMessage(
            "Your account is pending administrator activation."
          );

          await authClient.signOut();

          if (!cancelled) {
            router.replace("/auth?error=account_inactive");
          }

          return;
        }

        // Redirect according to the database role.
        const destination =
          user.role === "ADMIN"
            ? "/admin/users"
            : "/dashboard";

        router.replace(destination);
        router.refresh();
      } catch (error) {
        console.error(
          "Google callback verification failed:",
          error
        );

        if (!cancelled) {
          router.replace("/auth");
        }
      }
    }

    verifyAccount();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 dark:bg-slate-950">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-lg dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto mb-5 h-10 w-10 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" />

        <h1 className="text-lg font-bold text-slate-900 dark:text-white">
          Klaro Authentication
        </h1>

        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          {message}
        </p>
      </div>
    </main>
  );
}
