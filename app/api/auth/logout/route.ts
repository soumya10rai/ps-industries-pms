import { NextResponse } from "next/server";
import {
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
} from "@/lib/session";

/**
 * POST /api/auth/logout
 * Clears the httpOnly session cookie.
 * Client must also call Firebase signOut (logout()).
 */
export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    ...sessionCookieOptions(0),
    maxAge: 0,
  });
  return response;
}
