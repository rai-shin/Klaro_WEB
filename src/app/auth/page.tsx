
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

type AuthMode = "login" | "signup";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.9c-.58 2.96-2.28 5.47-4.8 7.15l7.74 6C44.36 37.97 46.98 31.9 46.98 24.55Z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.12.75-4.59l-7.98-6.19A23.9 23.9 0 0 0 0 24c0 3.87.93 7.52 2.56 10.78l7.97-6.19Z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.9-5.83l-7.74-6c-2.15 1.45-4.9 2.3-8.16 2.3-6.26 0-11.57-4.22-13.46-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z"
      />
    </svg>
  );
}

function KlaroLogo({ light = false }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
          light
            ? "bg-white text-blue-700 shadow-lg shadow-blue-950/20"
            : "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 3v18M3 12h18" />
          <path d="m5 5 14 14M19 5 5 19" opacity=".45" />
        </svg>
      </div>

      <div>
        <p
          className={`text-xl font-bold tracking-tight ${
            light
              ? "text-white"
              : "text-slate-900 dark:text-white"
          }`}
        >
          Klaro
        </p>

        <p
          className={`text-xs ${
            light
              ? "text-blue-100"
              : "text-slate-500 dark:text-slate-400"
          }`}
        >
          School Clinic Records
        </p>
      </div>
    </div>
  );
}

export default function AuthPage() {
  const router = useRouter();

  const [mode, setMode] = useState<AuthMode>("login");
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeType, setNoticeType] = useState<"error" | "success">(
    "error"
  );

  const isLogin = mode === "login";

  function changeMode(nextMode: AuthMode) {
    if (
      nextMode === mode ||
      isTransitioning ||
      isSubmitting
    ) {
      return;
    }

    setNotice("");
    setNoticeType("error");

    if (
      window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches
    ) {
      setMode(nextMode);
      setShowPassword(false);
      return;
    }

    setIsTransitioning(true);

    window.setTimeout(() => {
      setMode(nextMode);
      setShowPassword(false);
      setIsTransitioning(false);
    }, 170);
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (isSubmitting) return;

    const formData = new FormData(event.currentTarget);

    const email = String(
      formData.get("email") ?? ""
    ).trim();

    const password = String(
      formData.get("password") ?? ""
    );

    setNotice("");
    setNoticeType("error");
    setIsSubmitting(true);

    try {
      // ------------------------------------------
      // LOGIN
      // ------------------------------------------

      if (isLogin) {
        const { error } =
          await authClient.signIn.email({
            email,
            password,
            rememberMe:
              formData.get("rememberMe") === "on",
          });

        if (error) {
          setNotice(
            error.message ||
              "Unable to sign in. Please check your credentials."
          );
          return;
        }

        const { data: sessionData } =
          await authClient.getSession();

        if (!sessionData?.user) {
          setNotice(
            "You signed in, but we couldn't retrieve your account details. Please try again."
          );
          return;
        }

        // Prevent inactive accounts from continuing.
        if (!sessionData.user.isActive) {
          await authClient.signOut();

          setNotice(
            "Your account is pending administrator activation. Please contact your system administrator."
          );

          setNoticeType("error");
          return;
        }

        const destination =
          sessionData.user.role === "ADMIN"
            ? "/admin/users"
            : "/dashboard";

        router.replace(destination);
        router.refresh();

        return;
      }

      // ------------------------------------------
      // SIGNUP
      // ------------------------------------------

      const name = String(
        formData.get("name") ?? ""
      ).trim();

      const confirmPassword = String(
        formData.get("confirmPassword") ?? ""
      );

      if (password !== confirmPassword) {
        setNotice("Your passwords do not match.");
        return;
      }

      const { error } =
        await authClient.signUp.email({
          name,
          email,
          password,
          callbackURL: "/auth",
        });

      if (error) {
        setNotice(
          error.message ||
            "Unable to create your account."
        );
        return;
      }

      // Sign out after registration so that an
      // inactive account cannot remain logged in.
      await authClient.signOut();

      setNoticeType("success");

      setNotice(
        "Your account has been created successfully. It is now pending administrator activation. You can sign in after the system administrator activates your account."
      );
    } catch (error) {
      console.error(
        "Authentication error:",
        error
      );

      setNotice(
        "Something went wrong. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  // ------------------------------------------
  // GOOGLE SIGN-IN
  // ------------------------------------------

  async function handleGoogleClick() {
    if (isSubmitting) return;

    setNotice("");
    setNoticeType("error");
    setIsSubmitting(true);

    try {
      const { error } =
        await authClient.signIn.social({
          provider: "google",
          callbackURL: "/auth/callback",
        });

      if (error) {
        setNotice(
          error.message ||
            "Unable to sign in with Google."
        );

        setIsSubmitting(false);
      }
    } catch (error) {
      console.error(
        "Google sign-in error:",
        error
      );

      setNotice(
        "Google sign-in failed. Please try again."
      );

      setIsSubmitting(false);
    }
  }

  // ------------------------------------------
  // FORGOT PASSWORD
  // ------------------------------------------

  function handleForgotPassword() {
    router.push("/auth/forgot-password");
  }

  return (
    <main className="min-h-screen bg-slate-50 font-[var(--font-geist-sans)] text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">

        {/* LEFT BRAND PANEL */}
        <aside className="relative hidden items-center justify-center overflow-hidden bg-gradient-to-br from-slate-950 via-blue-950 to-blue-800 px-12 lg:flex">
          <div className="relative z-10">
            <KlaroLogo light />
          </div>
        </aside>

        {/* RIGHT AUTHENTICATION PANEL */}
        <section className="flex min-h-screen items-center justify-center px-5 py-5 sm:px-8 lg:px-10">
          <div className="w-full max-w-[440px]">

            {/* MOBILE BRAND */}
            <div className="mb-5 lg:hidden">
              <KlaroLogo />
            </div>

            {/* HEADING */}
            <div className="mb-5">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                {isLogin
                  ? "Sign in to Klaro"
                  : "Create your account"}
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                {isLogin
                  ? "Enter your account details to access the clinic workspace."
                  : "Create an account to get started with Klaro. Administrator activation is required before access is granted."}
              </p>
            </div>

            {/* AUTHENTICATION CARD */}
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/40 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/20 sm:p-6">
              <div
                key={mode}
                className={`auth-form-stage ${
                  isTransitioning
                    ? "is-exiting"
                    : "is-entering"
                }`}
              >
                <form
                  onSubmit={handleSubmit}
                  className="space-y-3"
                >

                  {/* FULL NAME */}
                  {!isLogin && (
                    <div>
                      <label
                        htmlFor="fullName"
                        className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300"
                      >
                        Full name
                      </label>

                      <input
                        id="fullName"
                        name="name"
                        type="text"
                        placeholder="Enter your full name"
                        autoComplete="name"
                        required
                        disabled={isSubmitting}
                        className="auth-input"
                      />
                    </div>
                  )}

                  {/* EMAIL */}
                  <div>
                    <label
                      htmlFor="email"
                      className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300"
                    >
                      Email address
                    </label>

                    <input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="you@example.com"
                      autoComplete="email"
                      required
                      disabled={isSubmitting}
                      className="auth-input"
                    />
                  </div>

                  {/* PASSWORD */}
                  <div>
                    <label
                      htmlFor="password"
                      className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300"
                    >
                      Password
                    </label>

                    <div className="relative">
                      <input
                        id="password"
                        name="password"
                        type={
                          showPassword
                            ? "text"
                            : "password"
                        }
                        placeholder="Enter your password"
                        autoComplete={
                          isLogin
                            ? "current-password"
                            : "new-password"
                        }
                        required
                        minLength={8}
                        disabled={isSubmitting}
                        className="auth-input pr-20"
                      />

                      <button
                        type="button"
                        onClick={() =>
                          setShowPassword(!showPassword)
                        }
                        disabled={isSubmitting}
                        className="absolute inset-y-0 right-0 flex items-center px-4 text-xs font-semibold text-slate-500 transition hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400"
                      >
                        {showPassword
                          ? "Hide"
                          : "Show"}
                      </button>
                    </div>

                    {/* FORGOT PASSWORD */}
                    {isLogin && (
                      <div className="mt-2 text-right">
                        <button
                          type="button"
                          onClick={handleForgotPassword}
                          disabled={isSubmitting}
                          className="text-xs font-semibold text-blue-600 transition hover:text-blue-700 disabled:opacity-50 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          Forgot password?
                        </button>
                      </div>
                    )}
                  </div>

                  {/* CONFIRM PASSWORD */}
                  {!isLogin && (
                    <div>
                      <label
                        htmlFor="confirmPassword"
                        className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300"
                      >
                        Confirm password
                      </label>

                      <input
                        id="confirmPassword"
                        name="confirmPassword"
                        type={
                          showPassword
                            ? "text"
                            : "password"
                        }
                        placeholder="Re-enter your password"
                        autoComplete="new-password"
                        required
                        minLength={8}
                        disabled={isSubmitting}
                        className="auth-input"
                      />
                    </div>
                  )}

                  {/* REMEMBER ME */}
                  {isLogin && (
                    <label className="flex cursor-pointer items-center gap-2.5">
                      <input
                        type="checkbox"
                        name="rememberMe"
                        disabled={isSubmitting}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800"
                      />

                      <span className="text-sm text-slate-600 dark:text-slate-400">
                        Remember me
                      </span>
                    </label>
                  )}

                  {/* NOTIFICATION */}
                  {notice && (
                    <div
                      role="alert"
                      aria-live="polite"
                      className={`rounded-xl border px-4 py-3 text-sm leading-5 ${
                        noticeType === "success"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300"
                          : "border-blue-100 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/70 dark:text-blue-300"
                      }`}
                    >
                      {noticeType === "success" && (
                        <div className="mb-2 flex items-center gap-2 font-semibold">
                          <svg
                            viewBox="0 0 24 24"
                            className="h-5 w-5 shrink-0"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="M20 6 9 17l-5-5" />
                          </svg>

                          Registration successful
                        </div>
                      )}

                      {notice}
                    </div>
                  )}

                  {/* SUBMIT */}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-blue-600/30 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isSubmitting
                      ? "Please wait..."
                      : isLogin
                        ? "Sign in"
                        : "Create account"}

                    {!isSubmitting && (
                      <svg
                        viewBox="0 0 24 24"
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    )}
                  </button>
                </form>

                {/* DIVIDER */}
                <div className="my-4 flex items-center gap-4">
                  <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />

                  <span className="text-xs font-medium text-slate-400">
                    OR CONTINUE WITH
                  </span>

                  <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                </div>

                {/* GOOGLE BUTTON */}
                <button
                  type="button"
                  onClick={handleGoogleClick}
                  disabled={isSubmitting}
                  className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <GoogleIcon />
                  {isSubmitting
                    ? "Connecting to Google..."
                    : "Continue with Google"}
                </button>
              </div>

              {/* LOGIN / SIGNUP SWITCH */}
              <div className="mt-5 border-t border-slate-100 pt-4 text-center dark:border-slate-800">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {isLogin
                    ? "Don't have an account?"
                    : "Already have an account?"}{" "}

                  <button
                    type="button"
                    onClick={() =>
                      changeMode(
                        isLogin
                          ? "signup"
                          : "login"
                      )
                    }
                    disabled={
                      isTransitioning ||
                      isSubmitting
                    }
                    className="font-semibold text-blue-600 transition hover:text-blue-700 disabled:opacity-50 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    {isLogin
                      ? "Create an account"
                      : "Sign in"}
                  </button>
                </p>
              </div>
            </div>

            {/* FOOTER */}
            <p className="mt-4 text-center text-xs text-slate-400 dark:text-slate-500">
              Klaro · School Clinic Document Management System
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
