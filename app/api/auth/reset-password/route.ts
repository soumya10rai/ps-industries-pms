import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import {
  hashResetToken,
  toDate,
  verifyResetJwt,
} from "@/lib/auth/reset-token";

/**
 * POST /api/auth/reset-password
 * Body: { token, resetId, password, confirmPassword }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const token = typeof body.token === "string" ? body.token : "";
    const resetId =
      typeof body.resetId === "string" ? body.resetId.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const confirmPassword =
      typeof body.confirmPassword === "string" ? body.confirmPassword : "";

    if (!token || !resetId) {
      return NextResponse.json(
        { error: "Missing reset token or resetId." },
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

    const claims = await verifyResetJwt(token);
    if (!claims || claims.resetId !== resetId) {
      return NextResponse.json(
        { error: "Invalid or expired reset link." },
        { status: 400 }
      );
    }

    const db = getAdminDb();
    const resetRef = db.collection("password_resets").doc(resetId);
    const resetSnap = await resetRef.get();

    if (!resetSnap.exists) {
      return NextResponse.json(
        { error: "Reset request not found." },
        { status: 404 }
      );
    }

    const reset = resetSnap.data() ?? {};

    if (reset.status === "used") {
      return NextResponse.json(
        { error: "This reset link has already been used." },
        { status: 410 }
      );
    }

    if (reset.status === "expired") {
      return NextResponse.json(
        { error: "This reset link has expired." },
        { status: 410 }
      );
    }

    if (reset.status !== "pending") {
      return NextResponse.json(
        { error: "Reset link is no longer valid." },
        { status: 400 }
      );
    }

    const expiresAt = toDate(reset.expiresAt);
    if (!expiresAt || expiresAt.getTime() < Date.now()) {
      await resetRef.set({ status: "expired" }, { merge: true });
      return NextResponse.json(
        { error: "This reset link has expired." },
        { status: 410 }
      );
    }

    const tokenHash = hashResetToken(token);
    if (
      typeof reset.tokenHash !== "string" ||
      reset.tokenHash !== tokenHash
    ) {
      return NextResponse.json(
        { error: "Invalid or expired reset link." },
        { status: 400 }
      );
    }

    const uid = String(reset.uid ?? claims.uid);
    if (!uid) {
      return NextResponse.json(
        { error: "Reset data is incomplete." },
        { status: 400 }
      );
    }

    const auth = getAdminAuth();
    await auth.updateUser(uid, { password });

    await resetRef.set(
      {
        status: "used",
        usedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({
      success: true,
      message: "Password updated! You can now sign in.",
      email: String(reset.email ?? claims.email).toLowerCase(),
    });
  } catch (error) {
    console.error("[reset-password]", error);
    const message =
      error instanceof Error ? error.message : "Failed to reset password.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * GET /api/auth/reset-password?token=&resetId=
 * Validate reset link and return email for the form.
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token") ?? "";
    const resetId = request.nextUrl.searchParams.get("resetId") ?? "";

    if (!token || !resetId) {
      return NextResponse.json(
        { error: "Missing reset token or resetId." },
        { status: 400 }
      );
    }

    const claims = await verifyResetJwt(token);
    if (!claims || claims.resetId !== resetId) {
      return NextResponse.json(
        { error: "Invalid or expired reset link." },
        { status: 400 }
      );
    }

    const db = getAdminDb();
    const resetSnap = await db.collection("password_resets").doc(resetId).get();

    if (!resetSnap.exists) {
      return NextResponse.json(
        { error: "Reset request not found." },
        { status: 404 }
      );
    }

    const reset = resetSnap.data() ?? {};

    if (reset.status === "used") {
      return NextResponse.json(
        { error: "This reset link has already been used." },
        { status: 410 }
      );
    }

    const expiresAt = toDate(reset.expiresAt);
    if (
      reset.status === "expired" ||
      !expiresAt ||
      expiresAt.getTime() < Date.now()
    ) {
      if (reset.status === "pending") {
        await resetSnap.ref.set({ status: "expired" }, { merge: true });
      }
      return NextResponse.json(
        { error: "This reset link has expired." },
        { status: 410 }
      );
    }

    if (reset.status !== "pending") {
      return NextResponse.json(
        { error: "Reset link is no longer valid." },
        { status: 400 }
      );
    }

    const tokenHash = hashResetToken(token);
    if (
      typeof reset.tokenHash !== "string" ||
      reset.tokenHash !== tokenHash
    ) {
      return NextResponse.json(
        { error: "Invalid or expired reset link." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      email: String(reset.email ?? claims.email).toLowerCase(),
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error("[reset-password:get]", error);
    return NextResponse.json(
      { error: "Failed to validate reset link." },
      { status: 500 }
    );
  }
}
