import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { isAllowedEmailDomain } from "@/lib/types";
import { FieldValue } from "firebase-admin/firestore";

/**
 * POST /api/auth/register
 * Server-side registration with email domain validation (security boundary).
 * Creates Firebase Auth user + Firestore profile without a role.
 * Admin must assign role before the user can obtain a session.
 *
 * Body: { email, password, displayName, idToken? }
 * Prefer client Firebase signUp + this endpoint as a validation gate,
 * or pass email/password for fully server-side creation.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const displayName =
      typeof body.displayName === "string" ? body.displayName.trim() : "";

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }

    // Security boundary — reject non-company domains before touching Auth.
    if (!isAllowedEmailDomain(email)) {
      return NextResponse.json(
        {
          error:
            "Registration denied. Only @psindustriesindia.in or @psindustries.in email addresses may register.",
          code: "DOMAIN_NOT_ALLOWED",
        },
        { status: 403 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }

    const auth = getAdminAuth();
    const db = getAdminDb();

    const userRecord = await auth.createUser({
      email,
      password,
      displayName: displayName || email.split("@")[0],
      emailVerified: false,
    });

    await db.collection("users").doc(userRecord.uid).set({
      email,
      displayName: displayName || email.split("@")[0],
      role: null,
      approved: false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      ok: true,
      uid: userRecord.uid,
      email,
      message:
        "Account created. An Admin must assign your role before you can sign in.",
    });
  } catch (error: unknown) {
    console.error("[register]", error);

    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code: string }).code)
        : "";

    if (code === "auth/email-already-exists") {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    const message =
      error instanceof Error ? error.message : "Registration failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
