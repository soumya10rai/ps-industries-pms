/**
 * Session helpers for reconciliation API routes.
 */

import { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session";
import type { SessionPayload, UserRole } from "@/lib/types";

/** Full access: generate, regenerate, delete, export. */
const WRITE_ROLES: UserRole[] = ["admin", "plant_head"];

/** Read-only: view cached reports + history. */
const READ_ROLES: UserRole[] = [
  "admin",
  "plant_head",
  "store_manager",
  "production_head",
];

export async function getReconciliationSession(
  request: NextRequest
): Promise<SessionPayload | null> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export function canWriteReconciliation(
  role: UserRole | null | undefined
): boolean {
  return !!role && WRITE_ROLES.includes(role);
}

export function canReadReconciliation(
  role: UserRole | null | undefined
): boolean {
  return !!role && READ_ROLES.includes(role);
}
