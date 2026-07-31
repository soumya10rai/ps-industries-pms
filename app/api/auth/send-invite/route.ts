import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import {
  SESSION_COOKIE_NAME,
  verifySessionToken,
} from "@/lib/session";
import { isUserRole, isAllowedEmailDomain } from "@/lib/types";
import {
  createInviteId,
  hashInviteToken,
  inviteExpiresAt,
  signInviteJwt,
} from "@/lib/auth/invite-token";
import {
  buildInviteLink,
  sendInviteEmail,
} from "@/lib/auth/send-invite-email";

/**
 * POST /api/auth/send-invite
 * Admin-only: create a pending invite and email the set-password link.
 *
 * Body: { email: string, role: UserRole }
 */
export async function POST(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    const session = sessionToken
      ? await verifySessionToken(sessionToken)
      : null;

    if (!session || session.role !== "admin") {
      return NextResponse.json(
        { error: "Unauthorized. Admin access required." },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const email = String(body.email ?? "")
      .trim()
      .toLowerCase();
    const role = body.role;

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { error: "A valid email address is required." },
        { status: 400 }
      );
    }

    if (!isAllowedEmailDomain(email)) {
      return NextResponse.json(
        {
          error:
            "Only company email domains (@ps.com, @psindustries.in, @psindustriesindia.in) may be invited.",
        },
        { status: 400 }
      );
    }

    if (!isUserRole(role)) {
      return NextResponse.json(
        {
          error:
            "Invalid role. Use admin | plant_head | accountant | store_manager | production_head.",
        },
        { status: 400 }
      );
    }

    const auth = getAdminAuth();
    try {
      await auth.getUserByEmail(email);
      return NextResponse.json(
        { error: "A user with this email already exists." },
        { status: 409 }
      );
    } catch {
      // Expected when the email is not yet registered
    }

    const inviteId = createInviteId();
    const expiresAt = inviteExpiresAt();
    const token = await signInviteJwt(
      { inviteId, email, role },
      expiresAt
    );
    const tokenHash = hashInviteToken(token);

    const db = getAdminDb();
    await db.collection("pending_invites").doc(inviteId).set({
      inviteId,
      email,
      role,
      invitedBy: session.uid,
      invitedAt: FieldValue.serverTimestamp(),
      expiresAt,
      tokenHash,
      status: "pending",
    });

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      request.nextUrl.origin ||
      "http://localhost:3000";
    const link = buildInviteLink(baseUrl, token, inviteId);
    const emailResult = await sendInviteEmail(email, link);

    const isDev = process.env.NEXT_PUBLIC_ENV === "development";

    return NextResponse.json({
      success: true,
      inviteId,
      emailSent: emailResult.sent,
      ...(isDev && !emailResult.sent
        ? { devInviteLink: link }
        : {}),
      ...(emailResult.error && !emailResult.sent
        ? { emailWarning: emailResult.error }
        : {}),
    });
  } catch (error) {
    console.error("[send-invite]", error);
    const message =
      error instanceof Error ? error.message : "Failed to send invite.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
