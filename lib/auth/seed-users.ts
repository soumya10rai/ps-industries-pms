import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import type { UserRole } from "@/lib/types";

export interface SeedUser {
  email: string;
  password: string;
  displayName: string;
  role: UserRole;
}

/**
 * Development/demo test users — one per role.
 * Only used when NEXT_PUBLIC_ENV=development.
 */
export const DEV_SEED_USERS: readonly SeedUser[] = [
  {
    email: "admin@ps.com",
    password: "Admin@123",
    displayName: "System Admin",
    role: "admin",
  },
  {
    email: "planthead@ps.com",
    password: "PlantHead@123",
    displayName: "Plant Head",
    role: "plant_head",
  },
  {
    email: "accountant@ps.com",
    password: "Accountant@123",
    displayName: "Accountant",
    role: "accountant",
  },
  {
    email: "storemanager@ps.com",
    password: "StoreManager@123",
    displayName: "Store Manager",
    role: "store_manager",
  },
  {
    email: "productionhead@ps.com",
    password: "ProdHead@123",
    displayName: "Production Head",
    role: "production_head",
  },
] as const;

export interface SeedResult {
  email: string;
  uid: string;
  role: UserRole;
  action: "created" | "exists";
}

/**
 * Idempotent seed: creates Firebase Auth users + Firestore profiles
 * only when they do not already exist. Safe to run multiple times.
 */
export async function seedDevUsers(): Promise<SeedResult[]> {
  const auth = getAdminAuth();
  const db = getAdminDb();
  const results: SeedResult[] = [];

  for (const user of DEV_SEED_USERS) {
    let uid: string;
    let action: "created" | "exists";

    try {
      const existing = await auth.getUserByEmail(user.email);
      uid = existing.uid;
      action = "exists";
    } catch {
      const created = await auth.createUser({
        email: user.email,
        password: user.password,
        displayName: user.displayName,
        emailVerified: true,
        disabled: false,
      });
      uid = created.uid;
      action = "created";
    }

    const ref = db.collection("users").doc(uid);
    const snap = await ref.get();

    if (!snap.exists) {
      await ref.set({
        uid,
        email: user.email,
        role: user.role,
        displayName: user.displayName,
        approved: true,
        isSeeded: true,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    } else {
      // Ensure role/metadata stay in sync without overwriting passwords
      await ref.set(
        {
          uid,
          email: user.email,
          role: user.role,
          displayName: user.displayName,
          approved: true,
          isSeeded: true,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    results.push({ email: user.email, uid, role: user.role, action });
  }

  return results;
}

/** True only for explicit development/demo mode — never production. */
export function shouldSeedDevUsers(): boolean {
  return process.env.NEXT_PUBLIC_ENV === "development";
}
