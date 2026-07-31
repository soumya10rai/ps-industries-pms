"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

export default function SetPasswordPage() {
  return (
    <Suspense
      fallback={
        <AuthFrame>
          <p className="text-center text-sm leading-relaxed text-ps-gray-500">
            Loading invite…
          </p>
        </AuthFrame>
      }
    >
      <SetPasswordForm />
    </Suspense>
  );
}

function SetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams?.get("token") ?? "";
  const inviteId = searchParams?.get("inviteId") ?? "";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function validate() {
      if (!token || !inviteId) {
        setError("This invite link is missing required parameters.");
        setValidating(false);
        return;
      }

      try {
        const res = await fetch(
          `/api/auth/set-password?token=${encodeURIComponent(token)}&inviteId=${encodeURIComponent(inviteId)}`
        );
        const data = await res.json();
        if (cancelled) return;

        if (!res.ok) {
          setError(data.error || "This invite is invalid or has expired.");
          setValidating(false);
          return;
        }

        setEmail(data.email ?? "");
        setValidating(false);
      } catch {
        if (!cancelled) {
          setError("Could not validate invite. Please try again.");
          setValidating(false);
        }
      }
    }

    void validate();
    return () => {
      cancelled = true;
    };
  }, [token, inviteId]);

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
      const res = await fetch("/api/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          inviteId,
          password,
          confirmPassword,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to set password.");
        return;
      }

      router.push("/auth/login?message=password_set");
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
          Set your password to join the plant portal
        </p>
      </div>

      <div className="rounded-lg border border-ps-gray-200 bg-white px-6 py-8 shadow-card">
        <h1 className="ps-heading-accent font-serif text-ps-h1 text-ps-navy">
          Set your password
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-ps-gray-500">
          Choose a password for your PS Industries PMS account.
        </p>

        {error && (
          <div className="alert-error mt-6" role="alert">
            {error}
          </div>
        )}

        {validating ? (
          <p className="mt-6 text-sm text-ps-gray-500">Validating invite…</p>
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
                Password
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
              {loading ? "Saving…" : "Set password"}
            </button>
          </form>
        ) : (
          <p className="mt-6 text-center text-sm text-ps-gray-500">
            <Link
              href="/auth/login"
              className="font-semibold text-ps-navy hover:underline"
            >
              Back to sign in
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
