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
  admin: "/dashboard",
  plant_head: "/plant-head/approvals",
  accountant: "/accountant/po-list",
  store_manager: "/store/inventory",
  production_head: "/production/runs",
};

/**
 * Routes each role may access (middleware security perimeter).
 */
export const ROLE_ACCESS: Record<UserRole, string[]> = {
  admin: [
    "/dashboard",
    "/admin",
    "/accountant",
    "/plant-head",
    "/store",
    "/production",
  ],
  plant_head: ["/dashboard", "/plant-head"],
  accountant: ["/dashboard", "/accountant"],
  store_manager: ["/dashboard", "/store"],
  production_head: ["/dashboard", "/production"],
};

export const ALLOWED_EMAIL_DOMAINS = [
  "psindustriesindia.in",
  "psindustries.in",
] as const;

export const SESSION_COOKIE_NAME = "ps_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24;
export const SESSION_REFRESH_THRESHOLD_SECONDS = 60 * 60 * 6;

export type POStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "in_production"
  | "completed"
  | "material_check";

export interface SessionPayload {
  uid: string;
  email: string;
  role: UserRole;
  name?: string;
  iat: number;
  exp: number;
}

export interface UserProfile {
  uid: string;
  email: string;
  role: UserRole | null;
  displayName: string;
  createdAt: string;
  updatedAt: string;
  approved: boolean;
}

export interface POItem {
  item_code: string;
  description: string;
  part_code: string | null;
  quantity: number;
  uom: string;
  rate: number;
  total: number;
  material_grade: string | null;
  colour: string | null;
}

export interface PurchaseOrder {
  id: string;
  po_number: string;
  po_date: string;
  customer_code: string;
  customer_name: string;
  delivery_date: string | null;
  payment_terms: string;
  items: POItem[];
  total_amount: number;
  gst: string;
  status: POStatus;
  parse_source?: string;
  source_file?: string;
  uploaded_by?: string;
  uploaded_at?: string;
  approved_by?: string;
  approved_at?: string;
  rejection_reason?: string;
}

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  quantity: number;
  uom: string;
  reorder_level: number;
  location: string;
  last_updated: string;
}

export interface ProductionRun {
  id: string;
  run_number: string;
  po_number: string;
  customer: string;
  product: string;
  quantity: number;
  completed: number;
  status: "scheduled" | "running" | "paused" | "completed";
  machine: string;
  started_at: string | null;
  due_date: string;
}

export interface NavItem {
  label: string;
  href: string;
  icon: string;
  roles?: UserRole[];
}

export function isUserRole(value: unknown): value is UserRole {
  return (
    typeof value === "string" &&
    (USER_ROLES as readonly string[]).includes(value)
  );
}

export function getEmailDomain(email: string): string | null {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf("@");
  if (at <= 0 || at === trimmed.length - 1) return null;
  return trimmed.slice(at + 1);
}

export function isAllowedEmailDomain(email: string): boolean {
  const domain = getEmailDomain(email);
  if (!domain) return false;
  return (ALLOWED_EMAIL_DOMAINS as readonly string[]).includes(domain);
}

export function formatINR(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}
