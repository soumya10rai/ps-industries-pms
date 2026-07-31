import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { isUserRole, ROLE_LABELS } from "@/lib/types";
import {
  hashInviteToken,
  toDate,
  verifyInviteJwt,
} from "@/lib/auth/invite-token";

/**
 * POST /api/auth/set-password
 * Public: validate invite token, create Firebase Auth user + Firestore profile.
 *
 * Body: { token, inviteId, password, confirmPassword }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const token = typeof body.token === "string" ? body.token : "";
    const inviteId =
      typeof body.inviteId === "string" ? body.inviteId.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const confirmPassword =
      typeof body.confirmPassword === "string" ? body.confirmPassword : "";

    if (!token || !inviteId) {
      return NextResponse.json(
        { error: "Missing invite token or inviteId." },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        { error: "Passwords do not match." },
        { status: 400 }
      );
    }

    const claims = await verifyInviteJwt(token);
    if (!claims || claims.inviteId !== inviteId) {
      return NextResponse.json(
        { error: "Invalid or expired invite token." },
        { status: 400 }
      );
    }

    const db = getAdminDb();
    const inviteRef = db.collection("pending_invites").doc(inviteId);
    const inviteSnap = await inviteRef.get();

    if (!inviteSnap.exists) {
      return NextResponse.json(
        { error: "Invite not found." },
        { status: 404 }
      );
    }

    const invite = inviteSnap.data() ?? {};

    if (invite.status === "accepted") {
      return NextResponse.json(
        { error: "This invite has already been used." },
        { status: 410 }
      );
    }

    if (invite.status === "expired") {
      return NextResponse.json(
        { error: "This invite has expired." },
        { status: 410 }
      );
    }

    if (invite.status !== "pending") {
      return NextResponse.json(
        { error: "Invite is no longer valid." },
        { status: 400 }
      );
    }

    const expiresAt = toDate(invite.expiresAt);
    if (!expiresAt || expiresAt.getTime() < Date.now()) {
      await inviteRef.set({ status: "expired" }, { merge: true });
      return NextResponse.json(
        { error: "This invite has expired." },
        { status: 410 }
      );
    }

    const tokenHash = hashInviteToken(token);
    if (
      typeof invite.tokenHash !== "string" ||
      invite.tokenHash !== tokenHash
    ) {
      return NextResponse.json(
        { error: "Invalid or expired invite token." },
        { status: 400 }
      );
    }

    const email = String(invite.email ?? claims.email).toLowerCase();
    const role = isUserRole(invite.role) ? invite.role : null;

    if (!email || !role) {
      return NextResponse.json(
        { error: "Invite data is incomplete." },
        { status: 400 }
      );
    }

    const auth = getAdminAuth();

    try {
      await auth.getUserByEmail(email);
      return NextResponse.json(
        { error: "A user with this email already exists. Please sign in." },
        { status: 409 }
      );
    } catch {
      // Expected — user should not exist yet
    }

    const displayName = ROLE_LABELS[role];
    const created = await auth.createUser({
      email,
      password,
      displayName,
      emailVerified: true,
      disabled: false,
    });

    await db.collection("users").doc(created.uid).set({
      uid: created.uid,
      email,
      role,
      displayName,
      approved: true,
      isSeeded: false,
      invitedBy: invite.invitedBy ?? null,
      inviteId,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await inviteRef.set(
      {
        status: "accepted",
        acceptedAt: FieldValue.serverTimestamp(),
        acceptedUid: created.uid,
      },
      { merge: true }
    );

    return NextResponse.json({
      success: true,
      message: "Password set! You can now sign in.",
      email,
      role,
    });
  } catch (error) {
    console.error("[set-password]", error);
    const message =
      error instanceof Error ? error.message : "Failed to set password.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * GET /api/auth/set-password?token=&inviteId=
 * Validate invite and return email (for the set-password form).
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token") ?? "";
    const inviteId = request.nextUrl.searchParams.get("inviteId") ?? "";

    if (!token || !inviteId) {
      return NextResponse.json(
        { error: "Missing invite token or inviteId." },
        { status: 400 }
      );
    }

    const claims = await verifyInviteJwt(token);
    if (!claims || claims.inviteId !== inviteId) {
      return NextResponse.json(
        { error: "Invalid or expired invite token." },
        { status: 400 }
      );
    }

    const db = getAdminDb();
    const inviteSnap = await db
      .collection("pending_invites")
      .doc(inviteId)
      .get();

    if (!inviteSnap.exists) {
      return NextResponse.json(
        { error: "Invite not found." },
        { status: 404 }
      );
    }

    const invite = inviteSnap.data() ?? {};

    if (invite.status === "accepted") {
      return NextResponse.json(
        { error: "This invite has already been used." },
        { status: 410 }
      );
    }

    const expiresAt = toDate(invite.expiresAt);
    if (
      invite.status === "expired" ||
      !expiresAt ||
      expiresAt.getTime() < Date.now()
    ) {
      if (invite.status === "pending") {
        await inviteSnap.ref.set({ status: "expired" }, { merge: true });
      }
      return NextResponse.json(
        { error: "This invite has expired." },
        { status: 410 }
      );
    }

    if (invite.status !== "pending") {
      return NextResponse.json(
        { error: "Invite is no longer valid." },
        { status: 400 }
      );
    }

    const tokenHash = hashInviteToken(token);
    if (
      typeof invite.tokenHash !== "string" ||
      invite.tokenHash !== tokenHash
    ) {
      return NextResponse.json(
        { error: "Invalid or expired invite token." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      email: String(invite.email ?? claims.email).toLowerCase(),
      role: invite.role,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error("[set-password:get]", error);
    return NextResponse.json(
      { error: "Failed to validate invite." },
      { status: 500 }
    );
  }
}
