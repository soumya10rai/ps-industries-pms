import type { NextApiRequest, NextApiResponse } from "next";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { isAllowedEmailDomain } from "@/lib/types";

/**
 * POST /api/auth/signup
 * Body: { email, password, displayName }
 *
 * Creates a Firebase Auth user + Firestore profile (role pending admin approval).
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const email = String(req.body?.email ?? "")
      .trim()
      .toLowerCase();
    const password = String(req.body?.password ?? "");
    const displayName = String(req.body?.displayName ?? "").trim();

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    if (!isAllowedEmailDomain(email)) {
      return res.status(403).json({
        error:
          "Registration is restricted to @psindustriesindia.in and @psindustries.in email addresses.",
      });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ error: "Password must be at least 6 characters." });
    }

    const auth = getAdminAuth();
    const db = getAdminDb();

    const user = await auth.createUser({
      email,
      password,
      displayName: displayName || email.split("@")[0],
      emailVerified: false,
    });

    await db.collection("users").doc(user.uid).set(
      {
        email,
        displayName: displayName || email.split("@")[0],
        role: null,
        approved: false,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return res.status(201).json({
      ok: true,
      uid: user.uid,
      email,
      message:
        "Account created. An Admin must assign your role before you can sign in.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Signup failed.";
    if (message.includes("email-already-exists")) {
      return res
        .status(409)
        .json({ error: "An account with this email already exists." });
    }
    return res.status(500).json({ error: message });
  }
}
