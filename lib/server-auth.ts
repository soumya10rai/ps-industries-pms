import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/session";
import type { AuthUser } from "@/components/AuthNavbar";

/**
 * Server-side session reader for layouts and RSC pages.
 */
export async function getServerSession(): Promise<AuthUser | null> {
  try {
    const token = cookies().get(SESSION_COOKIE_NAME)?.value;
    if (!token) return null;

    const session = await verifySessionToken(token);
    if (!session) return null;
    return {
      uid: session.uid,
      email: session.email,
      role: session.role,
      displayName: session.name ?? "",
    };
  } catch {
    // Missing SESSION_SECRET during build, or invalid cookie
    return null;
  }
}
