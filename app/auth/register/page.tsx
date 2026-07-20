"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signUp } from "@/lib/firebase";
import {
  isAllowedEmailDomain,
  getEmailDomain,
  ALLOWED_EMAIL_DOMAINS,
} from "@/lib/types";

export default function RegisterPage() {
  const router = useRouter();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [domainError, setDomainError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const allowedList = useMemo(
    () => ALLOWED_EMAIL_DOMAINS.map((d) => `@${d}`).join(" or "),
    []
  );

  function validateDomain(value: string): boolean {
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) {
      setDomainError(null);
      return false;
    }

    const domain = getEmailDomain(trimmed);
    if (!domain) {
      setDomainError("Enter a valid email address.");
      return false;
    }

    if (!isAllowedEmailDomain(trimmed)) {
      setDomainError(
        `Email domain "@${domain}" is not allowed. Only ${allowedList} may register.`
      );
      return false;
    }

    setDomainError(null);
    return true;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const normalized = email.trim().toLowerCase();

    // Security boundary — hard stop before any Firebase call
    if (!validateDomain(normalized)) {
      setError(
        domainError ||
          `Registration is restricted to company emails (${allowedList}).`
      );
      return;
    }

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
      await signUp(normalized, password, displayName);

      setSuccess(
        "Account created. An Admin must assign your role before you can sign in. Redirecting to login…"
      );
      setTimeout(() => {
        router.push("/auth/login");
      }, 2200);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Registration failed.";
      setError(friendlyRegisterError(message));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="mb-8 text-center">
        <p className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">
          PS Industries
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-steel-900">
          Create account
        </h1>
        <p className="mt-2 text-sm text-steel-500">
          Company email required — {allowedList}
        </p>
      </div>

      <div className="auth-card">
        {error && (
          <div className="alert-error mb-5" role="alert">
            {error}
          </div>
        )}
        {success && (
          <div className="alert-success mb-5" role="status">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="displayName" className="field-label">
              Full name
            </label>
            <input
              id="displayName"
              name="displayName"
              type="text"
              autoComplete="name"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="field-input"
              placeholder="Your name"
            />
          </div>

          <div>
            <label htmlFor="email" className="field-label">
              Work email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                validateDomain(e.target.value);
              }}
              onBlur={(e) => validateDomain(e.target.value)}
              className={`field-input ${
                domainError
                  ? "border-red-400 focus:border-red-500 focus:ring-red-500/20"
                  : ""
              }`}
              placeholder="you@psindustriesindia.in"
              aria-invalid={Boolean(domainError)}
              aria-describedby={domainError ? "email-domain-error" : undefined}
            />
            {domainError && (
              <p
                id="email-domain-error"
                className="mt-1.5 text-sm text-[var(--danger)]"
                role="alert"
              >
                {domainError}
              </p>
            )}
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
              placeholder="At least 8 characters"
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
              placeholder="Repeat password"
            />
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={loading || Boolean(domainError) || Boolean(success)}
          >
            {loading ? "Creating account…" : "Register"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-steel-500">
          Already registered?{" "}
          <Link
            href="/auth/login"
            className="font-semibold text-brand-700 hover:text-brand-800"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

function friendlyRegisterError(message: string): string {
  if (message.includes("auth/email-already-in-use")) {
    return "An account with this email already exists.";
  }
  if (message.includes("auth/weak-password")) {
    return "Password is too weak. Use at least 8 characters.";
  }
  if (message.includes("auth/invalid-email")) {
    return "Enter a valid email address.";
  }
  return message;
}
