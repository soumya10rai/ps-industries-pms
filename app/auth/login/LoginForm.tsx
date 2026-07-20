"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  signIn,
  signInWithGoogle,
  getFirebaseAuth,
} from "@/lib/firebase";
import { isAllowedEmailDomain, ALLOWED_EMAIL_DOMAINS } from "@/lib/types";

async function establishSession(rememberMe: boolean) {
  const user = getFirebaseAuth().currentUser;
  if (!user) {
    throw new Error("No authenticated user.");
  }
  const idToken = await user.getIdToken(true);
  const res = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken, rememberMe }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Failed to create session.");
  }
  return data as { redirectTo: string; role: string };
}

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
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
        `Only company emails (${domainHint}) can sign in. Your domain is not approved.`
      );
      return;
    }

    setLoading(true);
    try {
      await signIn(normalized, password);
      const session = await establishSession(rememberMe);
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
      const session = await establishSession(rememberMe);
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

  return (
    <div className="auth-shell">
      <div className="mb-8 text-center">
        <p className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">
          PS Industries
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-steel-900">
          Sign in
        </h1>
        <p className="mt-2 text-sm text-steel-500">
          Production management — company accounts only ({domainHint})
        </p>
      </div>

      <div className="auth-card">
        {error && (
          <div className="alert-error mb-5" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
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
              placeholder="you@psindustriesindia.in"
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

          <label className="flex items-center gap-2 text-sm text-steel-600">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 rounded border-steel-300 text-brand-700 focus:ring-brand-500"
            />
            Remember me for 30 days
          </label>

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-steel-200" />
          </div>
          <div className="relative flex justify-center text-xs uppercase tracking-wide">
            <span className="bg-white px-3 text-steel-400">or</span>
          </div>
        </div>

        <button
          type="button"
          className="btn-google"
          onClick={handleGoogle}
          disabled={googleLoading || loading}
        >
          <GoogleIcon />
          {googleLoading ? "Connecting…" : "Continue with Google"}
        </button>

        <p className="mt-6 text-center text-sm text-steel-500">
          Need an account?{" "}
          <Link
            href="/auth/register"
            className="font-semibold text-brand-700 hover:text-brand-800"
          >
            Register
          </Link>
        </p>
      </div>
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
