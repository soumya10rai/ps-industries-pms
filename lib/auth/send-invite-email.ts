/**
 * Send invite email via Resend (or no-op log in development without API key).
 * Never logs the invite token or full link in production.
 */

export interface SendInviteEmailResult {
  sent: boolean;
  provider: "resend" | "dev_console" | "skipped";
  error?: string;
}

export async function sendInviteEmail(
  email: string,
  link: string
): Promise<SendInviteEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from =
    process.env.INVITE_EMAIL_FROM || "PS Industries PMS <onboarding@resend.dev>";
  const isDev = process.env.NEXT_PUBLIC_ENV === "development";

  if (!apiKey) {
    if (isDev) {
      // Dev-only: surface the link so invites are testable without Resend.
      console.warn(
        `[invite-email] RESEND_API_KEY not set — invite link for ${email}: ${link}`
      );
      return { sent: false, provider: "dev_console" };
    }
    console.warn(
      "[invite-email] RESEND_API_KEY not set; invite email was not sent."
    );
    return {
      sent: false,
      provider: "skipped",
      error: "Email provider not configured.",
    };
  }

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);

    const { error } = await resend.emails.send({
      from,
      to: email,
      subject: "You're invited to PS Industries PMS",
      html: buildInviteHtml(link),
      text: buildInviteText(link),
    });

    if (error) {
      console.error("[invite-email] Resend error:", error.message);
      return { sent: false, provider: "resend", error: error.message };
    }

    return { sent: true, provider: "resend" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to send email.";
    console.error("[invite-email]", message);
    return { sent: false, provider: "resend", error: message };
  }
}

function buildInviteHtml(link: string): string {
  return `
<!DOCTYPE html>
<html>
<body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #1a1a2e;">
  <p>Hi,</p>
  <p>Admin has invited you to join the <strong>PS Industries PMS</strong>.</p>
  <p>
    <a href="${link}" style="display:inline-block;padding:12px 20px;background:#1e3a5f;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">
      Set Your Password
    </a>
  </p>
  <p style="color:#666;font-size:14px;">This link expires in 7 days.</p>
  <p style="color:#999;font-size:12px;">If the button does not work, copy and paste this URL:<br/>${link}</p>
</body>
</html>
`.trim();
}

function buildInviteText(link: string): string {
  return [
    "Hi,",
    "",
    "Admin has invited you to join the PS Industries PMS.",
    "",
    `Set Your Password: ${link}`,
    "",
    "This link expires in 7 days.",
  ].join("\n");
}

export function buildInviteLink(
  baseUrl: string,
  token: string,
  inviteId: string
): string {
  const origin = baseUrl.replace(/\/$/, "");
  const url = new URL(`${origin}/auth/set-password`);
  url.searchParams.set("token", token);
  url.searchParams.set("inviteId", inviteId);
  return url.toString();
}

/**
 * Send password-reset email via Resend (or no-op log in development).
 * Never logs the reset token or full link in production.
 */
export async function sendPasswordResetEmail(
  email: string,
  link: string
): Promise<SendInviteEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from =
    process.env.INVITE_EMAIL_FROM || "PS Industries PMS <onboarding@resend.dev>";
  const isDev = process.env.NEXT_PUBLIC_ENV === "development";

  if (!apiKey) {
    if (isDev) {
      console.warn(
        `[reset-email] RESEND_API_KEY not set — reset link for ${email}: ${link}`
      );
      return { sent: false, provider: "dev_console" };
    }
    console.warn(
      "[reset-email] RESEND_API_KEY not set; password reset email was not sent."
    );
    return {
      sent: false,
      provider: "skipped",
      error: "Email provider not configured.",
    };
  }

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);

    const { error } = await resend.emails.send({
      from,
      to: email,
      subject: "Reset your PS Industries PMS password",
      html: buildResetHtml(link),
      text: buildResetText(link),
    });

    if (error) {
      console.error("[reset-email] Resend error:", error.message);
      return { sent: false, provider: "resend", error: error.message };
    }

    return { sent: true, provider: "resend" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to send email.";
    console.error("[reset-email]", message);
    return { sent: false, provider: "resend", error: message };
  }
}

function buildResetHtml(link: string): string {
  return `
<!DOCTYPE html>
<html>
<body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #1a1a2e;">
  <p>Hi,</p>
  <p>We received a request to reset your password for <strong>PS Industries PMS</strong>.</p>
  <p>
    <a href="${link}" style="display:inline-block;padding:12px 20px;background:#1e3a5f;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">
      Reset Password
    </a>
  </p>
  <p style="color:#666;font-size:14px;">This link expires in 1 hour. If you did not request a reset, you can ignore this email.</p>
  <p style="color:#999;font-size:12px;">If the button does not work, copy and paste this URL:<br/>${link}</p>
</body>
</html>
`.trim();
}

function buildResetText(link: string): string {
  return [
    "Hi,",
    "",
    "We received a request to reset your password for PS Industries PMS.",
    "",
    `Reset Password: ${link}`,
    "",
    "This link expires in 1 hour. If you did not request a reset, you can ignore this email.",
  ].join("\n");
}

export function buildResetLink(
  baseUrl: string,
  token: string,
  resetId: string
): string {
  const origin = baseUrl.replace(/\/$/, "");
  const url = new URL(`${origin}/auth/reset-password`);
  url.searchParams.set("token", token);
  url.searchParams.set("resetId", resetId);
  return url.toString();
}
