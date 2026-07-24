import type { NextApiRequest, NextApiResponse } from "next";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { ROLE_HOME, type UserRole } from "@/lib/types";

/**
 * One-time sample users for local / staging.
 * Change passwords before any production use.
 */
const SAMPLE_USERS: Array<{
  email: string;
  password: string;
  displayName: string;
  role: UserRole;
}> = [
  {
    email: "admin@psindustries.in",
    password: "admin123",
    displayName: "System Admin",
    role: "admin",
  },
  {
    email: "plant@psindustries.in",
    password: "plant123",
    displayName: "Plant Head",
    role: "plant_head",
  },
  {
    email: "accountant@psindustries.in",
    password: "acc123",
    displayName: "Accountant",
    role: "accountant",
  },
  {
    email: "store@psindustries.in",
    password: "store123",
    displayName: "Store Manager",
    role: "store_manager",
  },
  {
    email: "production@psindustries.in",
    password: "prod123",
    displayName: "Production Head",
    role: "production_head",
  },
];

/**
 * POST /api/seed-users
 *
 * Creates Firebase Auth users + Firestore /users/{uid} role documents.
 * Protect with header: x-seed-secret: <SEED_SECRET from .env.local>
 *
 * curl -X POST http://localhost:3000/api/seed-users \
 *   -H "x-seed-secret: $SEED_SECRET" \
 *   -H "Content-Type: application/json"
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
    const auth = getAdminAuth();
    const db = getAdminDb();
    const results: Array<Record<string, unknown>> = [];

    for (const sample of SAMPLE_USERS) {
      let uid: string;
      let action: "created" | "updated" = "created";

      try {
        const existing = await auth.getUserByEmail(sample.email);
        uid = existing.uid;
        await auth.updateUser(uid, {
          password: sample.password,
          displayName: sample.displayName,
          emailVerified: true,
          disabled: false,
        });
        action = "updated";
      } catch {
        const created = await auth.createUser({
          email: sample.email,
          password: sample.password,
          displayName: sample.displayName,
          emailVerified: true,
        });
        uid = created.uid;
        action = "created";
      }

      await db.collection("users").doc(uid).set(
        {
          email: sample.email,
          displayName: sample.displayName,
          role: sample.role,
          approved: true,
          updatedAt: FieldValue.serverTimestamp(),
          createdAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      results.push({
        action,
        email: sample.email,
        password: sample.password,
        uid,
        role: sample.role,
        home: ROLE_HOME[sample.role],
        firestorePath: `users/${uid}`,
      });
    }

    return res.status(200).json({
      ok: true,
      message:
        "Sample users seeded in Firebase Auth and Firestore. Change passwords before production.",
      count: results.length,
      users: results,
    });
  } catch (err) {
    console.error("[seed-users]", err);
    const message =
      err instanceof Error ? err.message : "Failed to seed users.";
    return res.status(500).json({ error: message });
  }
}
