import {
  ROLE_ACCESS,
  ROLE_HOME,
  isUserRole,
  type UserRole,
} from "@/lib/types";

export function getRole(raw: unknown): UserRole | null {
  if (isUserRole(raw)) return raw;
  return null;
}

export function isAuthorized(role: UserRole | null, pathname: string): boolean {
  if (!role) return false;

  const allowed = ROLE_ACCESS[role];
  if (!allowed) return false;

  return allowed.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}

export function canAccess(role: UserRole | null, pathname: string): boolean {
  return isAuthorized(role, pathname);
}

export function getHomeForRole(role: UserRole | null): string {
  if (!role) return "/auth/login";
  return ROLE_HOME[role] ?? "/auth/login";
}

export function isPublicPath(pathname: string): boolean {
  const publicExact = [
    "/",
    "/auth/login",
    "/auth/register",
    "/auth/set-password",
    "/auth/forgot-password",
    "/auth/reset-password",
    "/login",
    "/register",
  ];
  if (publicExact.includes(pathname)) return true;
  if (pathname.startsWith("/api/auth/")) return true;
  // One-time seed endpoint (still gated by x-seed-secret in the handler)
  if (pathname === "/api/seed-users") return true;
  return false;
}

/** API paths that should return JSON 401 instead of an HTML login redirect. */
export function isJsonApiPath(pathname: string): boolean {
  return (
    pathname.startsWith("/api/po") ||
    pathname.startsWith("/api/material-calc") ||
    pathname.startsWith("/api/production") ||
    pathname.startsWith("/api/admin") ||
    pathname.startsWith("/api/inventory") ||
    pathname.startsWith("/api/setup")
  );
}

export function isProtectedDashboard(pathname: string): boolean {
  return (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/plant-head") ||
    pathname.startsWith("/accountant") ||
    pathname.startsWith("/store") ||
    pathname.startsWith("/production")
  );
}

export function roleForPath(pathname: string): UserRole | null {
  if (pathname.startsWith("/admin")) return "admin";
  if (pathname.startsWith("/plant-head")) return "plant_head";
  if (pathname.startsWith("/accountant")) return "accountant";
  if (pathname.startsWith("/store")) return "store_manager";
  if (pathname.startsWith("/production")) return "production_head";
  if (pathname.startsWith("/dashboard")) return null;
  return null;
}
