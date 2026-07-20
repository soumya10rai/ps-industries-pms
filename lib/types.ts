/**
 * Shared types and role/domain constants for PS Industries PMS.
 */

export const USER_ROLES = [
  "admin",
  "plant_head",
  "accountant",
  "store_manager",
  "production_head",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  plant_head: "Plant Head",
  accountant: "Accountant",
  store_manager: "Store Manager",
  production_head: "Production Head",
};

/** Primary dashboard path for each role after login. */
export const ROLE_HOME: Record<UserRole, string> = {
  admin: "/admin",
  plant_head: "/plant-head",
  accountant: "/accountant",
  store_manager: "/store",
  production_head: "/production",
};

/**
 * Routes each role may access.
 * Admin can reach every dashboard; others are scoped to their area.
 */
export const ROLE_ACCESS: Record<UserRole, string[]> = {
  admin: [
    "/admin",
    "/plant-head",
    "/accountant",
    "/store",
    "/production",
  ],
  plant_head: ["/plant-head"],
  accountant: ["/accountant"],
  store_manager: ["/store"],
  production_head: ["/production"],
};

/**
 * Email domains allowed to register.
 * Security boundary: registration rejects anything outside this list.
 */
export const ALLOWED_EMAIL_DOMAINS = [
  "psindustriesindia.in",
  "psindustries.in",
] as const;

export const SESSION_COOKIE_NAME = "ps_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days
export const SESSION_MAX_AGE_REMEMBER_SECONDS = 60 * 60 * 24 * 30; // 30 days

export interface SessionPayload {
  uid: string;
  email: string;
  role: UserRole;
  name?: string;
  /** Issued-at (unix seconds) */
  iat: number;
  /** Expiration (unix seconds) */
  exp: number;
}

export interface UserProfile {
  uid: string;
  email: string;
  /** null until an Admin assigns a role in Firestore or via seed. */
  role: UserRole | null;
  displayName: string;
  createdAt: string;
  updatedAt: string;
  approved: boolean;
}

export function isUserRole(value: unknown): value is UserRole {
  return (
    typeof value === "string" &&
    (USER_ROLES as readonly string[]).includes(value)
  );
}

/**
 * Extract and normalize the domain from an email address.
 * Returns null if the email format is invalid.
 */
export function getEmailDomain(email: string): string | null {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf("@");
  if (at <= 0 || at === trimmed.length - 1) return null;
  return trimmed.slice(at + 1);
}

/**
 * Security boundary: only company-approved domains may register.
 */
export function isAllowedEmailDomain(email: string): boolean {
  const domain = getEmailDomain(email);
  if (!domain) return false;
  return (ALLOWED_EMAIL_DOMAINS as readonly string[]).includes(domain);
}
