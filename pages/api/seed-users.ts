import type { NextApiRequest, NextApiResponse } from "next";
import { ROLE_HOME } from "@/lib/types";
import { DEV_SEED_USERS, seedDevUsers } from "@/lib/auth/seed-users";

/**
 * POST /api/seed-users
 *
 * Creates Firebase Auth users + Firestore /users/{uid} role documents.
 * Protect with header: x-seed-secret: <SEED_SECRET from .env.local>
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  const seedSecret = process.env.SEED_SECRET;
  const headerSecret = String(req.headers["x-seed-secret"] ?? "");

  if (!seedSecret || seedSecret.length < 8) {
    return res.status(500).json({
      error:
        "SEED_SECRET is not set in .env.local (min 8 characters). Add it, then retry.",
    });
  }

  if (headerSecret !== seedSecret) {
    return res.status(401).json({
      error: "Unauthorized. Pass header x-seed-secret matching SEED_SECRET.",
    });
  }

  try {
    const results = await seedDevUsers();

    return res.status(200).json({
      ok: true,
      message:
        "Dev users seeded in Firebase Auth and Firestore (idempotent).",
      count: results.length,
      users: results.map((r) => {
        const seed = DEV_SEED_USERS.find((u) => u.email === r.email);
        return {
          action: r.action,
          email: r.email,
          password: seed?.password,
          uid: r.uid,
          role: r.role,
          home: ROLE_HOME[r.role],
          firestorePath: `users/${r.uid}`,
        };
      }),
    });
  } catch (err) {
    console.error("[seed-users]", err);
    const message =
      err instanceof Error ? err.message : "Failed to seed users.";
    return res.status(500).json({ error: message });
  }
}
