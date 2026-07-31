"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { isAllowedEmailDomain, ALLOWED_EMAIL_DOMAINS } from "@/lib/types";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const domainHint = ALLOWED_EMAIL_DOMAINS.map((d) => `@${d}`).join(" or ");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setDevLink(null);

    const normalized = email.trim().toLowerCase();
    if (!normalized || !normalized.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }
    if (!isAllowedEmailDomain(normalized)) {
      setError(`Only company emails (${domainHint}) can reset a password.`);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalized }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Could not send reset email.");
        return;
      }

      setSuccess(
        data.message ||
          "If an account exists for that email, a password reset link has been sent."
      );
      if (typeof data.devResetLink === "string") {
        setDevLink(data.devResetLink);
      }
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
          Reset your plant portal password
        </p>
      </div>

      <div className="rounded-lg border border-ps-gray-200 bg-white px-6 py-8 shadow-card">
        <h1 className="ps-heading-accent font-serif text-ps-h1 text-ps-navy">
          Forgot password
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-ps-gray-500">
          Enter your registered email and we&apos;ll send a reset link.
        </p>

        {error && (
          <div className="alert-error mt-6" role="alert">
            {error}
          </div>
        )}
        {success && (
          <div className="alert-success mt-6" role="status">
            {success}
          </div>
        )}
        {devLink && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p className="font-semibold">Dev reset link</p>
            <a
              href={devLink}
              className="mt-1 block break-all underline"
              target="_blank"
              rel="noreferrer"
            >
              {devLink}
            </a>
          </div>
        )}

        {!success && (
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
                className="field-input"
                placeholder="you@ps.com"
              />
            </div>

            <button
              type="submit"
              className="btn-primary w-full"
              disabled={loading}
            >
              {loading ? "Sending…" : "Send reset link"}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm leading-relaxed text-ps-gray-500">
          <Link
            href="/auth/login"
            className="font-semibold text-ps-navy transition duration-200 ease-in-out hover:underline"
          >
            Back to sign in
          </Link>
        </p>
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
