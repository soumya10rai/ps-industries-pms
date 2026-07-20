import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  SESSION_REFRESH_THRESHOLD_SECONDS,
  isUserRole,
  type SessionPayload,
  type UserRole,
} from "@/lib/types";

function getSecretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET must be set to a random string of at least 32 characters."
    );
  }
  return new TextEncoder().encode(secret);
}

/** Edge-safe: returns null when SESSION_SECRET is missing/invalid (never throws). */
function tryGetSecretKey(): Uint8Array | null {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) return null;
  return new TextEncoder().encode(secret);
}

export interface CreateSessionInput {
  uid: string;
  email: string;
  role: UserRole;
  name?: string;
}

/**
 * Create a signed HS256 JWT session token (jose).
 * Stored in an httpOnly cookie by the API route — never readable from JS.
 * Expires after SESSION_MAX_AGE_SECONDS (24 hours).
 */
export async function createSessionToken(
  input: CreateSessionInput
): Promise<{ token: string; maxAge: number }> {
  const maxAge = SESSION_MAX_AGE_SECONDS;
  const now = Math.floor(Date.now() / 1000);

  const token = await new SignJWT({
    uid: input.uid,
    email: input.email,
    role: input.role,
    name: input.name ?? "",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(now + maxAge)
    .setSubject(input.uid)
    .sign(getSecretKey());

  return { token, maxAge };
}

/**
 * Verify and decode a session JWT. Returns null if invalid/expired/missing secret.
 * Safe to call from Edge middleware and Node route handlers.
 */
export async function verifySessionToken(
  token: string
): Promise<SessionPayload | null> {
  const secret = tryGetSecretKey();
  if (!secret || !token) return null;

  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
    });
    return normalizePayload(payload);
  } catch {
    return null;
  }
}

/**
 * Sliding-session refresh: if the token is valid but nearing expiry,
 * mint a fresh 24h JWT with the same claims. Returns null when refresh
 * is not needed or the session is invalid.
 */
export async function refreshSessionToken(
  token: string
): Promise<{ token: string; maxAge: number; session: SessionPayload } | null> {
  const session = await verifySessionToken(token);
  if (!session) return null;

  const now = Math.floor(Date.now() / 1000);
  const remaining = session.exp - now;
  if (remaining > SESSION_REFRESH_THRESHOLD_SECONDS) {
    return null;
  }

  const { token: nextToken, maxAge } = await createSessionToken({
    uid: session.uid,
    email: session.email,
    role: session.role,
    name: session.name,
  });

  const refreshed = await verifySessionToken(nextToken);
  if (!refreshed) return null;

  return { token: nextToken, maxAge, session: refreshed };
}

function normalizePayload(payload: JWTPayload): SessionPayload | null {
  const uid = typeof payload.uid === "string" ? payload.uid : null;
  const email = typeof payload.email === "string" ? payload.email : null;
  const role = isUserRole(payload.role) ? payload.role : null;
  const iat = typeof payload.iat === "number" ? payload.iat : 0;
  const exp = typeof payload.exp === "number" ? payload.exp : 0;

  if (!uid || !email || !role) return null;

  return {
    uid,
    email,
    role,
    name: typeof payload.name === "string" ? payload.name : undefined,
    iat,
    exp,
  };
}

/**
 * Cookie options for the session JWT.
 * - httpOnly: not accessible to client JS
 * - secure: HTTPS only (enabled in production)
 * - sameSite: Strict — blocks cross-site cookie sends
 */
export function sessionCookieOptions(maxAge: number) {
  return {
    name: SESSION_COOKIE_NAME,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge,
  };
}

/** Options that immediately expire / clear the session cookie. */
export function clearSessionCookieOptions() {
  return {
    ...sessionCookieOptions(0),
    maxAge: 0,
  };
}

export { SESSION_COOKIE_NAME };
