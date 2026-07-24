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

    if (!validateDomain(normalized)) {
      setError(
        domainError ||
          `Registration is restricted to company emails (${allowedList}).`
      );
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
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
        "Account created. An Admin must assign your role before you can sign in. Redirecting…"
      );
      setTimeout(() => router.push("/auth/login"), 2200);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Registration failed.";
      setError(friendlyRegisterError(message));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-ps-dark">
      <div className="h-1.5 bg-ps-red" />
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
        <div className="mb-6 text-center">
          <p className="font-serif text-2xl font-bold tracking-wide text-white">
            PS INDUSTRIES
          </p>
          <p className="mt-1 text-xs text-blue-100">
            Admin Portal — Greater Noida Plant
          </p>
        </div>

        <div className="rounded border border-ps-gray-200 bg-white p-8 shadow-lg">
          <h1 className="font-serif text-2xl font-bold text-ps-navy">
            Create account
          </h1>
          <p className="mt-1 text-sm text-ps-gray-500">
            Company email required — {allowedList}
          </p>

          {error && (
            <div className="alert-error mt-4" role="alert">
              {error}
            </div>
          )}
          {success && (
            <div className="alert-success mt-4" role="status">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
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
                placeholder="you@psindustries.in"
                aria-invalid={Boolean(domainError)}
              />
              {domainError && (
                <p className="mt-1.5 text-sm text-ps-red" role="alert">
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
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="field-input"
                placeholder="At least 6 characters"
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
                minLength={6}
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

          <p className="mt-5 text-center text-sm text-ps-gray-500">
            Already registered?{" "}
            <Link
              href="/auth/login"
              className="font-semibold text-ps-navy hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
      <footer className="bg-ps-navy py-3 text-center text-xs text-blue-100">
        © {new Date().getFullYear()} PS Industries — Greater Noida Plant
      </footer>
    </div>
  );
}

function friendlyRegisterError(message: string): string {
  if (message.includes("auth/email-already-in-use")) {
    return "An account with this email already exists.";
  }
  if (message.includes("auth/weak-password")) {
    return "Password is too weak. Use at least 6 characters.";
  }
  if (message.includes("auth/invalid-email")) {
    return "Enter a valid email address.";
  }
  return message;
}
