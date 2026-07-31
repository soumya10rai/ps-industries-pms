"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <AuthFrame>
          <p className="text-center text-sm leading-relaxed text-ps-gray-500">
            Loading reset link…
          </p>
        </AuthFrame>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams?.get("token") ?? "";
  const resetId = searchParams?.get("resetId") ?? "";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function validate() {
      if (!token || !resetId) {
        setError("This reset link is missing required parameters.");
        setValidating(false);
        return;
      }

      try {
        const res = await fetch(
          `/api/auth/reset-password?token=${encodeURIComponent(token)}&resetId=${encodeURIComponent(resetId)}`
        );
        const data = await res.json();
        if (cancelled) return;

        if (!res.ok) {
          setError(data.error || "This reset link is invalid or has expired.");
          setValidating(false);
          return;
        }

        setEmail(data.email ?? "");
        setValidating(false);
      } catch {
        if (!cancelled) {
          setError("Could not validate reset link. Please try again.");
          setValidating(false);
        }
      }
    }

    void validate();
    return () => {
      cancelled = true;
    };
  }, [token, resetId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          resetId,
          password,
          confirmPassword,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to reset password.");
        return;
      }

      router.push("/auth/login?message=password_reset");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthFrame>
      <div className="mb-8 text-center">
        <p className="font-serif text-ps-h1 tracking-wide text-white">
          PS INDUSTRIES
        </p>
        <p className="mt-2 text-sm leading-relaxed text-blue-100">
          Choose a new password for your account
        </p>
      </div>

      <div className="rounded-lg border border-ps-gray-200 bg-white px-6 py-8 shadow-card">
        <h1 className="ps-heading-accent font-serif text-ps-h1 text-ps-navy">
          Reset password
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-ps-gray-500">
          Enter a new password for your PS Industries PMS account.
        </p>

        {error && (
          <div className="alert-error mt-6" role="alert">
            {error}
          </div>
        )}

        {validating ? (
          <p className="mt-6 text-sm text-ps-gray-500">Validating link…</p>
        ) : email ? (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
            <div>
              <label htmlFor="email" className="field-label">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                readOnly
                value={email}
                className="field-input bg-ps-gray-50 text-ps-gray-600"
              />
            </div>

            <div>
              <label htmlFor="password" className="field-label">
                New password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="field-input"
                placeholder="Min. 8 characters"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="field-label">
                Confirm password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="field-input"
                placeholder="Re-enter password"
              />
            </div>

            <button
              type="submit"
              className="btn-primary w-full"
              disabled={loading}
            >
              {loading ? "Saving…" : "Update password"}
            </button>
          </form>
        ) : (
          <p className="mt-6 text-center text-sm text-ps-gray-500">
            <Link
              href="/auth/forgot-password"
              className="font-semibold text-ps-navy hover:underline"
            >
              Request a new reset link
            </Link>
          </p>
        )}
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
