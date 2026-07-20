import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_REMEMBER_SECONDS,
  SESSION_MAX_AGE_SECONDS,
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

export interface CreateSessionInput {
  uid: string;
  email: string;
  role: UserRole;
  name?: string;
  rememberMe?: boolean;
}

/**
 * Create a signed JWT session token (jose).
 * Stored in an httpOnly cookie by the API route — never readable from JS.
 */
export async function createSessionToken(
  input: CreateSessionInput
): Promise<{ token: string; maxAge: number }> {
  const maxAge = input.rememberMe
    ? SESSION_MAX_AGE_REMEMBER_SECONDS
    : SESSION_MAX_AGE_SECONDS;

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
 * Verify and decode a session JWT. Returns null if invalid/expired.
 */
export async function verifySessionToken(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), {
      algorithms: ["HS256"],
    });
    return normalizePayload(payload);
  } catch {
    return null;
  }
}

function normalizePayload(payload: JWTPayload): SessionPayload | null {
  const uid = typeof payload.uid === "string" ? payload.uid : null;
  const email = typeof payload.email === "string" ? payload.email : null;
  const role = getRoleFromPayload(payload.role);
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

function getRoleFromPayload(value: unknown): UserRole | null {
  return isUserRole(value) ? value : null;
}

export function sessionCookieOptions(maxAge: number) {
  return {
    name: SESSION_COOKIE_NAME,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export { SESSION_COOKIE_NAME };
