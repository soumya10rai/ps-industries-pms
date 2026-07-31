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
  plant_head: ["/dashboard", "/plant-head", "/store"],
  accountant: ["/dashboard", "/accountant"],
  store_manager: ["/dashboard", "/store"],
  production_head: ["/dashboard", "/production"],
};

export const ALLOWED_EMAIL_DOMAINS = [
  "ps.com",
  "psindustriesindia.in",
  "psindustries.in",
] as const;

export const SESSION_COOKIE_NAME = "ps_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24;
export const SESSION_REFRESH_THRESHOLD_SECONDS = 60 * 60 * 6;

export type POStatus =
  | "new"
  | "pending"
  | "approved"
  | "rejected"
  | "in_production"
  | "completed"
  | "material_check";

/** Statuses that await Plant Head action. */
export function isAwaitingApproval(status: string | undefined): boolean {
  return status === "new" || status === "pending";
}

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

export const INVENTORY_PLANTS = [
  "Noida A-06",
  "Noida A-07",
  "Roorkee",
] as const;

export type InventoryPlant = (typeof INVENTORY_PLANTS)[number];

export const DEFAULT_REORDER_LEVEL_KG = 100;

export type MaterialType = "raw_material" | "masterbatch";

export const MATERIAL_TYPE_LABELS: Record<MaterialType, string> = {
  raw_material: "Raw Material",
  masterbatch: "Masterbatch",
};

export type StockMovementType =
  | "receive"
  | "issue"
  | "adjustment"
  | "opening_balance";

export type InventoryUploadStatus = "processing" | "complete" | "failed";

export interface RawMaterial {
  materialCode: string;
  materialName: string;
  /** ABS, PP, HIPS, GPPS, DELRIN, MB … — used for filtering. */
  materialGroup: string;
  materialType: MaterialType;
  currentStockKg: number;
  reorderLevelKg: number;
  unit: string;
  location: string;
  ratePerKg: number;
  /** Supplier — masterbatch sheets carry a PARTY NAME column. */
  partyName?: string;
  lastUpdatedAt: string;
  lastUpdatedBy: string;
  isActive: boolean;
}

export interface StockMovement {
  movementId: string;
  materialCode: string;
  materialName: string;
  type: StockMovementType;
  quantityKg: number;
  balanceAfterKg: number;
  reason: string;
  referenceId?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
  plant: string;
}

export interface InventoryUpload {
  uploadId: string;
  fileName: string;
  uploadedBy: string;
  uploadedAt: string;
  totalItems: number;
  itemsAdded: number;
  itemsUpdated: number;
  isLatest: boolean;
  plant: string;
  status: InventoryUploadStatus;
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
  /** Unbuilt module — shown grayed out, not navigable. */
  comingSoon?: boolean;
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
