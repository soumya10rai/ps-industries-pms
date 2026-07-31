"use client";

import { FormEvent, Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, signInWithGoogle } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { isAllowedEmailDomain, ALLOWED_EMAIL_DOMAINS } from "@/lib/types";

const DEMO_USERS = [
  { email: "admin@ps.com", password: "Admin@123", role: "Admin" },
  { email: "planthead@ps.com", password: "PlantHead@123", role: "Plant Head" },
  {
    email: "accountant@ps.com",
    password: "Accountant@123",
    role: "Accountant",
  },
  {
    email: "storemanager@ps.com",
    password: "StoreManager@123",
    role: "Store Manager",
  },
  {
    email: "productionhead@ps.com",
    password: "ProdHead@123",
    role: "Production Head",
  },
];

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <AuthFrame>
          <p className="text-center text-sm leading-relaxed text-ps-gray-500">
            Loading…
          </p>
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
  const message = searchParams?.get("message") ?? null;
  const { establishSession } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const successMessage =
    message === "password_set"
      ? "Password set! You can sign in now."
      : message === "password_reset"
        ? "Password updated! You can sign in now."
        : null;

  const domainHint = useMemo(
    () => ALLOWED_EMAIL_DOMAINS.map((d) => `@${d}`).join(" or "),
    []
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const normalized = email.trim().toLowerCase();
    if (!isAllowedEmailDomain(normalized)) {
      setError(`Only company emails (${domainHint}) can sign in.`);
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
      <div className="mb-8 text-center">
        <p className="font-serif text-ps-h1 tracking-wide text-white">
          PS INDUSTRIES
        </p>
        <p className="mt-2 text-sm leading-relaxed text-blue-100">
          Admin Portal — Greater Noida Plant
        </p>
      </div>

      <div className="rounded-lg border border-ps-gray-200 bg-white px-6 py-8 shadow-card">
        <h1 className="ps-heading-accent font-serif text-ps-h1 text-ps-navy">
          Sign in
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-ps-gray-500">
          Use your company account to access the plant portal.
        </p>

        {successMessage && (
          <div className="alert-success mt-6" role="status">
            {successMessage}
          </div>
        )}

        {error && (
          <div className="alert-error mt-6" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
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
              className={`field-input ${error ? "field-input-error" : ""}`}
              placeholder="you@ps.com"
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
              className={`field-input ${error ? "field-input-error" : ""}`}
              placeholder="••••••••"
            />
            <p className="mt-2 text-right text-sm">
              <Link
                href="/auth/forgot-password"
                className="font-semibold text-ps-navy transition duration-200 ease-in-out hover:underline"
              >
                Forgot password?
              </Link>
            </p>
          </div>

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-ps-navy/20" />
          </div>
          <div className="relative flex justify-center text-xs uppercase tracking-wide">
            <span className="bg-white px-3 text-ps-gray-400">or</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={googleLoading || loading}
          className="btn-secondary w-full border-ps-gray-300 text-ps-gray-800"
        >
          <GoogleIcon />
          {googleLoading ? "Connecting…" : "Continue with Google"}
        </button>

        <p className="mt-6 text-center text-sm leading-relaxed text-ps-gray-500">
          Need an account?{" "}
          <Link
            href="/auth/register"
            className="font-semibold text-ps-navy transition duration-200 ease-in-out hover:underline"
          >
            Register
          </Link>
        </p>
      </div>

      <div className="mt-6 rounded-lg border border-white/20 bg-white/10 px-6 py-4 text-left text-xs leading-relaxed text-blue-50">
        <p className="mb-3 font-semibold text-white">Sample users (seeded)</p>
        <ul className="space-y-1">
          {DEMO_USERS.map((u) => (
            <li key={u.email}>
              <button
                type="button"
                onClick={() => fillDemo(u.email, u.password)}
                className="w-full rounded-lg px-2 py-1.5 text-left transition duration-200 ease-in-out hover:bg-white/10"
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
    <div
      className="flex min-h-screen flex-col bg-ps-dark"
      style={{
        backgroundImage:
          "linear-gradient(rgb(255 255 255 / 0.01) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255 / 0.01) 1px, transparent 1px)",
        backgroundSize: "24px 24px",
      }}
    >
      <div className="h-1.5 bg-ps-red" />
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-10">
        {children}
      </div>
      <footer className="border-t border-white/10 bg-ps-navy px-6 py-4 text-center text-xs leading-relaxed text-blue-100">
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
  if (
    message.includes("Firebase Auth is not ready") ||
    message.includes("Firebase app is not ready")
  ) {
    return "Firebase is still starting. Confirm .env.local values and restart npm run dev.";
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
