import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { ROLE_HOME, isUserRole } from "@/lib/types";
import { FieldValue } from "firebase-admin/firestore";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/session";
import {
  DEV_SEED_USERS,
  seedDevUsers,
  shouldSeedDevUsers,
} from "@/lib/auth/seed-users";

/**
 * POST /api/auth/seed
 *
 * - No body: seed development demo users (idempotent)
 * - { email, role }: assign role to an existing Auth user (admin / seed secret)
 */
export async function POST(request: NextRequest) {
  try {
    const seedSecret = process.env.SEED_SECRET;
    const headerSecret = request.headers.get("x-seed-secret");
    const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;

    let authorized = false;

    if (seedSecret && headerSecret && headerSecret === seedSecret) {
      authorized = true;
    }

    if (!authorized && sessionToken) {
      const session = await verifySessionToken(sessionToken);
      if (session?.role === "admin") {
        authorized = true;
      }
    }

    // Auto-seed path for local instrumentation / scripts in development
    if (!authorized && shouldSeedDevUsers() && seedSecret && headerSecret === seedSecret) {
      authorized = true;
    }

    if (!authorized) {
      return NextResponse.json(
        {
          error:
            "Unauthorized. Provide x-seed-secret header or an admin session.",
        },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));

    if (body.email && body.role) {
      return assignRole(String(body.email), body.role);
    }

    const results = await seedDevUsers();

    return NextResponse.json({
      ok: true,
      message: "Dev users seeded. Safe to re-run (idempotent).",
      users: results.map((r) => {
        const seed = DEV_SEED_USERS.find((u) => u.email === r.email);
        return {
          email: r.email,
          password: seed?.password,
          uid: r.uid,
          role: r.role,
          action: r.action,
          home: ROLE_HOME[r.role],
        };
      }),
    });
  } catch (error) {
    console.error("[seed]", error);
    const message =
      error instanceof Error ? error.message : "Seed failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function assignRole(email: string, rawRole: unknown) {
  if (!isUserRole(rawRole)) {
    return NextResponse.json(
      {
        error:
          "Invalid role. Use admin | plant_head | accountant | store_manager | production_head.",
      },
      { status: 400 }
    );
  }

  const auth = getAdminAuth();
  const db = getAdminDb();
  const normalized = email.trim().toLowerCase();

  let uid: string;
  try {
    const user = await auth.getUserByEmail(normalized);
    uid = user.uid;
  } catch {
    return NextResponse.json(
      { error: `No Auth user found for ${normalized}. Invite or register first.` },
      { status: 404 }
    );
  }

  await db.collection("users").doc(uid).set(
    {
      uid,
      email: normalized,
      role: rawRole,
      approved: true,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return NextResponse.json({
    ok: true,
    uid,
    email: normalized,
    role: rawRole,
    message: `Role "${rawRole}" assigned to ${normalized}.`,
  });
}
