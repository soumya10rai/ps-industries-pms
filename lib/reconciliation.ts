/**
 * Material reconciliation: expected consumption (from dispatches × parts)
 * vs actual consumption (from stock movement ledger).
 *
 * Deterministic math only — no LLM.
 */

import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { stripUndefined } from "@/lib/firestore-utils";
import { mapDispatchItem } from "@/lib/dispatch";
import { mapRawMaterial, mapStockMovement } from "@/lib/inventory";
import { calcUsableWeightKg } from "@/lib/material-calc";
import type {
  DispatchContribution,
  DispatchItem,
  GroupVariance,
  MaterialVariance,
  MovementContribution,
  PartMaster,
  ReconciliationMode,
  ReconciliationReport,
  ReconciliationStatus,
  StockMovement,
  UnmappedDispatchItem,
} from "@/lib/types";

/** Industry standard scrap for injection moulding when part master omits it. */
export const DEFAULT_SCRAP_PERCENT = 3;

const HEALTHY_THRESHOLD = 5;
const ATTENTION_THRESHOLD = 15;

export function reconciliationDb(): Firestore {
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

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function varianceStatus(
  variancePercent: number,
  opts?: { unaccounted?: boolean }
): ReconciliationStatus {
  if (opts?.unaccounted) return "alert";
  const abs = Math.abs(variancePercent);
  if (abs < HEALTHY_THRESHOLD) return "healthy";
  if (abs < ATTENTION_THRESHOLD) return "attention";
  return "alert";
}

function groupFromCode(code: string, fallback = ""): string {
  if (fallback.trim()) return fallback.trim().toUpperCase();
  const upper = code.toUpperCase();
  const prefixes = [
    "ABS",
    "PP",
    "HIPS",
    "GPPS",
    "DELRIN",
    "PC",
    "NYLON",
    "POM",
    "EVA",
    "MB",
  ];
  for (const p of prefixes) {
    if (upper.startsWith(p) || upper.includes(`_${p}_`) || upper.includes(`${p}_`)) {
      return p;
    }
  }
  const first = upper.split(/[_\s-]/)[0];
  return first || "OTHER";
}

function periodOverlaps(
  itemStart: string,
  itemEnd: string,
  rangeStart: string,
  rangeEnd: string
): boolean {
  const a = (itemStart || "").slice(0, 10);
  const b = (itemEnd || "").slice(0, 10);
  const s = rangeStart.slice(0, 10);
  const e = rangeEnd.slice(0, 10);
  if (!a && !b) return true;
  const start = a || b;
  const end = b || a;
  return start <= e && end >= s;
}

function inDateRange(iso: string, rangeStart: string, rangeEnd: string): boolean {
  if (!iso) return false;
  const d = iso.slice(0, 10);
  return d >= rangeStart.slice(0, 10) && d <= rangeEnd.slice(0, 10);
}

/**
 * Consumption kg from a stock movement.
 * Issues are stored as negative qty; adjustments count only when stock decreased.
 */
export function consumptionKgFromMovement(m: StockMovement): number {
  if (m.type === "issue") {
    return Math.abs(m.quantityKg);
  }
  if (m.type === "adjustment" && m.quantityKg < 0) {
    return Math.abs(m.quantityKg);
  }
  return 0;
}

function buildExplanation(m: MaterialVariance): string {
  const dispatchPcs = m.dispatches.reduce((s, d) => s + d.quantity, 0);
  const sample = m.dispatches[0];
  const scrapNote = sample
    ? ` @ ${sample.weightGrams}g/pc + ${sample.scrapPercent}% scrap`
    : "";

  if (m.expectedKg <= 0 && m.actualKg > 0) {
    return `No expected consumption from dispatches, but ${m.actualKg} kg issued across ${m.movements.length} stock movement(s). Flagged as unaccounted.`;
  }

  if (m.actualKg <= 0 && m.expectedKg > 0) {
    return `Expected ${m.expectedKg} kg from ${dispatchPcs.toLocaleString("en-IN")} pcs${scrapNote}, but no stock issues in period. Variance ${m.variancePercent}%.`;
  }

  const direction =
    m.varianceKg > 0
      ? "suggests loss/waste/theft"
      : m.varianceKg < 0
        ? "suggests over-reported dispatches or scrap% too high"
        : "is healthy";

  return `Expected ${m.expectedKg} kg because ${dispatchPcs.toLocaleString("en-IN")} pcs${sample ? ` of ${sample.itemCode}` : ""}${scrapNote}. Actual issued ${m.actualKg} kg per ${m.movements.length} stock movement(s). Variance ${m.varianceKg >= 0 ? "+" : ""}${m.varianceKg} kg ${direction}.`;
}

export interface GenerateReconciliationInput {
  periodStart: string;
  periodEnd: string;
  plant: string;
  mode?: ReconciliationMode;
  generatedBy: string;
  generatedByName?: string;
  /** Force fresh calc even if a cached report exists for the same period. */
  regenerate?: boolean;
}

/**
 * Find a recently cached report for the same period/plant/mode.
 */
export async function findCachedReport(
  periodStart: string,
  periodEnd: string,
  plant: string,
  mode: ReconciliationMode = "auto"
): Promise<ReconciliationReport | null> {
  const db = reconciliationDb();
  const snap = await db
    .collection("reconciliation_reports")
    .where("periodStart", "==", periodStart.slice(0, 10))
    .where("periodEnd", "==", periodEnd.slice(0, 10))
    .limit(20)
    .get();

  const matches = snap.docs
    .map((d) => mapReconciliationReport(d.id, d.data() as Record<string, unknown>))
    .filter(
      (r) =>
        (r.plant || "All") === (plant || "All") &&
        (r.mode || "auto") === mode
    )
    .sort((a, b) =>
      String(b.generatedAt).localeCompare(String(a.generatedAt))
    );

  return matches[0] ?? null;
}

export async function getReconciliationReport(
  reportId: string
): Promise<ReconciliationReport | null> {
  const doc = await reconciliationDb()
    .collection("reconciliation_reports")
    .doc(reportId)
    .get();
  if (!doc.exists) return null;
  return mapReconciliationReport(
    doc.id,
    doc.data() as Record<string, unknown>
  );
}

export async function listReconciliationReports(
  limit = 50
): Promise<ReconciliationReport[]> {
  const db = reconciliationDb();
  let snap;
  try {
    snap = await db
      .collection("reconciliation_reports")
      .orderBy("generatedAt", "desc")
      .limit(limit)
      .get();
  } catch {
    snap = await db.collection("reconciliation_reports").limit(limit).get();
  }

  const reports = snap.docs.map((d) =>
    mapReconciliationReport(d.id, d.data() as Record<string, unknown>)
  );
  return reports.sort((a, b) =>
    String(b.generatedAt).localeCompare(String(a.generatedAt))
  );
}

export async function deleteReconciliationReport(
  reportId: string
): Promise<boolean> {
  const ref = reconciliationDb()
    .collection("reconciliation_reports")
    .doc(reportId);
  const doc = await ref.get();
  if (!doc.exists) return false;
  await ref.delete();
  return true;
}

export function mapReconciliationReport(
  id: string,
  data: Record<string, unknown>
): ReconciliationReport {
  const summary = (data.summary ?? {}) as Record<string, unknown>;
  return {
    reportId: String(data.reportId ?? id),
    periodStart: String(data.periodStart ?? ""),
    periodEnd: String(data.periodEnd ?? ""),
    plant: String(data.plant ?? "All"),
    mode: data.mode === "manual" ? "manual" : "auto",
    generatedBy: String(data.generatedBy ?? ""),
    generatedByName: data.generatedByName
      ? String(data.generatedByName)
      : undefined,
    generatedAt: tsToIso(data.generatedAt),
    totalExpectedKg: Number(data.totalExpectedKg ?? 0),
    totalActualKg: Number(data.totalActualKg ?? 0),
    totalVarianceKg: Number(data.totalVarianceKg ?? 0),
    totalVariancePercent: Number(data.totalVariancePercent ?? 0),
    materialsAnalyzed: Number(data.materialsAnalyzed ?? 0),
    alertCount: Number(data.alertCount ?? 0),
    attentionCount: Number(data.attentionCount ?? 0),
    healthyCount: Number(data.healthyCount ?? 0),
    unmappedCount: Number(data.unmappedCount ?? 0),
    warnings: Array.isArray(data.warnings)
      ? data.warnings.map(String)
      : [],
    summary: {
      byMaterial: Array.isArray(summary.byMaterial)
        ? (summary.byMaterial as MaterialVariance[])
        : [],
      byMaterialGroup: Array.isArray(summary.byMaterialGroup)
        ? (summary.byMaterialGroup as GroupVariance[])
        : [],
      topLosses: Array.isArray(summary.topLosses)
        ? (summary.topLosses as MaterialVariance[])
        : [],
      unmappedItems: Array.isArray(summary.unmappedItems)
        ? (summary.unmappedItems as UnmappedDispatchItem[])
        : [],
    },
  };
}

async function loadPartsMap(): Promise<{
  parts: Map<string, PartMaster & { scrapDefaulted: boolean }>;
  warnings: string[];
}> {
  const snap = await reconciliationDb().collection("parts").get();
  const parts = new Map<string, PartMaster & { scrapDefaulted: boolean }>();
  const warnings: string[] = [];

  for (const doc of snap.docs) {
    const data = doc.data() as Record<string, unknown>;
    if (data.isActive === false) continue;

    const itemCode = String(data.itemCode ?? doc.id).toUpperCase();
    const hasScrap =
      data.scrapPercent !== undefined &&
      data.scrapPercent !== null &&
      data.scrapPercent !== "";
    const scrapDefaulted = !hasScrap;
    const scrapPercent = scrapDefaulted
      ? DEFAULT_SCRAP_PERCENT
      : Number(data.scrapPercent);

    if (scrapDefaulted) {
      warnings.push(
        `Part ${itemCode}: scrap% missing — defaulted to ${DEFAULT_SCRAP_PERCENT}%.`
      );
    }

    parts.set(itemCode, {
      itemCode,
      description: String(data.description ?? ""),
      customerCode: String(data.customerCode ?? "").toUpperCase(),
      customerName: String(data.customerName ?? ""),
      weightGrams: Number(data.weightGrams ?? 0),
      materialCode: String(data.materialCode ?? "").toUpperCase(),
      scrapPercent: Number.isFinite(scrapPercent)
        ? scrapPercent
        : DEFAULT_SCRAP_PERCENT,
      defaultHsnCode: String(data.defaultHsnCode ?? ""),
      isActive: true,
      scrapDefaulted,
    });
  }

  return { parts, warnings };
}

async function loadDispatchesInPeriod(
  periodStart: string,
  periodEnd: string,
  plant: string
): Promise<DispatchItem[]> {
  const db = reconciliationDb();
  const snap = await db.collection("dispatches").limit(5000).get();
  const rows = snap.docs.map((d) =>
    mapDispatchItem(d.id, d.data() as Record<string, unknown>)
  );

  return rows.filter((r) => {
    if (plant && plant !== "All" && r.plant !== plant) return false;
    if (r.dispatchDate) {
      return inDateRange(r.dispatchDate, periodStart, periodEnd);
    }
    return periodOverlaps(
      r.periodStart,
      r.periodEnd,
      periodStart,
      periodEnd
    );
  });
}

async function loadMovementsInPeriod(
  periodStart: string,
  periodEnd: string,
  plant: string
): Promise<StockMovement[]> {
  const db = reconciliationDb();
  let snap;
  try {
    snap = await db
      .collection("stock_movements")
      .where("type", "in", ["issue", "adjustment"])
      .limit(5000)
      .get();
  } catch {
    snap = await db.collection("stock_movements").limit(5000).get();
  }

  const startIso = `${periodStart.slice(0, 10)}T00:00:00.000Z`;
  const endIso = `${periodEnd.slice(0, 10)}T23:59:59.999Z`;

  return snap.docs
    .map((d) => mapStockMovement(d.id, d.data() as Record<string, unknown>))
    .filter((m) => {
      if (m.type !== "issue" && m.type !== "adjustment") return false;
      if (consumptionKgFromMovement(m) <= 0) return false;
      if (plant && plant !== "All" && m.plant && m.plant !== plant) {
        return false;
      }
      const created = m.createdAt || "";
      if (!created) return false;
      return created >= startIso.slice(0, 10) && created <= endIso;
    });
}

async function loadMaterialMeta(): Promise<
  Map<string, { materialName: string; materialGroup: string }>
> {
  const snap = await reconciliationDb().collection("raw_materials").get();
  const map = new Map<string, { materialName: string; materialGroup: string }>();
  for (const doc of snap.docs) {
    const m = mapRawMaterial(doc.id, doc.data() as Record<string, unknown>);
    map.set(m.materialCode, {
      materialName: m.materialName,
      materialGroup: m.materialGroup || groupFromCode(m.materialCode),
    });
  }
  return map;
}

/**
 * Compute and cache a reconciliation report for any date range.
 */
export async function generateReconciliationReport(
  input: GenerateReconciliationInput
): Promise<{ report: ReconciliationReport; cached: boolean }> {
  const periodStart = input.periodStart.slice(0, 10);
  const periodEnd = input.periodEnd.slice(0, 10);
  const plant = input.plant?.trim() || "All";
  const mode: ReconciliationMode = input.mode === "manual" ? "manual" : "auto";

  if (!periodStart || !periodEnd) {
    throw new Error("periodStart and periodEnd are required (YYYY-MM-DD).");
  }
  if (periodStart > periodEnd) {
    throw new Error("periodStart must be on or before periodEnd.");
  }
  if (mode === "manual") {
    throw new Error(
      "Manual consumption upload is coming soon. Use mode: \"auto\"."
    );
  }

  if (!input.regenerate) {
    const cached = await findCachedReport(periodStart, periodEnd, plant, mode);
    if (cached) return { report: cached, cached: true };
  }

  const warnings: string[] = [];
  const { parts, warnings: partWarnings } = await loadPartsMap();
  warnings.push(...partWarnings);

  const [dispatches, movements, materialMeta] = await Promise.all([
    loadDispatchesInPeriod(periodStart, periodEnd, plant),
    loadMovementsInPeriod(periodStart, periodEnd, plant),
    loadMaterialMeta(),
  ]);

  const expectedByMaterial = new Map<
    string,
    {
      expectedKg: number;
      dispatches: DispatchContribution[];
      materialName: string;
      materialGroup: string;
    }
  >();
  const unmappedItems: UnmappedDispatchItem[] = [];

  for (const d of dispatches) {
    const code = d.itemCode.trim().toUpperCase();
    const part = parts.get(code);

    if (!part) {
      unmappedItems.push({
        dispatchId: d.dispatchId,
        itemCode: d.itemCode,
        itemDescription: d.itemDescription,
        quantity: d.actualQuantity,
        plant: d.plant,
        reason: "Part not found in parts master",
      });
      continue;
    }

    if (!part.weightGrams || part.weightGrams <= 0) {
      unmappedItems.push({
        dispatchId: d.dispatchId,
        itemCode: d.itemCode,
        itemDescription: d.itemDescription,
        quantity: d.actualQuantity,
        plant: d.plant,
        reason: "Part missing weight_grams",
      });
      warnings.push(
        `Part ${code}: missing weight — skipped from expected consumption.`
      );
      continue;
    }

    if (!part.materialCode) {
      unmappedItems.push({
        dispatchId: d.dispatchId,
        itemCode: d.itemCode,
        itemDescription: d.itemDescription,
        quantity: d.actualQuantity,
        plant: d.plant,
        reason: "Part missing material_code",
      });
      continue;
    }

    const expectedKg = calcUsableWeightKg(
      d.actualQuantity,
      part.weightGrams,
      part.scrapPercent
    );

    const meta = materialMeta.get(part.materialCode);
    const bucket = expectedByMaterial.get(part.materialCode) ?? {
      expectedKg: 0,
      dispatches: [],
      materialName: meta?.materialName || part.materialCode,
      materialGroup:
        meta?.materialGroup || groupFromCode(part.materialCode),
    };
    bucket.expectedKg = round1(bucket.expectedKg + expectedKg);
    bucket.dispatches.push({
      dispatchId: d.dispatchId,
      itemCode: d.itemCode,
      itemDescription: d.itemDescription,
      quantity: d.actualQuantity,
      weightGrams: part.weightGrams,
      scrapPercent: part.scrapPercent,
      expectedKg,
      plant: d.plant,
    });
    expectedByMaterial.set(part.materialCode, bucket);
  }

  const actualByMaterial = new Map<
    string,
    { actualKg: number; movements: MovementContribution[]; materialName: string }
  >();

  for (const m of movements) {
    const kg = consumptionKgFromMovement(m);
    if (kg <= 0) continue;
    const code = m.materialCode.toUpperCase();
    const bucket = actualByMaterial.get(code) ?? {
      actualKg: 0,
      movements: [],
      materialName: m.materialName || code,
    };
    bucket.actualKg = round1(bucket.actualKg + kg);
    bucket.movements.push({
      movementId: m.movementId,
      date: m.createdAt,
      quantityKg: kg,
      type: m.type,
      reason: m.reason,
      referenceId: m.referenceId,
      plant: m.plant,
    });
    if (!bucket.materialName && m.materialName) {
      bucket.materialName = m.materialName;
    }
    actualByMaterial.set(code, bucket);
  }

  const allCodes = new Set([
    ...Array.from(expectedByMaterial.keys()),
    ...Array.from(actualByMaterial.keys()),
  ]);

  const byMaterial: MaterialVariance[] = [];

  for (const code of Array.from(allCodes)) {
    const exp = expectedByMaterial.get(code);
    const act = actualByMaterial.get(code);
    const expectedKg = exp?.expectedKg ?? 0;
    const actualKg = act?.actualKg ?? 0;
    const varianceKg = round1(actualKg - expectedKg);
    const unaccounted = expectedKg <= 0 && actualKg > 0;

    let variancePercent = 0;
    if (expectedKg > 0) {
      variancePercent = round2((varianceKg / expectedKg) * 100);
    } else if (unaccounted) {
      variancePercent = 100;
    }

    const meta = materialMeta.get(code);
    const materialName =
      exp?.materialName || act?.materialName || meta?.materialName || code;
    const materialGroup =
      exp?.materialGroup ||
      meta?.materialGroup ||
      groupFromCode(code);

    const row: MaterialVariance = {
      materialCode: code,
      materialName,
      materialGroup,
      expectedKg,
      actualKg,
      varianceKg,
      variancePercent,
      status: varianceStatus(variancePercent, { unaccounted }),
      dispatches: exp?.dispatches ?? [],
      movements: act?.movements ?? [],
      explanation: "",
    };
    row.explanation = buildExplanation(row);
    byMaterial.push(row);
  }

  byMaterial.sort(
    (a, b) => Math.abs(b.varianceKg) - Math.abs(a.varianceKg)
  );

  const groupMap = new Map<
    string,
    { expectedKg: number; actualKg: number; materialCount: number }
  >();
  for (const m of byMaterial) {
    const g = groupMap.get(m.materialGroup) ?? {
      expectedKg: 0,
      actualKg: 0,
      materialCount: 0,
    };
    g.expectedKg = round1(g.expectedKg + m.expectedKg);
    g.actualKg = round1(g.actualKg + m.actualKg);
    g.materialCount += 1;
    groupMap.set(m.materialGroup, g);
  }

  const byMaterialGroup: GroupVariance[] = Array.from(groupMap.entries())
    .map(([materialGroup, g]) => {
      const varianceKg = round1(g.actualKg - g.expectedKg);
      const variancePercent =
        g.expectedKg > 0
          ? round2((varianceKg / g.expectedKg) * 100)
          : g.actualKg > 0
            ? 100
            : 0;
      return {
        materialGroup,
        expectedKg: g.expectedKg,
        actualKg: g.actualKg,
        varianceKg,
        variancePercent,
        status: varianceStatus(variancePercent, {
          unaccounted: g.expectedKg <= 0 && g.actualKg > 0,
        }),
        materialCount: g.materialCount,
      };
    })
    .sort((a, b) => a.materialGroup.localeCompare(b.materialGroup));

  const topLosses = [...byMaterial]
    .filter((m) => m.varianceKg > 0)
    .sort((a, b) => b.varianceKg - a.varianceKg)
    .slice(0, 5);

  const totalExpectedKg = round1(
    byMaterial.reduce((s, m) => s + m.expectedKg, 0)
  );
  const totalActualKg = round1(
    byMaterial.reduce((s, m) => s + m.actualKg, 0)
  );
  const totalVarianceKg = round1(totalActualKg - totalExpectedKg);
  const totalVariancePercent =
    totalExpectedKg > 0
      ? round2((totalVarianceKg / totalExpectedKg) * 100)
      : totalActualKg > 0
        ? 100
        : 0;

  let alertCount = 0;
  let attentionCount = 0;
  let healthyCount = 0;
  for (const m of byMaterial) {
    if (m.status === "alert") alertCount += 1;
    else if (m.status === "attention") attentionCount += 1;
    else if (m.status === "healthy") healthyCount += 1;
  }

  const db = reconciliationDb();
  const ref = db.collection("reconciliation_reports").doc();
  const report: ReconciliationReport = {
    reportId: ref.id,
    periodStart,
    periodEnd,
    plant,
    mode,
    generatedBy: input.generatedBy,
    generatedByName: input.generatedByName,
    generatedAt: new Date().toISOString(),
    totalExpectedKg,
    totalActualKg,
    totalVarianceKg,
    totalVariancePercent,
    materialsAnalyzed: byMaterial.length,
    alertCount,
    attentionCount,
    healthyCount,
    unmappedCount: unmappedItems.length,
    warnings: warnings.slice(0, 100),
    summary: {
      byMaterial,
      byMaterialGroup,
      topLosses,
      unmappedItems,
    },
  };

  await ref.set(
    stripUndefined({
      ...report,
      generatedAt: FieldValue.serverTimestamp(),
    })
  );

  return { report, cached: false };
}
