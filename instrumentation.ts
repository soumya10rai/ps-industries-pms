/**
 * Next.js instrumentation — runs once when the Node server starts.
 * In development, triggers idempotent user seeding via the seed API
 * (avoids importing firebase-admin into the Edge instrumentation bundle).
 * Failures are logged as warnings and never crash the app.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PUBLIC_ENV !== "development") return;

  // Defer until the HTTP server is listening.
  setTimeout(() => {
    void triggerDevSeed();
  }, 2500);
}

async function triggerDevSeed() {
  const secret = process.env.SEED_SECRET;
  if (!secret) {
    console.warn(
      "[seed] SEED_SECRET not set — skipping automatic dev user seed."
    );
    return;
  }

  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "http://127.0.0.1:3000";

  try {
    const res = await fetch(`${base}/api/auth/seed`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-seed-secret": secret,
      },
      body: "{}",
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn(
        `[seed] Auto-seed HTTP ${res.status}${body ? `: ${body.slice(0, 200)}` : ""}`
      );
      return;
    }

    const data = (await res.json()) as {
      users?: Array<{ action?: string }>;
    };
    const users = data.users ?? [];
    const created = users.filter((u) => u.action === "created").length;
    console.info(
      `[seed] Dev users ready — ${created} created, ${users.length - created} already present.`
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[seed] Dev user seeding failed (non-fatal): ${message}`);
  }
}
