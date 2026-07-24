import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminAuth, getAdminDb, verifyIdToken } from "@/lib/firebase-admin";
import { getHomeForRole, getRole } from "@/lib/auth";
import {
  createSessionToken,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
} from "@/lib/session";
import { isAllowedEmailDomain } from "@/lib/types";

/**
 * POST /api/auth/signin
 *
 * Accepts either:
 *   { idToken } — preferred (client already signed in with Firebase)
 *   { email, password } — server-side verify via Firebase Auth REST
 *
 * Sets the httpOnly session cookie and returns role + redirect.
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
    let uid: string;
    let email: string;
    let name = "";

    const idToken = typeof req.body?.idToken === "string" ? req.body.idToken : "";

    if (idToken) {
      const decoded = await verifyIdToken(idToken);
      uid = decoded.uid;
      email = (decoded.email ?? "").toLowerCase();
      name = decoded.name ?? "";
    } else {
      const rawEmail = String(req.body?.email ?? "")
        .trim()
        .toLowerCase();
      const password = String(req.body?.password ?? "");

      if (!rawEmail || !password) {
        return res.status(400).json({
          error: "Provide idToken, or email and password.",
        });
      }

      if (!isAllowedEmailDomain(rawEmail)) {
        return res.status(403).json({
          error:
            "Only @psindustriesindia.in or @psindustries.in accounts may sign in.",
        });
      }

      const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          error: "NEXT_PUBLIC_FIREBASE_API_KEY is not configured.",
        });
      }

      const firebaseRes = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: rawEmail,
            password,
            returnSecureToken: true,
          }),
        }
      );

      const firebaseData = await firebaseRes.json();
      if (!firebaseRes.ok) {
        return res.status(401).json({
          error: "Incorrect email or password.",
          detail: firebaseData?.error?.message,
        });
      }

      uid = String(firebaseData.localId);
      email = String(firebaseData.email ?? rawEmail).toLowerCase();
      name = String(firebaseData.displayName ?? "");
    }

    if (!email || !isAllowedEmailDomain(email)) {
      return res.status(403).json({
        error:
          "Access denied. Only company email domains are allowed.",
      });
    }

    const db = getAdminDb();
    const userSnap = await db.collection("users").doc(uid).get();

    if (!userSnap.exists) {
      // Ensure Auth user exists; profile may be missing for legacy accounts
      try {
        await getAdminAuth().getUser(uid);
      } catch {
        return res.status(403).json({ error: "User not found." });
      }
      return res.status(403).json({
        error:
          "No user profile found. Register first, then ask an Admin to assign your role.",
      });
    }

    const userData = userSnap.data() ?? {};
    const role = getRole(userData.role);

    if (!role || !userData.approved) {
      return res.status(403).json({
        error:
          "Your account is pending role assignment. Contact an Admin to activate access.",
        pending: true,
      });
    }

    const displayName =
      typeof userData.displayName === "string"
        ? userData.displayName
        : name || email.split("@")[0];

    const { token, maxAge } = await createSessionToken({
      uid,
      email,
      role,
      name: displayName,
    });

    const cookie = sessionCookieOptions(maxAge);
    res.setHeader(
      "Set-Cookie",
      serializeCookie(SESSION_COOKIE_NAME, token, cookie)
    );

    return res.status(200).json({
      ok: true,
      role,
      redirectTo: getHomeForRole(role),
      user: {
        uid,
        email,
        role,
        displayName,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sign-in failed.";
    return res.status(401).json({ error: message });
  }
}

function serializeCookie(
  name: string,
  value: string,
  options: {
    httpOnly: boolean;
    secure: boolean;
    sameSite: "strict" | "lax" | "none";
    path: string;
    maxAge: number;
  }
): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${options.path}`,
    `Max-Age=${options.maxAge}`,
    `SameSite=${options.sameSite[0].toUpperCase()}${options.sameSite.slice(1)}`,
  ];
  if (options.httpOnly) parts.push("HttpOnly");
  if (options.secure) parts.push("Secure");
  return parts.join("; ");
}
