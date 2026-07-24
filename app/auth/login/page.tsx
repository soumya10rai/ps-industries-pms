"use client";

import { FormEvent, Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, signInWithGoogle } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { isAllowedEmailDomain, ALLOWED_EMAIL_DOMAINS } from "@/lib/types";

const DEMO_USERS = [
  { email: "admin@psindustries.in", password: "admin123", role: "Admin" },
  { email: "plant@psindustries.in", password: "plant123", role: "Plant Head" },
  {
    email: "accountant@psindustries.in",
    password: "acc123",
    role: "Accountant",
  },
  { email: "store@psindustries.in", password: "store123", role: "Store" },
  {
    email: "production@psindustries.in",
    password: "prod123",
    role: "Production",
  },
];

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <AuthFrame>
          <p className="text-center text-sm text-ps-gray-500">Loading…</p>
        </AuthFrame>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams?.get("next") ?? null;
  const { establishSession } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const domainHint = useMemo(
    () => ALLOWED_EMAIL_DOMAINS.map((d) => `@${d}`).join(" or "),
    []
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const normalized = email.trim().toLowerCase();
    if (!isAllowedEmailDomain(normalized)) {
      setError(
        `Only company emails (${domainHint}) can sign in.`
      );
      return;
    }

    setLoading(true);
    try {
      await signIn(normalized, password);
      const session = await establishSession();
      router.push(
        nextPath && nextPath.startsWith("/") ? nextPath : session.redirectTo
      );
      router.refresh();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Sign-in failed. Try again.";
      setError(friendlyAuthError(message));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError(null);
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      const session = await establishSession();
      router.push(
        nextPath && nextPath.startsWith("/") ? nextPath : session.redirectTo
      );
      router.refresh();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Google sign-in failed.";
      setError(friendlyAuthError(message));
    } finally {
      setGoogleLoading(false);
    }
  }

  function fillDemo(demoEmail: string, demoPassword: string) {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setError(null);
  }

  return (
    <AuthFrame>
      <div className="mb-6 text-center">
        <p className="font-serif text-2xl font-bold tracking-wide text-white">
          PS INDUSTRIES
        </p>
        <p className="mt-1 text-xs text-blue-100">
          Admin Portal — Greater Noida Plant
        </p>
      </div>

      <div className="rounded border border-ps-gray-200 bg-white p-8 shadow-lg">
        <h1 className="font-serif text-2xl font-bold text-ps-navy">Sign in</h1>
        <p className="mt-1 text-sm text-ps-gray-500">
          Use your company account to access the plant portal.
        </p>

        {error && (
          <div className="alert-error mt-4" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
          <div>
            <label htmlFor="email" className="field-label">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="field-input"
              placeholder="you@psindustries.in"
            />
          </div>

          <div>
            <label htmlFor="password" className="field-label">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="field-input"
              placeholder="••••••••"
            />
          </div>

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="relative my-5">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-ps-gray-200" />
          </div>
          <div className="relative flex justify-center text-xs uppercase tracking-wide">
            <span className="bg-white px-3 text-ps-gray-400">or</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={googleLoading || loading}
          className="inline-flex w-full items-center justify-center gap-2 rounded border border-ps-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-ps-gray-800 transition hover:bg-ps-gray-50 disabled:opacity-60"
        >
          <GoogleIcon />
          {googleLoading ? "Connecting…" : "Continue with Google"}
        </button>

        <p className="mt-5 text-center text-sm text-ps-gray-500">
          Need an account?{" "}
          <Link
            href="/auth/register"
            className="font-semibold text-ps-navy hover:underline"
          >
            Register
          </Link>
        </p>
      </div>

      <div className="mt-4 rounded border border-white/20 bg-white/10 p-4 text-left text-xs text-blue-50">
        <p className="mb-2 font-semibold text-white">Sample users (seeded)</p>
        <ul className="space-y-1">
          {DEMO_USERS.map((u) => (
            <li key={u.email}>
              <button
                type="button"
                onClick={() => fillDemo(u.email, u.password)}
                className="w-full rounded px-1 py-0.5 text-left hover:bg-white/10"
              >
                <span className="font-medium">{u.role}:</span> {u.email} /{" "}
                {u.password}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </AuthFrame>
  );
}

function AuthFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-ps-dark">
      <div className="h-1.5 bg-ps-red" />
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
        {children}
      </div>
      <footer className="bg-ps-navy py-3 text-center text-xs text-blue-100">
        © {new Date().getFullYear()} PS Industries — Greater Noida Plant
      </footer>
    </div>
  );
}

function friendlyAuthError(message: string): string {
  if (
    message.includes("auth/invalid-credential") ||
    message.includes("auth/wrong-password")
  ) {
    return "Incorrect email or password.";
  }
  if (message.includes("auth/user-not-found")) {
    return "No account found for this email.";
  }
  if (message.includes("auth/too-many-requests")) {
    return "Too many attempts. Please wait and try again.";
  }
  if (message.includes("auth/popup-closed-by-user")) {
    return "Google sign-in was cancelled.";
  }
  if (message.includes("Missing Firebase config")) {
    return "Firebase is not configured. Add credentials to .env.local.";
  }
  return message;
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.5-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 16 19 12 24 12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.3 35.1 26.8 36 24 36c-5.3 0-9.7-3.1-11.3-7.5l-6.5 5C9.6 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.1-3.5 5.5-6.1 7.1l.1.1 6.2 5.2C37.3 41.4 44 36 44 24c0-1.3-.1-2.5-.4-3.5z"
      />
    </svg>
  );
}
