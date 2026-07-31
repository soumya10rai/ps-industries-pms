import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { isAllowedEmailDomain } from "@/lib/types";
import {
  createResetId,
  hashResetToken,
  resetExpiresAt,
  signResetJwt,
} from "@/lib/auth/reset-token";
import {
  buildResetLink,
  sendPasswordResetEmail,
} from "@/lib/auth/send-invite-email";

const GENERIC_SUCCESS =
  "If an account exists for that email, a password reset link has been sent.";

/**
 * POST /api/auth/forgot-password
 * Body: { email: string }
 *
 * Always returns a generic success message (no email enumeration).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = String(body.email ?? "")
      .trim()
      .toLowerCase();

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { error: "A valid email address is required." },
        { status: 400 }
      );
    }

    // Invalid domain → still generic success (no enumeration)
    if (!isAllowedEmailDomain(email)) {
      return NextResponse.json({ success: true, message: GENERIC_SUCCESS });
    }

    const auth = getAdminAuth();
    let uid: string | null = null;

    try {
      const user = await auth.getUserByEmail(email);
      uid = user.uid;
    } catch {
      return NextResponse.json({ success: true, message: GENERIC_SUCCESS });
    }

    const resetId = createResetId();
    const expiresAt = resetExpiresAt();
    const token = await signResetJwt({ resetId, email, uid }, expiresAt);
    const tokenHash = hashResetToken(token);

    const db = getAdminDb();
    await db.collection("password_resets").doc(resetId).set({
      resetId,
      email,
      uid,
      tokenHash,
      status: "pending",
      createdAt: FieldValue.serverTimestamp(),
      expiresAt,
    });

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      request.nextUrl.origin ||
      "http://localhost:3000";
    const link = buildResetLink(baseUrl, token, resetId);
    const emailResult = await sendPasswordResetEmail(email, link);

    const isDev = process.env.NEXT_PUBLIC_ENV === "development";

    return NextResponse.json({
      success: true,
      message: GENERIC_SUCCESS,
      emailSent: emailResult.sent,
      ...(isDev && !emailResult.sent ? { devResetLink: link } : {}),
      ...(emailResult.error && !emailResult.sent
        ? { emailWarning: emailResult.error }
        : {}),
    });
  } catch (error) {
    console.error("[forgot-password]", error);
    const message =
      error instanceof Error ? error.message : "Failed to process request.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
