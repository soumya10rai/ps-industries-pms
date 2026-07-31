/**
 * Session helpers for dispatch API routes.
 */

import { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session";
import type { SessionPayload, UserRole } from "@/lib/types";

const WRITE_ROLES: UserRole[] = ["admin", "accountant", "plant_head"];
const READ_ROLES: UserRole[] = [
  "admin",
  "accountant",
  "plant_head",
  "store_manager",
  "production_head",
];
/** Plant head + admin can export variance PDFs. */
const PDF_ROLES: UserRole[] = ["admin", "plant_head", "accountant"];

export async function getDispatchSession(
  request: NextRequest
): Promise<SessionPayload | null> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export function canWriteDispatch(role: UserRole | null | undefined): boolean {
  return !!role && WRITE_ROLES.includes(role);
}

export function canReadDispatch(role: UserRole | null | undefined): boolean {
  return !!role && READ_ROLES.includes(role);
}

export function canExportDispatchPdf(
  role: UserRole | null | undefined
): boolean {
  return !!role && PDF_ROLES.includes(role);
}
