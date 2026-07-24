import { NextRequest, NextResponse } from "next/server";
import {
  getHomeForRole,
  isAuthorized,
  isProtectedDashboard,
  isPublicPath,
} from "@/lib/auth";
import {
  SESSION_COOKIE_NAME,
  clearSessionCookieOptions,
  refreshSessionToken,
  sessionCookieOptions,
  verifySessionToken,
} from "@/lib/session";

/**
 * Security perimeter for PS Industries PMS.
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

  if (pathname === "/login") {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }
  if (pathname === "/register") {
    return NextResponse.redirect(new URL("/auth/register", request.url));
  }

  const rawToken = request.cookies.get(SESSION_COOKIE_NAME)?.value ?? null;
  const session = rawToken ? await verifySessionToken(rawToken) : null;
  const publicRoute = isPublicPath(pathname);

  if (!session) {
    if (publicRoute) {
      if (rawToken) {
        const res = NextResponse.next();
        res.cookies.set(SESSION_COOKIE_NAME, "", clearSessionCookieOptions());
        return res;
      }
      return NextResponse.next();
    }

    // Allow PO API routes to return JSON 401 instead of HTML redirect
    if (pathname.startsWith("/api/po")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    const res = NextResponse.redirect(loginUrl);
    if (rawToken) {
      res.cookies.set(SESSION_COOKIE_NAME, "", clearSessionCookieOptions());
    }
    return res;
  }

  if (
    pathname === "/auth/login" ||
    pathname === "/auth/register" ||
    pathname === "/login" ||
    pathname === "/register"
  ) {
    return NextResponse.redirect(
      new URL(getHomeForRole(session.role), request.url)
    );
  }

  if (pathname === "/") {
    return NextResponse.redirect(
      new URL(getHomeForRole(session.role), request.url)
    );
  }

  if (isProtectedDashboard(pathname) && !isAuthorized(session.role, pathname)) {
    return NextResponse.redirect(
      new URL(getHomeForRole(session.role), request.url)
    );
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-user-uid", session.uid);
  requestHeaders.set("x-user-role", session.role);
  requestHeaders.set("x-user-email", session.email);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  if (rawToken) {
    const refreshed = await refreshSessionToken(rawToken);
    if (refreshed) {
      response.cookies.set(
        SESSION_COOKIE_NAME,
        refreshed.token,
        sessionCookieOptions(refreshed.maxAge)
      );
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
