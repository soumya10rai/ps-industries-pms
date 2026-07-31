import { createHash, randomUUID } from "crypto";
import { SignJWT, jwtVerify } from "jose";
import { toDate } from "@/lib/auth/invite-token";

export const RESET_EXPIRY_HOURS = 1;
export const RESET_EXPIRY_SECONDS = RESET_EXPIRY_HOURS * 60 * 60;

export type ResetStatus = "pending" | "used" | "expired";

export interface ResetTokenClaims {
  resetId: string;
  email: string;
  uid: string;
}

function getResetSecret(): Uint8Array {
  const secret =
    process.env.INVITE_TOKEN_SECRET || process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "INVITE_TOKEN_SECRET or SESSION_SECRET must be set (≥ 32 characters)."
    );
  }
  return new TextEncoder().encode(secret);
}

export function createResetId(): string {
  return randomUUID();
}

export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function resetExpiresAt(from = new Date()): Date {
  return new Date(from.getTime() + RESET_EXPIRY_SECONDS * 1000);
}

export async function signResetJwt(
  claims: ResetTokenClaims,
  expiresAt: Date
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const exp = Math.floor(expiresAt.getTime() / 1000);

  return new SignJWT({
    resetId: claims.resetId,
    email: claims.email,
    uid: claims.uid,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .setSubject(claims.resetId)
    .setJti(randomUUID())
    .sign(getResetSecret());
}

export async function verifyResetJwt(
  token: string
): Promise<ResetTokenClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getResetSecret(), {
      algorithms: ["HS256"],
    });

    const resetId =
      typeof payload.resetId === "string" ? payload.resetId : null;
    const email = typeof payload.email === "string" ? payload.email : null;
    const uid = typeof payload.uid === "string" ? payload.uid : null;

    if (!resetId || !email || !uid) return null;

    return {
      resetId,
      email: email.toLowerCase(),
      uid,
    };
  } catch {
    return null;
  }
}

export { toDate };
