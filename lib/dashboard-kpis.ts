/**
 * Server-side dashboard KPI aggregation from Firestore.
 * Uses existing collection mappers — does not invent query logic.
 */

import { getAdminDb } from "@/lib/firebase-admin";
import { mapDispatchItem, mapDispatchUpload } from "@/lib/dispatch";
import {
  listActiveRawMaterials,
  mapStockMovement,
} from "@/lib/inventory";
import { mapPODoc } from "@/lib/po-firestore";
import { poGrandTotal } from "@/lib/po-gst";
import {
  listReconciliationReports,
  getReconciliationReport,
} from "@/lib/reconciliation";
import type {
  AccountantDashboardKpis,
  ActivityItem,
  AdminDashboardKpis,
  DashboardPoRow,
  DispatchRow,
  LowStockRow,
  PlantHeadDashboardKpis,
  ProductionHeadDashboardKpis,
  RoleDashboardKpis,
  StoreManagerDashboardKpis,
} from "@/lib/dashboard-types";
import {
  isAwaitingApproval,
  isDraftStatus,
  PO_SUBMITTED_STATUSES,
  type PurchaseOrder,
  type RawMaterial,
  type StockMovement,
  type UserRole,
} from "@/lib/types";

export type {
  AccountantDashboardKpis,
  ActivityItem,
  AdminDashboardKpis,
  DashboardPoRow,
  DispatchRow,
  LowStockRow,
  MovementRow,
  PlantHeadDashboardKpis,
  ProductionHeadDashboardKpis,
  RoleDashboardKpis,
  StoreManagerDashboardKpis,
} from "@/lib/dashboard-types";

export { formatRelativeTime, displayCount } from "@/lib/dashboard-types";

const OPEN_PO_STATUSES = new Set([
  "new",
  "pending",
  "approved",
  "in_production",
]);

function monthBounds(now = new Date()): { start: Date; end: Date } {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { start, end };
}

function inCurrentMonth(iso: string, start: Date, end: Date): boolean {
  if (!iso) return false;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return false;
  return t >= start.getTime() && t < end.getTime();
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function toPoRow(po: PurchaseOrder): DashboardPoRow {
  return {
    id: po.id,
    poNumber: po.po_number || "—",
    customer: po.customer_name || po.customer_code || "—",
    total: poGrandTotal(po),
    status: po.status,
    date: (po.uploaded_at || po.po_date || "").slice(0, 10) || "—",
    uploadedBy: po.uploaded_by,
  };
}

function toLowStockRow(m: RawMaterial): LowStockRow {
  return {
    materialCode: m.materialCode,
    materialName: m.materialName || m.materialCode,
    currentStockKg: m.currentStockKg,
    reorderLevelKg: m.reorderLevelKg,
    deficitKg: Math.max(0, m.reorderLevelKg - m.currentStockKg),
  };
}

function toDispatchRow(
  d: ReturnType<typeof mapDispatchItem>
): DispatchRow {
  return {
    dispatchId: d.dispatchId,
    customer: d.customer,
    itemDescription: d.itemDescription,
    status: d.status,
    actualQuantity: d.actualQuantity,
    plannedQuantity: d.plannedQuantity,
    createdAt: d.createdAt,
  };
}

async function loadPurchaseOrders(): Promise<PurchaseOrder[]> {
  const db = getAdminDb();
  let snap;
  try {
    snap = await db
      .collection("po_uploads")
      .orderBy("uploaded_at", "desc")
      .limit(200)
      .get();
  } catch {
    snap = await db.collection("po_uploads").limit(200).get();
  }
  const orders = snap.docs.map((doc) =>
    mapPODoc(doc.id, doc.data() as Record<string, unknown>)
  );
  return orders.sort((a, b) =>
    String(b.uploaded_at || "").localeCompare(String(a.uploaded_at || ""))
  );
}

async function loadDispatchesForMonth(): Promise<{
  thisMonth: ReturnType<typeof mapDispatchItem>[];
  recent: ReturnType<typeof mapDispatchItem>[];
}> {
  const db = getAdminDb();
  const { start, end } = monthBounds();
  let snap;
  try {
    snap = await db.collection("dispatches").limit(3000).get();
  } catch {
    return { thisMonth: [], recent: [] };
  }

  const all = snap.docs.map((d) =>
    mapDispatchItem(d.id, d.data() as Record<string, unknown>)
  );
  all.sort((a, b) =>
    String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
  );

  const thisMonth = all.filter((d) =>
    inCurrentMonth(d.createdAt, start, end)
  );
  return { thisMonth, recent: all.slice(0, 5) };
}

async function loadRecentStockMovements(
  limit = 20,
  since?: Date
): Promise<StockMovement[]> {
  const db = getAdminDb();
  let snap;
  try {
    snap = await db
      .collection("stock_movements")
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();
  } catch {
    try {
      snap = await db.collection("stock_movements").limit(limit).get();
    } catch {
      return [];
    }
  }

  let movements = snap.docs.map((d) =>
    mapStockMovement(d.id, d.data() as Record<string, unknown>)
  );
  movements.sort((a, b) =>
    String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
  );

  if (since) {
    const ms = since.getTime();
    movements = movements.filter((m) => {
      const t = Date.parse(m.createdAt);
      return !Number.isNaN(t) && t >= ms;
    });
  }

  return movements;
}

async function loadRecentDispatchUploads(limit = 10) {
  const db = getAdminDb();
  let snap;
  try {
    snap = await db
      .collection("dispatch_uploads")
      .orderBy("uploadedAt", "desc")
      .limit(limit)
      .get();
  } catch {
    try {
      snap = await db.collection("dispatch_uploads").limit(limit).get();
    } catch {
      return [];
    }
  }
  return snap.docs.map((d) =>
    mapDispatchUpload(d.id, d.data() as Record<string, unknown>)
  );
}

async function loadLatestInventoryUploadAt(): Promise<string | null> {
  const db = getAdminDb();
  try {
    const snap = await db
      .collection("inventory_uploads")
      .orderBy("uploadedAt", "desc")
      .limit(1)
      .get();
    if (snap.empty) return null;
    const data = snap.docs[0]!.data() as Record<string, unknown>;
    const raw = data.uploadedAt;
    if (!raw) return null;
    if (typeof raw === "string") return raw;
    if (
      typeof raw === "object" &&
      raw !== null &&
      "toDate" in raw &&
      typeof (raw as { toDate: () => Date }).toDate === "function"
    ) {
      return (raw as { toDate: () => Date }).toDate().toISOString();
    }
    return null;
  } catch {
    return null;
  }
}

async function loadReconAlertCount(): Promise<number> {
  try {
    const reports = await listReconciliationReports(1);
    const latest = reports[0];
    if (!latest) return 0;
    const full = await getReconciliationReport(latest.reportId);
    const materials =
      full?.summary?.byMaterial ?? latest.summary?.byMaterial ?? [];
    if (materials.length > 0) {
      return materials.filter((m) => Math.abs(m.variancePercent) > 15).length;
    }
    return latest.alertCount ?? 0;
  } catch {
    return 0;
  }
}

function buildActivityFeed(input: {
  orders: PurchaseOrder[];
  movements: StockMovement[];
  dispatchUploads: Awaited<ReturnType<typeof loadRecentDispatchUploads>>;
}): ActivityItem[] {
  const items: ActivityItem[] = [];

  for (const po of input.orders.slice(0, 20)) {
    if (po.uploaded_at) {
      items.push({
        id: `po-upload-${po.id}`,
        text: `PO ${po.po_number || po.id} uploaded${
          po.uploaded_by ? ` by ${po.uploaded_by}` : ""
        }`,
        timestamp: po.uploaded_at,
      });
    }
    if (
      po.approved_at &&
      (po.status === "approved" || po.status === "in_production")
    ) {
      items.push({
        id: `po-approve-${po.id}`,
        text: `PO ${po.po_number || po.id} approved by ${
          po.approved_by || "Plant Head"
        }`,
        timestamp: po.approved_at,
      });
    }
  }

  for (const m of input.movements.slice(0, 20)) {
    const verb =
      m.type === "issue"
        ? "issued"
        : m.type === "receive"
          ? "received"
          : m.type === "adjustment"
            ? "adjusted"
            : "recorded";
    items.push({
      id: `mov-${m.movementId}`,
      text: `${m.materialName || m.materialCode} ${verb} (${m.quantityKg} kg)${
        m.createdBy ? ` — ${m.createdBy}` : ""
      }`,
      timestamp: m.createdAt,
    });
  }

  for (const u of input.dispatchUploads.slice(0, 10)) {
    items.push({
      id: `du-${u.uploadId}`,
      text: `Dispatch upload ${u.fileName || u.uploadId}${
        u.uploadedBy ? ` by ${u.uploadedBy}` : ""
      }`,
      timestamp: u.uploadedAt,
    });
  }

  return items
    .filter((a) => a.timestamp)
    .sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)))
    .slice(0, 10);
}

export async function loadAdminDashboardKpis(): Promise<AdminDashboardKpis> {
  const empty: AdminDashboardKpis = {
    openPoValue: null,
    pendingApprovals: null,
    totalMaterials: null,
    lowStockAlerts: null,
    dispatchesThisMonth: null,
    dispatchShortfalls: null,
    recentPos: [],
    lowStockItems: [],
    recentActivity: [],
  };

  const [
    ordersResult,
    materialsResult,
    dispatchesResult,
    movementsResult,
    uploadsResult,
  ] = await Promise.allSettled([
    loadPurchaseOrders(),
    listActiveRawMaterials(),
    loadDispatchesForMonth(),
    loadRecentStockMovements(20),
    loadRecentDispatchUploads(10),
  ]);

  const orders =
    ordersResult.status === "fulfilled" ? ordersResult.value : [];
  const materials =
    materialsResult.status === "fulfilled" ? materialsResult.value : [];
  const dispatches =
    dispatchesResult.status === "fulfilled"
      ? dispatchesResult.value
      : { thisMonth: [], recent: [] };
  const movements =
    movementsResult.status === "fulfilled" ? movementsResult.value : [];
  const dispatchUploads =
    uploadsResult.status === "fulfilled" ? uploadsResult.value : [];

  const openOrders = orders.filter((o) => OPEN_PO_STATUSES.has(o.status));
  const lowStock = materials.filter(
    (m) => m.currentStockKg < m.reorderLevelKg
  );

  return {
    ...empty,
    openPoValue:
      ordersResult.status === "fulfilled"
        ? openOrders.reduce((s, o) => s + poGrandTotal(o), 0)
        : null,
    pendingApprovals:
      ordersResult.status === "fulfilled"
        ? orders.filter((o) => isAwaitingApproval(o.status)).length
        : null,
    totalMaterials:
      materialsResult.status === "fulfilled" ? materials.length : null,
    lowStockAlerts:
      materialsResult.status === "fulfilled" ? lowStock.length : null,
    dispatchesThisMonth:
      dispatchesResult.status === "fulfilled"
        ? dispatches.thisMonth.length
        : null,
    dispatchShortfalls:
      dispatchesResult.status === "fulfilled"
        ? dispatches.thisMonth.filter((d) => d.status === "shortfall").length
        : null,
    recentPos: orders.slice(0, 5).map(toPoRow),
    lowStockItems: lowStock
      .sort((a, b) => {
        const da = a.reorderLevelKg - a.currentStockKg;
        const dbDeficit = b.reorderLevelKg - b.currentStockKg;
        return dbDeficit - da;
      })
      .slice(0, 5)
      .map(toLowStockRow),
    recentActivity: buildActivityFeed({
      orders,
      movements,
      dispatchUploads,
    }),
  };
}

export async function loadPlantHeadDashboardKpis(): Promise<PlantHeadDashboardKpis> {
  const [ordersResult, materialsResult, dispatchesResult, reconResult] =
    await Promise.allSettled([
      loadPurchaseOrders(),
      listActiveRawMaterials({ lowStock: true }),
      loadDispatchesForMonth(),
      loadReconAlertCount(),
    ]);

  const orders =
    ordersResult.status === "fulfilled" ? ordersResult.value : [];
  const lowStock =
    materialsResult.status === "fulfilled" ? materialsResult.value : [];
  const dispatches =
    dispatchesResult.status === "fulfilled"
      ? dispatchesResult.value
      : { thisMonth: [], recent: [] };

  return {
    pendingApprovals:
      ordersResult.status === "fulfilled"
        ? orders.filter((o) => isAwaitingApproval(o.status)).length
        : null,
    lowStockAlerts:
      materialsResult.status === "fulfilled" ? lowStock.length : null,
    recentDispatches: dispatches.recent.map(toDispatchRow),
    reconAlerts: reconResult.status === "fulfilled" ? reconResult.value : null,
    recentPos: orders
      .filter((o) => isAwaitingApproval(o.status))
      .slice(0, 5)
      .map(toPoRow),
  };
}

export async function loadAccountantDashboardKpis(opts?: {
  email?: string;
  uid?: string;
}): Promise<AccountantDashboardKpis> {
  let orders: PurchaseOrder[] = [];
  let ok = false;
  try {
    orders = await loadPurchaseOrders();
    ok = true;
  } catch {
    orders = [];
  }

  const email = (opts?.email || "").toLowerCase();
  const uid = (opts?.uid || "").toLowerCase();
  const mine =
    email || uid
      ? orders.filter((o) => {
          const by = (o.uploaded_by || "").toLowerCase();
          return (email && by === email) || (uid && by === uid);
        })
      : orders;

  const since = daysAgo(30).getTime();
  const submitted = mine.filter((o) => {
    if (!(PO_SUBMITTED_STATUSES as string[]).includes(o.status)) return false;
    const t = Date.parse(o.uploaded_at || "");
    if (Number.isNaN(t)) return true;
    return t >= since;
  });

  const openOrders = orders.filter((o) => OPEN_PO_STATUSES.has(o.status));

  return {
    draftPos: ok ? mine.filter((o) => isDraftStatus(o.status)).length : null,
    submittedLast30Days: ok ? submitted.length : null,
    openPoValue: ok
      ? openOrders.reduce((s, o) => s + poGrandTotal(o), 0)
      : null,
    recentPos: orders.slice(0, 5).map(toPoRow),
  };
}

export async function loadStoreManagerDashboardKpis(): Promise<StoreManagerDashboardKpis> {
  const [materialsResult, movementsResult, uploadResult] =
    await Promise.allSettled([
      listActiveRawMaterials(),
      loadRecentStockMovements(50, daysAgo(7)),
      loadLatestInventoryUploadAt(),
    ]);

  const materials =
    materialsResult.status === "fulfilled" ? materialsResult.value : [];
  const lowStock = materials.filter(
    (m) => m.currentStockKg < m.reorderLevelKg
  );
  const movements =
    movementsResult.status === "fulfilled"
      ? movementsResult.value.filter(
          (m) => m.type === "issue" || m.type === "receive"
        )
      : [];

  return {
    totalMaterials:
      materialsResult.status === "fulfilled" ? materials.length : null,
    lowStockAlerts:
      materialsResult.status === "fulfilled" ? lowStock.length : null,
    recentMovements: movements.slice(0, 10).map((m) => ({
      movementId: m.movementId,
      materialName: m.materialName || m.materialCode,
      type: m.type,
      quantityKg: m.quantityKg,
      createdAt: m.createdAt,
      createdBy: m.createdBy,
    })),
    latestInventoryUploadAt:
      uploadResult.status === "fulfilled" ? uploadResult.value : null,
    lowStockItems: lowStock
      .sort(
        (a, b) =>
          b.reorderLevelKg -
          b.currentStockKg -
          (a.reorderLevelKg - a.currentStockKg)
      )
      .slice(0, 5)
      .map(toLowStockRow),
  };
}

export async function loadProductionHeadDashboardKpis(): Promise<ProductionHeadDashboardKpis> {
  const [ordersResult, dispatchesResult, materialsResult] =
    await Promise.allSettled([
      loadPurchaseOrders(),
      loadDispatchesForMonth(),
      listActiveRawMaterials({ lowStock: true }),
    ]);

  const orders =
    ordersResult.status === "fulfilled" ? ordersResult.value : [];
  const dispatches =
    dispatchesResult.status === "fulfilled"
      ? dispatchesResult.value
      : { thisMonth: [], recent: [] };
  const lowStock =
    materialsResult.status === "fulfilled" ? materialsResult.value : [];

  return {
    approvedReady:
      ordersResult.status === "fulfilled"
        ? orders.filter((o) => o.status === "approved").length
        : null,
    recentDispatches: dispatches.recent.map(toDispatchRow),
    materialsRunningLow: lowStock
      .sort(
        (a, b) =>
          b.reorderLevelKg -
          b.currentStockKg -
          (a.reorderLevelKg - a.currentStockKg)
      )
      .slice(0, 5)
      .map(toLowStockRow),
  };
}

export async function loadDashboardKpisForRole(
  role: UserRole,
  opts?: { email?: string; uid?: string }
): Promise<RoleDashboardKpis> {
  switch (role) {
    case "plant_head":
      return {
        role,
        kpis: await loadPlantHeadDashboardKpis(),
      };
    case "accountant":
      return {
        role,
        kpis: await loadAccountantDashboardKpis({
          email: opts?.email,
          uid: opts?.uid,
        }),
      };
    case "store_manager":
      return {
        role,
        kpis: await loadStoreManagerDashboardKpis(),
      };
    case "production_head":
      return {
        role,
        kpis: await loadProductionHeadDashboardKpis(),
      };
    case "admin":
    default:
      return {
        role: "admin",
        kpis: await loadAdminDashboardKpis(),
      };
  }
}
