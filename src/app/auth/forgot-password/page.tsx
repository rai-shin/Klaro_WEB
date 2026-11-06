
"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
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
    setIsSubmitting(true);

    try {
      const { error } = await authClient.requestPasswordReset({
        email: email.trim(),
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (error) {
        setNotice(
          error.message || "Unable to process your request. Please try again."
        );
        setNoticeType("error");
        return;
      }

      setNotice(
        "If an account exists with that email, a password reset link will be sent. Please check your inbox."
      );
      setNoticeType("success");
    } catch (error) {
      console.error("Password reset request failed:", error);

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
            Forgot your password?
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
            Enter the email address associated with your Klaro account.
            We will send you a link to reset your password.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/40 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200"
              >
                Email Address
              </label>

              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
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
              disabled={isSubmitting}
              className="flex w-full items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Sending..." : "Send Reset Link"}
            </button>
          </form>

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
