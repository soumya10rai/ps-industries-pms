import { NextResponse } from "next/server";
import {
  SESSION_COOKIE_NAME,
  clearSessionCookieOptions,
} from "@/lib/session";

/**
 * POST /api/auth/logout
 * Clears the httpOnly session cookie (secure perimeter teardown).
 * Client must also call Firebase signOut (logout()).
 */
export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, "", clearSessionCookieOptions());
  return response;
}
