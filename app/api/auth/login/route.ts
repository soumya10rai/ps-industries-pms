import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb, verifyIdToken } from "@/lib/firebase-admin";
import { getHomeForRole, getRole } from "@/lib/auth";
import {
  createSessionToken,
  sessionCookieOptions,
  SESSION_COOKIE_NAME,
} from "@/lib/session";
import { isAllowedEmailDomain } from "@/lib/types";

/**
 * POST /api/auth/login
 *
 * Mints the httpOnly `ps_session` cookie.
 * Accepts { idToken } (preferred) or { email, password }.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));

    let uid: string;
    let email: string;
    let name = "";

    const idToken = typeof body.idToken === "string" ? body.idToken : "";

    if (idToken) {
      const decoded = await verifyIdToken(idToken);
      uid = decoded.uid;
      email = (decoded.email ?? "").toLowerCase();
      name = decoded.name ?? "";
    } else {
      const rawEmail = String(body.email ?? "")
        .trim()
        .toLowerCase();
      const password = String(body.password ?? "");

      if (!rawEmail || !password) {
        return NextResponse.json(
          { error: "Provide idToken, or email and password." },
          { status: 400 }
        );
      }

      if (!isAllowedEmailDomain(rawEmail)) {
        return NextResponse.json(
          {
            error:
              "Only company email domains may sign in.",
          },
          { status: 403 }
        );
      }

      const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
      if (!apiKey) {
        return NextResponse.json(
          { error: "NEXT_PUBLIC_FIREBASE_API_KEY is not configured." },
          { status: 500 }
        );
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
        return NextResponse.json(
          {
            error: "Incorrect email or password.",
            detail: firebaseData?.error?.message,
          },
          { status: 401 }
        );
      }

      uid = String(firebaseData.localId);
      email = String(firebaseData.email ?? rawEmail).toLowerCase();
      name = String(firebaseData.displayName ?? "");
    }

    if (!email || !isAllowedEmailDomain(email)) {
      return NextResponse.json(
        {
          error:
            "Access denied. Only company email domains are allowed.",
        },
        { status: 403 }
      );
    }

    const db = getAdminDb();
    const userSnap = await db.collection("users").doc(uid).get();

    if (!userSnap.exists) {
      try {
        await getAdminAuth().getUser(uid);
      } catch {
        return NextResponse.json(
          { error: "User not found." },
          { status: 403 }
        );
      }
      return NextResponse.json(
        {
          error:
            "No user profile found. Ask an Admin to invite you or assign a role.",
        },
        { status: 403 }
      );
    }

    const userData = userSnap.data() ?? {};
    const role = getRole(userData.role);

    if (!role || !userData.approved) {
      return NextResponse.json(
        {
          error:
            "Your account is pending role assignment. Contact an Admin to activate access.",
          pending: true,
        },
        { status: 403 }
      );
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

    const response = NextResponse.json({
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

    response.cookies.set(
      SESSION_COOKIE_NAME,
      token,
      sessionCookieOptions(maxAge)
    );

    return response;
  } catch (error) {
    console.error("[login]", error);
    const message =
      error instanceof Error ? error.message : "Sign-in failed.";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
