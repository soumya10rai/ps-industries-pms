import { createHash, randomBytes, randomUUID } from "crypto";
import { SignJWT, jwtVerify } from "jose";
import type { UserRole } from "@/lib/types";

export const INVITE_EXPIRY_DAYS = 7;
export const INVITE_EXPIRY_SECONDS = INVITE_EXPIRY_DAYS * 24 * 60 * 60;

export type InviteStatus = "pending" | "accepted" | "expired";

export interface InviteTokenClaims {
  inviteId: string;
  email: string;
  role: UserRole;
}

function getInviteSecret(): Uint8Array {
  const secret =
    process.env.INVITE_TOKEN_SECRET || process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "INVITE_TOKEN_SECRET or SESSION_SECRET must be set (≥ 32 characters)."
    );
  }
  return new TextEncoder().encode(secret);
}

export function createInviteId(): string {
  return randomUUID();
}

/** Opaque random token for the invite URL (never log this). */
export function createInviteToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function inviteExpiresAt(from = new Date()): Date {
  return new Date(from.getTime() + INVITE_EXPIRY_SECONDS * 1000);
}

/**
 * Signed JWT wrapping invite claims — used as the URL token.
 * Single-use is enforced via Firestore status, not the JWT alone.
 */
export async function signInviteJwt(
  claims: InviteTokenClaims,
  expiresAt: Date
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const exp = Math.floor(expiresAt.getTime() / 1000);

  return new SignJWT({
    inviteId: claims.inviteId,
    email: claims.email,
    role: claims.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .setSubject(claims.inviteId)
    .setJti(randomUUID())
    .sign(getInviteSecret());
}

export async function verifyInviteJwt(
  token: string
): Promise<InviteTokenClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getInviteSecret(), {
      algorithms: ["HS256"],
    });

    const inviteId =
      typeof payload.inviteId === "string" ? payload.inviteId : null;
    const email = typeof payload.email === "string" ? payload.email : null;
    const role = typeof payload.role === "string" ? payload.role : null;

    if (!inviteId || !email || !role) return null;

    return {
      inviteId,
      email: email.toLowerCase(),
      role: role as UserRole,
    };
  } catch {
    return null;
  }
}

type TimestampLike = { toDate: () => Date };

export function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "string") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as TimestampLike).toDate === "function"
  ) {
    return (value as TimestampLike).toDate();
  }
  return null;
}
