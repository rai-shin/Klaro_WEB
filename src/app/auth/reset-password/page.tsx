
"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeType, setNoticeType] = useState<
    "success" | "error" | ""
  >("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (isSubmitting) return;

    setNotice("");
    setNoticeType("");

    if (!token) {
      setNotice("This password reset link is invalid or has expired.");
      setNoticeType("error");
      return;
    }

    if (password.length < 8) {
      setNotice("Your password must contain at least 8 characters.");
      setNoticeType("error");
      return;
    }

    if (password !== confirmPassword) {
      setNotice("The passwords do not match.");
      setNoticeType("error");
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await authClient.resetPassword({
        newPassword: password,
        token,
      });

      if (error) {
        setNotice(
          error.message ||
            "Unable to reset your password. The link may have expired."
        );
        setNoticeType("error");
        return;
      }

      setNotice("Your password has been changed successfully.");
      setNoticeType("success");

      setTimeout(() => {
        router.replace("/auth");
      }, 2000);
    } catch (error) {
      console.error("Password reset failed:", error);

      setNotice("Something went wrong. Please try again.");
      setNoticeType("error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-10 dark:bg-slate-950">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-2xl font-bold text-white shadow-lg shadow-blue-600/20">
            K
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Reset Your Password
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
            Create a new password for your Klaro account.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/40 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none sm:p-8">
          {!token ? (
            <div className="space-y-5">
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                This password reset link is invalid or missing.
              </div>

              <Link
                href="/auth/forgot-password"
                className="block text-center text-sm font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400"
              >
                Request another reset link
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200"
                >
                  New Password
                </label>

                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your new password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  disabled={isSubmitting}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </div>

              <div>
                <label
                  htmlFor="confirmPassword"
                  className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200"
                >
                  Confirm New Password
                </label>

                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your new password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  disabled={isSubmitting}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </div>

              {notice && (
                <div
                  role="status"
                  className={`rounded-xl px-4 py-3 text-sm ${
                    noticeType === "success"
                      ? "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                      : "border border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
                  }`}
                >
                  {notice}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || noticeType === "success"}
                className="flex w-full items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Updating Password..." : "Reset Password"}
              </button>
            </form>
          )}

          <div className="mt-6 border-t border-slate-100 pt-5 text-center dark:border-slate-800">
            <Link
              href="/auth"
              className="text-sm font-semibold text-blue-600 transition hover:text-blue-700 dark:text-blue-400"
            >
              Back to Sign In
            </Link>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          Klaro Clinic Records Management System
        </p>
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
          <p className="text-sm text-slate-500">
            Loading password reset...
          </p>
        </main>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
