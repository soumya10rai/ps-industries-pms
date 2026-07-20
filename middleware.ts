import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import {
  SESSION_COOKIE_NAME,
  ROLE_HOME,
  isUserRole,
  type UserRole,
} from "@/lib/types";

const PUBLIC_PATHS = new Set([
  "/auth/login",
  "/auth/register",
  "/login",
  "/register",
]);

const PUBLIC_PREFIXES = ["/api/auth/", "/_next/", "/favicon.ico"];

function getSecret(): Uint8Array | null {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) return null;
  return new TextEncoder().encode(secret);
}

async function readSession(
  request: NextRequest
): Promise<{ uid: string; role: UserRole; email: string } | null> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const secret = getSecret();
  if (!secret) return null;

  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
    });
    const uid = typeof payload.uid === "string" ? payload.uid : null;
    const email = typeof payload.email === "string" ? payload.email : null;
    const role = isUserRole(payload.role) ? payload.role : null;
    if (!uid || !email || !role) return null;
    return { uid, email, role };
  } catch {
    return null;
  }
}

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

function canRoleAccess(role: UserRole, pathname: string): boolean {
  if (role === "admin") {
    return (
      pathname.startsWith("/admin") ||
      pathname.startsWith("/plant-head") ||
      pathname.startsWith("/accountant") ||
      pathname.startsWith("/store") ||
      pathname.startsWith("/production") ||
      pathname === "/"
    );
  }

  const home = ROLE_HOME[role];
  return (
    pathname === home ||
    pathname.startsWith(`${home}/`) ||
    pathname === "/"
  );
}

/**
 * Protects all routes except /login, /register (and /auth/* aliases).
 * Unauthenticated users → /auth/login.
 * Authenticated users hitting login/register → their role home.
 * Wrong-role dashboard access → their own home.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Legacy redirects
  if (pathname === "/login") {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }
  if (pathname === "/register") {
    return NextResponse.redirect(new URL("/auth/register", request.url));
  }

  const session = await readSession(request);
  const publicRoute = isPublic(pathname);

  if (!session) {
    if (publicRoute) {
      return NextResponse.next();
    }
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Signed-in users shouldn't stay on auth pages
  if (
    pathname === "/auth/login" ||
    pathname === "/auth/register" ||
    pathname === "/login" ||
    pathname === "/register"
  ) {
    return NextResponse.redirect(
      new URL(ROLE_HOME[session.role], request.url)
    );
  }

  // Root → role dashboard
  if (pathname === "/") {
    return NextResponse.redirect(
      new URL(ROLE_HOME[session.role], request.url)
    );
  }

  // Role-gated dashboards
  const isDashboard =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/plant-head") ||
    pathname.startsWith("/accountant") ||
    pathname.startsWith("/store") ||
    pathname.startsWith("/production");

  if (isDashboard && !canRoleAccess(session.role, pathname)) {
    return NextResponse.redirect(
      new URL(ROLE_HOME[session.role], request.url)
    );
  }

  const response = NextResponse.next();
  response.headers.set("x-user-role", session.role);
  response.headers.set("x-user-email", session.email);
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all paths except static assets.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
