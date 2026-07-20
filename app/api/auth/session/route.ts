import { NextRequest, NextResponse } from "next/server";
import { verifyIdToken, getAdminDb } from "@/lib/firebase-admin";
import { getRole, getHomeForRole } from "@/lib/auth";
import {
  createSessionToken,
  sessionCookieOptions,
  SESSION_COOKIE_NAME,
} from "@/lib/session";
import { isAllowedEmailDomain } from "@/lib/types";

/**
 * POST /api/auth/session
 * Body: { idToken: string, rememberMe?: boolean }
 *
 * Verifies the Firebase ID token, loads role from Firestore /users/{uid},
 * and sets an httpOnly JWT session cookie.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const idToken = typeof body.idToken === "string" ? body.idToken : "";
    const rememberMe = Boolean(body.rememberMe);

    if (!idToken) {
      return NextResponse.json(
        { error: "Missing Firebase ID token." },
        { status: 400 }
      );
    }

    const decoded = await verifyIdToken(idToken);
    const email = (decoded.email ?? "").toLowerCase();

    if (!email || !isAllowedEmailDomain(email)) {
      return NextResponse.json(
        {
          error:
            "Access denied. Only @psindustriesindia.in or @psindustries.in accounts are allowed.",
        },
        { status: 403 }
      );
    }

    const db = getAdminDb();
    const userSnap = await db.collection("users").doc(decoded.uid).get();

    if (!userSnap.exists) {
      return NextResponse.json(
        {
          error:
            "No user profile found. Register first, then ask an Admin to assign your role.",
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

    const { token, maxAge } = await createSessionToken({
      uid: decoded.uid,
      email,
      role,
      name:
        typeof userData.displayName === "string"
          ? userData.displayName
          : decoded.name,
      rememberMe,
    });

    const cookie = sessionCookieOptions(maxAge);
    const response = NextResponse.json({
      ok: true,
      role,
      redirectTo: getHomeForRole(role),
      user: {
        uid: decoded.uid,
        email,
        role,
        displayName: userData.displayName ?? decoded.name ?? "",
      },
    });

    response.cookies.set(SESSION_COOKIE_NAME, token, cookie);
    return response;
  } catch (error) {
    console.error("[session]", error);
    const message =
      error instanceof Error ? error.message : "Failed to create session.";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}

/**
 * GET /api/auth/session — return current session payload (for client layout).
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    if (!token) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    const { verifySessionToken } = await import("@/lib/session");
    const session = await verifySessionToken(token);

    if (!session) {
      const response = NextResponse.json(
        { authenticated: false },
        { status: 401 }
      );
      response.cookies.set(SESSION_COOKIE_NAME, "", {
        ...sessionCookieOptions(0),
        maxAge: 0,
      });
      return response;
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        uid: session.uid,
        email: session.email,
        role: session.role,
        displayName: session.name ?? "",
      },
      redirectTo: getHomeForRole(session.role),
    });
  } catch (error) {
    console.error("[session:get]", error);
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
}
