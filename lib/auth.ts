import {
  ROLE_ACCESS,
  ROLE_HOME,
  isUserRole,
  type UserRole,
} from "@/lib/types";

/**
 * Role-checking utilities for route authorization.
 * Role metadata lives in Firestore at /users/{uid} under the `role` field.
 */

/**
 * Normalize a raw Firestore role value into a known UserRole or null.
 */
export function getRole(raw: unknown): UserRole | null {
  if (isUserRole(raw)) return raw;
  return null;
}

/**
 * Whether the given role is allowed to access a pathname.
 * Matches exact path or nested paths under the role's allowed prefixes.
 */
export function isAuthorized(role: UserRole | null, pathname: string): boolean {
  if (!role) return false;

  const allowed = ROLE_ACCESS[role];
  if (!allowed) return false;

  return allowed.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}

/**
 * Convenience: can this role open this path?
 * Alias kept for readability at call sites.
 */
export function canAccess(role: UserRole | null, pathname: string): boolean {
  return isAuthorized(role, pathname);
}

/**
 * Dashboard path to send the user to after a successful login.
 */
export function getHomeForRole(role: UserRole | null): string {
  if (!role) return "/auth/login";
  return ROLE_HOME[role] ?? "/auth/login";
}

/**
 * Public paths that never require a session.
 * /login and /register redirect to /auth/* aliases in middleware.
 */
export function isPublicPath(pathname: string): boolean {
  const publicExact = [
    "/",
    "/auth/login",
    "/auth/register",
    "/login",
    "/register",
  ];
  if (publicExact.includes(pathname)) return true;
  if (pathname.startsWith("/api/auth/")) return true;
  return false;
}

/**
 * Whether the pathname is a role-gated dashboard (or nested under one).
 */
export function isProtectedDashboard(pathname: string): boolean {
  return (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/plant-head") ||
    pathname.startsWith("/accountant") ||
    pathname.startsWith("/store") ||
    pathname.startsWith("/production")
  );
}

/**
 * Map a dashboard path segment to the primary owner role.
 */
export function roleForPath(pathname: string): UserRole | null {
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return "admin";
  if (pathname === "/plant-head" || pathname.startsWith("/plant-head/"))
    return "plant_head";
  if (pathname === "/accountant" || pathname.startsWith("/accountant/"))
    return "accountant";
  if (pathname === "/store" || pathname.startsWith("/store/"))
    return "store_manager";
  if (pathname === "/production" || pathname.startsWith("/production/"))
    return "production_head";
  return null;
}
