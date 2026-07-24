import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { ROLE_HOME, isUserRole, type UserRole } from "@/lib/types";
import { FieldValue } from "firebase-admin/firestore";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/session";

/**
 * Sample users — passwords for local/dev only. Change in production.
 */
const SAMPLE_USERS: Array<{
  email: string;
  password: string;
  displayName: string;
  role: UserRole;
}> = [
  {
    email: "admin@psindustries.in",
    password: "admin123",
    displayName: "System Admin",
    role: "admin",
  },
  {
    email: "plant@psindustries.in",
    password: "plant123",
    displayName: "Plant Head",
    role: "plant_head",
  },
  {
    email: "accountant@psindustries.in",
    password: "acc123",
    displayName: "Accountant",
    role: "accountant",
  },
  {
    email: "store@psindustries.in",
    password: "store123",
    displayName: "Store Manager",
    role: "store_manager",
  },
  {
    email: "production@psindustries.in",
    password: "prod123",
    displayName: "Production Head",
    role: "production_head",
  },
];

/**
 * POST /api/auth/seed
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
        password: sample.password,
        uid,
        role: sample.role,
        home: ROLE_HOME[sample.role],
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
