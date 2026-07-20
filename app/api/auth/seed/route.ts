import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { isUserRole, type UserRole } from "@/lib/types";
import { FieldValue } from "firebase-admin/firestore";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/session";

/**
 * Sample users seeded into Firebase Auth + Firestore.
 * Passwords are for local/dev only — change immediately in production.
 */
const SAMPLE_USERS: Array<{
  email: string;
  password: string;
  displayName: string;
  role: UserRole;
}> = [
  {
    email: "admin@psindustries.in",
    password: "Admin@PS2024!",
    displayName: "System Admin",
    role: "admin",
  },
  {
    email: "plant@psindustriesindia.in",
    password: "Plant@PS2024!",
    displayName: "Plant Head",
    role: "plant_head",
  },
  {
    email: "accountant@psindustriesindia.in",
    password: "Account@PS2024!",
    displayName: "Accountant",
    role: "accountant",
  },
  {
    email: "store@psindustriesindia.in",
    password: "Store@PS2024!",
    displayName: "Store Manager",
    role: "store_manager",
  },
  {
    email: "production@psindustriesindia.in",
    password: "Prod@PS2024!",
    displayName: "Production Head",
    role: "production_head",
  },
];

/**
 * POST /api/auth/seed
 *
 * Secure seed: creates sample Auth users and writes role to Firestore
 * at /users/{uid} with field `role`.
 *
 * Authorization (any one):
 * 1. Header `x-seed-secret` matching SEED_SECRET env
 * 2. Existing admin session cookie
 *
 * Body (optional): { email, role } to assign a single role without full seed.
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

    // Single role assignment: { email, role }
    if (body.email && body.role) {
      return assignRole(String(body.email), body.role);
    }

    const auth = getAdminAuth();
    const db = getAdminDb();
    const results: Array<Record<string, unknown>> = [];

    for (const sample of SAMPLE_USERS) {
      let uid: string;

      try {
        const existing = await auth.getUserByEmail(sample.email);
        uid = existing.uid;
        await auth.updateUser(uid, {
          password: sample.password,
          displayName: sample.displayName,
        });
      } catch {
        const created = await auth.createUser({
          email: sample.email,
          password: sample.password,
          displayName: sample.displayName,
          emailVerified: true,
        });
        uid = created.uid;
      }

      // Role stored at /users/{uid} → role field
      await db.collection("users").doc(uid).set(
        {
          email: sample.email,
          displayName: sample.displayName,
          role: sample.role,
          approved: true,
          updatedAt: FieldValue.serverTimestamp(),
          createdAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      results.push({
        email: sample.email,
        uid,
        role: sample.role,
        home: `/${sample.role === "store_manager" ? "store" : sample.role === "production_head" ? "production" : sample.role === "plant_head" ? "plant-head" : sample.role}`,
      });
    }

    return NextResponse.json({
      ok: true,
      message: "Sample users seeded. Change passwords before production use.",
      users: results,
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
      { error: "Invalid role. Use admin | plant_head | accountant | store_manager | production_head." },
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
      { error: `No Auth user found for ${normalized}. Register first.` },
      { status: 404 }
    );
  }

  await db.collection("users").doc(uid).set(
    {
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
