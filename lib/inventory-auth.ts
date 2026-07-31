/**
 * Session helpers for inventory API routes.
 */

import { NextRequest } from "next/server";
import {
  SESSION_COOKIE_NAME,
  verifySessionToken,
} from "@/lib/session";
import type { SessionPayload, UserRole } from "@/lib/types";

const WRITE_ROLES: UserRole[] = ["admin", "plant_head", "store_manager"];
const READ_ROLES: UserRole[] = [
  "admin",
  "plant_head",
  "store_manager",
];

export async function getInventorySession(
  request: NextRequest
): Promise<SessionPayload | null> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export function canWriteInventory(role: UserRole | null | undefined): boolean {
  return !!role && WRITE_ROLES.includes(role);
}

export function canReadInventory(role: UserRole | null | undefined): boolean {
  return !!role && READ_ROLES.includes(role);
}
