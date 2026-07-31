/**
 * Shared dashboard KPI types + display helpers (safe for client bundles).
 */

export interface DashboardPoRow {
  id: string;
  poNumber: string;
  customer: string;
  total: number;
  status: string;
  date: string;
  uploadedBy?: string;
}

export interface LowStockRow {
  materialCode: string;
  materialName: string;
  currentStockKg: number;
  reorderLevelKg: number;
  deficitKg: number;
}

export interface ActivityItem {
  id: string;
  text: string;
  timestamp: string;
}

export interface MovementRow {
  movementId: string;
  materialName: string;
  type: string;
  quantityKg: number;
  createdAt: string;
  createdBy: string;
}

export interface DispatchRow {
  dispatchId: string;
  customer: string;
  itemDescription: string;
  status: string;
  actualQuantity: number;
  plannedQuantity: number;
  createdAt: string;
}

export interface AdminDashboardKpis {
  openPoValue: number | null;
  pendingApprovals: number | null;
  totalMaterials: number | null;
  lowStockAlerts: number | null;
  dispatchesThisMonth: number | null;
  dispatchShortfalls: number | null;
  recentPos: DashboardPoRow[];
  lowStockItems: LowStockRow[];
  recentActivity: ActivityItem[];
}

export interface PlantHeadDashboardKpis {
  pendingApprovals: number | null;
  lowStockAlerts: number | null;
  recentDispatches: DispatchRow[];
  reconAlerts: number | null;
  recentPos: DashboardPoRow[];
}

export interface AccountantDashboardKpis {
  draftPos: number | null;
  submittedLast30Days: number | null;
  openPoValue: number | null;
  recentPos: DashboardPoRow[];
}

export interface StoreManagerDashboardKpis {
  totalMaterials: number | null;
  lowStockAlerts: number | null;
  recentMovements: MovementRow[];
  latestInventoryUploadAt: string | null;
  lowStockItems: LowStockRow[];
}

export interface ProductionHeadDashboardKpis {
  approvedReady: number | null;
  recentDispatches: DispatchRow[];
  materialsRunningLow: LowStockRow[];
}

export type RoleDashboardKpis =
  | { role: "admin"; kpis: AdminDashboardKpis }
  | { role: "plant_head"; kpis: PlantHeadDashboardKpis }
  | { role: "accountant"; kpis: AccountantDashboardKpis }
  | { role: "store_manager"; kpis: StoreManagerDashboardKpis }
  | { role: "production_head"; kpis: ProductionHeadDashboardKpis };

/** Relative time label for activity feed. */
export function formatRelativeTime(iso: string, now = new Date()): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "—";
  const diffSec = Math.max(0, Math.floor((now.getTime() - t) / 1000));
  if (diffSec < 60) return "just now";
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return iso.slice(0, 10);
}

export function displayCount(n: number | null | undefined): string | number {
  if (n === null || n === undefined) return "—";
  return n;
}
