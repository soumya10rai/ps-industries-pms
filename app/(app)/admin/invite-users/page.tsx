"use client";

import { FormEvent, useState } from "react";
import { USER_ROLES, ROLE_LABELS, type UserRole } from "@/lib/types";

export default function InviteUsersPage() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("accountant");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [devLink, setDevLink] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setDevLink(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/send-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          role,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to send invite.");
        return;
      }

      const sentNote = data.emailSent
        ? "Invitation email sent."
        : "Invite created (email not sent — check Resend config).";
      setSuccess(`${sentNote} Invite ID: ${data.inviteId}`);
      if (typeof data.devInviteLink === "string") {
        setDevLink(data.devInviteLink);
      }
      setEmail("");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <h1 className="font-serif text-2xl text-ps-navy">Invite users</h1>
      <p className="mt-2 text-sm leading-relaxed text-ps-gray-500">
        Send a secure invite so a new teammate can set their password and join
        the portal.
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
          <p className="font-semibold">Dev invite link</p>
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

      <form
        onSubmit={handleSubmit}
        className="mt-6 space-y-4 rounded-lg border border-ps-gray-200 bg-white p-6 shadow-card"
        noValidate
      >
        <div>
          <label htmlFor="invite-email" className="field-label">
            Email
          </label>
          <input
            id="invite-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="field-input"
            placeholder="colleague@psindustries.in"
          />
        </div>

        <div>
          <label htmlFor="invite-role" className="field-label">
            Role
          </label>
          <select
            id="invite-role"
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            className="field-input"
          >
            {USER_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </div>

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? "Sending…" : "Send invite"}
        </button>
      </form>
    </div>
  );
}
