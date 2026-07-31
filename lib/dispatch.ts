/**
 * Firestore helpers for dispatch uploads and flat dispatch line items.
 */

import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { stripUndefined } from "@/lib/firestore-utils";
import type { ParsedDispatchItem } from "@/lib/dispatch-parser";
import type {
  DispatchItem,
  DispatchLineStatus,
  DispatchUpload,
  DispatchUploadStatus,
} from "@/lib/types";

export function dispatchDb(): Firestore {
  return getAdminDb();
}

function tsToIso(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate: () => Date }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return "";
}

export function mapDispatchItem(
  id: string,
  data: Record<string, unknown>
): DispatchItem {
  return {
    dispatchId: String(data.dispatchId ?? id),
    uploadId: String(data.uploadId ?? ""),
    customer: String(data.customer ?? ""),
    itemCode: String(data.itemCode ?? ""),
    itemDescription: String(data.itemDescription ?? ""),
    plannedQuantity: Number(data.plannedQuantity ?? 0),
    actualQuantity: Number(data.actualQuantity ?? 0),
    variance: Number(data.variance ?? 0),
    variancePercent: Number(data.variancePercent ?? 0),
    status: (data.status as DispatchLineStatus) || "complete",
    plant: String(data.plant ?? ""),
    periodStart: String(data.periodStart ?? ""),
    periodEnd: String(data.periodEnd ?? ""),
    dispatchDate: data.dispatchDate ? String(data.dispatchDate) : undefined,
    createdAt: tsToIso(data.createdAt),
  };
}

export function mapDispatchUpload(
  id: string,
  data: Record<string, unknown>
): DispatchUpload {
  return {
    uploadId: String(data.uploadId ?? id),
    fileName: String(data.fileName ?? ""),
    uploadedBy: String(data.uploadedBy ?? ""),
    uploadedAt: tsToIso(data.uploadedAt),
    periodStart: String(data.periodStart ?? ""),
    periodEnd: String(data.periodEnd ?? ""),
    totalItems: Number(data.totalItems ?? 0),
    isLatest: data.isLatest === true,
    plant: String(data.plant ?? "All"),
    status: (data.status as DispatchUploadStatus) || "complete",
  };
}

export interface ListDispatchesFilters {
  plant?: string;
  customer?: string;
  status?: string;
  uploadId?: string;
  latestOnly?: boolean;
}

/**
 * List dispatch rows. Defaults to the latest upload(s) when uploadId is omitted.
 */
export async function listDispatches(
  filters: ListDispatchesFilters = {}
): Promise<DispatchItem[]> {
  const db = dispatchDb();
  let uploadId = filters.uploadId?.trim() || "";

  if (!uploadId && filters.latestOnly !== false) {
    const latest = await getLatestUploadIds(filters.plant);
    if (latest.length === 0) return [];
    if (latest.length === 1) {
      uploadId = latest[0]!;
    } else {
      // Multiple latest plants — fetch and merge.
      const all: DispatchItem[] = [];
      for (const id of latest) {
        const rows = await listDispatchesForUpload(id, filters);
        all.push(...rows);
      }
      return sortByShortfall(all);
    }
  }

  if (!uploadId) {
    // Explicit history dump — all rows (capped).
    const snap = await db.collection("dispatches").limit(2000).get();
    let rows = snap.docs.map((d) =>
      mapDispatchItem(d.id, d.data() as Record<string, unknown>)
    );
    rows = applyClientFilters(rows, filters);
    return sortByShortfall(rows);
  }

  return listDispatchesForUpload(uploadId, filters);
}

async function listDispatchesForUpload(
  uploadId: string,
  filters: ListDispatchesFilters
): Promise<DispatchItem[]> {
  const db = dispatchDb();
  const snap = await db
    .collection("dispatches")
    .where("uploadId", "==", uploadId)
    .get();

  let rows = snap.docs.map((d) =>
    mapDispatchItem(d.id, d.data() as Record<string, unknown>)
  );
  rows = applyClientFilters(rows, filters);
  return sortByShortfall(rows);
}

function applyClientFilters(
  rows: DispatchItem[],
  filters: ListDispatchesFilters
): DispatchItem[] {
  return rows.filter((r) => {
    if (filters.plant && filters.plant !== "All" && r.plant !== filters.plant) {
      return false;
    }
    if (filters.customer && r.customer !== filters.customer) return false;
    if (filters.status && r.status !== filters.status) return false;
    return true;
  });
}

function sortByShortfall(rows: DispatchItem[]): DispatchItem[] {
  return [...rows].sort((a, b) => {
    // Worst shortfalls first (most negative variance).
    if (a.variance !== b.variance) return a.variance - b.variance;
    return a.itemCode.localeCompare(b.itemCode);
  });
}

async function getLatestUploadIds(plant?: string): Promise<string[]> {
  const db = dispatchDb();
  const snap = await db
    .collection("dispatch_uploads")
    .where("isLatest", "==", true)
    .get();

  const ids: string[] = [];
  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.status && data.status !== "complete") continue;
    const docPlant = String(data.plant ?? "All");
    if (plant && plant !== "All") {
      if (docPlant === plant || docPlant === "All") {
        ids.push(doc.id);
      }
    } else {
      ids.push(doc.id);
    }
  }
  return ids;
}

export async function listDispatchUploads(): Promise<DispatchUpload[]> {
  const db = dispatchDb();
  const snap = await db.collection("dispatch_uploads").limit(200).get();
  const uploads = snap.docs.map((d) =>
    mapDispatchUpload(d.id, d.data() as Record<string, unknown>)
  );
  return uploads.sort((a, b) =>
    (b.uploadedAt || "").localeCompare(a.uploadedAt || "")
  );
}

export async function getDispatchUpload(
  uploadId: string
): Promise<DispatchUpload | null> {
  const db = dispatchDb();
  const doc = await db.collection("dispatch_uploads").doc(uploadId).get();
  if (!doc.exists) return null;
  return mapDispatchUpload(doc.id, doc.data() as Record<string, unknown>);
}

/**
 * Mark previous uploads for the same plant scope as not latest.
 * "All" clears other "All" flags; a single plant clears that plant's latest.
 */
export async function clearPreviousLatest(
  plant: string,
  exceptUploadId: string
): Promise<void> {
  const db = dispatchDb();
  const snap = await db
    .collection("dispatch_uploads")
    .where("isLatest", "==", true)
    .get();

  const batch = db.batch();
  let ops = 0;
  for (const doc of snap.docs) {
    if (doc.id === exceptUploadId) continue;
    const docPlant = String(doc.data().plant ?? "All");
    const overlap =
      plant === "All" ||
      docPlant === "All" ||
      docPlant === plant;
    if (!overlap) continue;
    batch.set(doc.ref, { isLatest: false }, { merge: true });
    ops += 1;
  }
  if (ops > 0) await batch.commit();
}

export async function saveDispatchItems(params: {
  uploadId: string;
  items: ParsedDispatchItem[];
  periodStart: string;
  periodEnd: string;
}): Promise<number> {
  const db = dispatchDb();
  const { uploadId, items, periodStart, periodEnd } = params;

  // Firestore batches max 500 ops — chunk writes.
  const CHUNK = 400;
  let written = 0;

  for (let i = 0; i < items.length; i += CHUNK) {
    const slice = items.slice(i, i + CHUNK);
    const batch = db.batch();
    for (const item of slice) {
      const ref = db.collection("dispatches").doc();
      batch.set(
        ref,
        stripUndefined({
          dispatchId: ref.id,
          uploadId,
          customer: item.customer,
          itemCode: item.itemCode,
          itemDescription: item.itemDescription,
          plannedQuantity: item.plannedQuantity,
          actualQuantity: item.actualQuantity,
          variance: item.variance,
          variancePercent: item.variancePercent,
          status: item.status,
          plant: item.plant,
          periodStart,
          periodEnd,
          createdAt: FieldValue.serverTimestamp(),
        })
      );
      written += 1;
    }
    await batch.commit();
  }

  return written;
}

export async function deleteDispatchUpload(
  uploadId: string
): Promise<{ deletedItems: number }> {
  const db = dispatchDb();
  const itemsSnap = await db
    .collection("dispatches")
    .where("uploadId", "==", uploadId)
    .get();

  const CHUNK = 400;
  const docs = itemsSnap.docs;
  for (let i = 0; i < docs.length; i += CHUNK) {
    const batch = db.batch();
    for (const doc of docs.slice(i, i + CHUNK)) {
      batch.delete(doc.ref);
    }
    await batch.commit();
  }

  await db.collection("dispatch_uploads").doc(uploadId).delete();
  return { deletedItems: docs.length };
}

export interface VarianceReport {
  totalPlanned: number;
  totalDispatched: number;
  totalVariance: number;
  totalVariancePercent: number;
  byPlant: Array<{
    plant: string;
    planned: number;
    dispatched: number;
    variance: number;
  }>;
  byCustomer: Array<{
    customer: string;
    planned: number;
    dispatched: number;
    variance: number;
    shortfallCount: number;
  }>;
  shortfalls: DispatchItem[];
  statusCounts: {
    complete: number;
    on_track: number;
    shortfall: number;
    excess: number;
  };
  items: DispatchItem[];
}

export function buildVarianceReport(items: DispatchItem[]): VarianceReport {
  const totalPlanned = items.reduce((s, i) => s + i.plannedQuantity, 0);
  const totalDispatched = items.reduce((s, i) => s + i.actualQuantity, 0);
  const totalVariance = totalDispatched - totalPlanned;
  const totalVariancePercent =
    totalPlanned === 0
      ? 0
      : Math.round((totalVariance / totalPlanned) * 10000) / 100;

  const plantMap = new Map<
    string,
    { planned: number; dispatched: number; variance: number }
  >();
  const customerMap = new Map<
    string,
    {
      planned: number;
      dispatched: number;
      variance: number;
      shortfallCount: number;
    }
  >();

  const statusCounts = {
    complete: 0,
    on_track: 0,
    shortfall: 0,
    excess: 0,
  };

  for (const item of items) {
    statusCounts[item.status] = (statusCounts[item.status] ?? 0) + 1;

    const p = plantMap.get(item.plant) ?? {
      planned: 0,
      dispatched: 0,
      variance: 0,
    };
    p.planned += item.plannedQuantity;
    p.dispatched += item.actualQuantity;
    p.variance += item.variance;
    plantMap.set(item.plant, p);

    const c = customerMap.get(item.customer) ?? {
      planned: 0,
      dispatched: 0,
      variance: 0,
      shortfallCount: 0,
    };
    c.planned += item.plannedQuantity;
    c.dispatched += item.actualQuantity;
    c.variance += item.variance;
    if (item.status === "shortfall") c.shortfallCount += 1;
    customerMap.set(item.customer, c);
  }

  const shortfalls = [...items]
    .filter((i) => i.variance < 0)
    .sort((a, b) => a.variance - b.variance)
    .slice(0, 10);

  return {
    totalPlanned,
    totalDispatched,
    totalVariance,
    totalVariancePercent,
    byPlant: Array.from(plantMap.entries())
      .map(([plant, v]) => ({ plant, ...v }))
      .sort((a, b) => a.plant.localeCompare(b.plant)),
    byCustomer: Array.from(customerMap.entries())
      .map(([customer, v]) => ({ customer, ...v }))
      .sort((a, b) => a.variance - b.variance),
    shortfalls,
    statusCounts,
    items,
  };
}
