import { getAdminDb } from "@/lib/firebase-admin";

/** Hardcoded low-stock threshold for raw materials (kg / units). */
export const LOW_STOCK_THRESHOLD = 5000;

/**
 * Sum total_amount for approved POs in po_uploads.
 */
export async function getOpenPOValue(): Promise<number> {
  const db = getAdminDb();
  const snap = await db
    .collection("po_uploads")
    .where("status", "==", "approved")
    .get();

  let total = 0;
  for (const doc of snap.docs) {
    const amount = Number(doc.data().total_amount ?? 0);
    if (!Number.isNaN(amount)) total += amount;
  }
  return total;
}

/**
 * Count POs awaiting approval in po_uploads (status = "new").
 */
export async function getPendingApprovalsCount(): Promise<number> {
  const db = getAdminDb();
  const snap = await db
    .collection("po_uploads")
    .where("status", "==", "new")
    .get();
  return snap.size;
}

/**
 * Count raw materials where current_qty is below the reorder threshold (5000).
 */
export async function getLowStockCount(): Promise<number> {
  const db = getAdminDb();
  const snap = await db
    .collection("raw_materials")
    .where("current_qty", "<", LOW_STOCK_THRESHOLD)
    .get();
  return snap.size;
}

/**
 * Count production runs currently in progress.
 */
export async function getActiveRunsCount(): Promise<number> {
  const db = getAdminDb();
  const snap = await db
    .collection("production_runs")
    .where("status", "==", "in_progress")
    .get();
  return snap.size;
}

export interface DashboardKPIs {
  openPOValue: number;
  pendingApprovals: number;
  lowStockCount: number;
  activeRunsCount: number;
}

/**
 * Fetch all four dashboard KPI metrics in parallel.
 */
export async function getDashboardKPIs(): Promise<DashboardKPIs> {
  const [openPOValue, pendingApprovals, lowStockCount, activeRunsCount] =
    await Promise.all([
      getOpenPOValue(),
      getPendingApprovalsCount(),
      getLowStockCount(),
      getActiveRunsCount(),
    ]);

  return {
    openPOValue,
    pendingApprovals,
    lowStockCount,
    activeRunsCount,
  };
}
