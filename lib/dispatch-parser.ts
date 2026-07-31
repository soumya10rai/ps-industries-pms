/**
 * Parse PS Industries Schedule vs Despatch Excel workbooks.
 *
 * Typical layout (one sheet, all plants stacked):
 *   row 1  — customer title (e.g. "KENT RO SYSTEMS LTD")
 *   row 3  — headers: PART NAME | Item Code | Plan | Dispatch Plan till Date |
 *            Dispatch Actual till Date | …
 *   row 4  — plant band "ROORKEE" (then item rows)
 *   later  — "NOIDA A-06" / "NOIDA A-07" bands with more item rows
 *
 * Planned qty = Plan column (schedule). Actual qty = Dispatch Actual till Date.
 */

import * as XLSX from "xlsx";
import type { DispatchLineStatus } from "@/lib/types";

export interface ParsedDispatchItem {
  customer: string;
  itemCode: string;
  itemDescription: string;
  plannedQuantity: number;
  actualQuantity: number;
  variance: number;
  variancePercent: number;
  status: DispatchLineStatus;
  plant: string;
  productFamily?: string;
  rowNumber: number;
  sheetName: string;
}

export interface DispatchParseSummary {
  total: number;
  plants: string[];
  customers: string[];
  shortfallCount: number;
  excessCount: number;
  onTrackCount: number;
  completeCount: number;
}

export interface DispatchParseResult {
  dispatches: ParsedDispatchItem[];
  summary: DispatchParseSummary;
  warnings: string[];
  /** Period guessed from filename / sheet name (YYYY-MM-DD). */
  inferredPeriod: { periodStart: string; periodEnd: string } | null;
}

export interface ParseDispatchOptions {
  /** Keep only rows for this plant. "All" or omit = keep every plant. */
  plant?: string;
  fileName?: string;
}

const PLANT_ALIASES: Array<{ pattern: RegExp; plant: string }> = [
  { pattern: /^ROORKEE$/i, plant: "Roorkee" },
  { pattern: /^NOIDA\s*A-?0?6$/i, plant: "Noida A-06" },
  { pattern: /^NOIDA\s*A-?0?7$/i, plant: "Noida A-07" },
];

const MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

function normalizeHeader(value: unknown): string {
  if (value instanceof Date) return "";
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_/.\-\r\n]+/g, " ")
    .trim();
}

function toNumber(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const cleaned = String(value).replace(/,/g, "").trim();
  if (!cleaned) return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return "";
  return String(value).replace(/\s+/g, " ").trim();
}

function matchPlant(raw: string): string | null {
  const cleaned = raw.replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  for (const { pattern, plant } of PLANT_ALIASES) {
    if (pattern.test(cleaned)) return plant;
  }
  return null;
}

function looksLikeHeaderRow(row: unknown[]): boolean {
  const joined = row.map((c) => normalizeHeader(c)).join(" | ");
  return (
    joined.includes("item code") &&
    (joined.includes("plan") || joined.includes("dispatch"))
  );
}

function findPlanActualColumns(headerRow: unknown[]): {
  plan: number;
  actual: number;
  itemCode: number;
  partName: number;
} {
  const headers = headerRow.map((c) => normalizeHeader(c));
  let plan = -1;
  let actual = -1;
  let itemCode = -1;
  let partName = -1;

  for (let i = 0; i < headers.length; i++) {
    const h = headers[i] ?? "";
    if (!h) continue;
    if (itemCode < 0 && (h === "item code" || h === "itemcode")) itemCode = i;
    if (partName < 0 && (h === "part name" || h.includes("part name"))) {
      partName = i;
    }
    if (h === "plan") plan = i;
    if (
      h.includes("dispatch actual") ||
      h === "despatch" ||
      h === "dispatch" ||
      (h.includes("actual") && h.includes("till"))
    ) {
      actual = i;
    }
  }

  // Fallback to known Schedule vs Despatch layout.
  if (itemCode < 0) itemCode = 2;
  if (partName < 0) partName = 1;
  if (plan < 0) plan = 3;
  if (actual < 0) actual = 5;

  return { plan, actual, itemCode, partName };
}

/**
 * Variance status rules:
 * - complete: variance === 0
 * - shortfall: variance < 0
 * - on_track: small excess (< 5% of planned)
 * - excess: excess ≥ 5% of planned (or any excess when planned is 0)
 */
export function computeDispatchStatus(
  plannedQuantity: number,
  actualQuantity: number
): {
  variance: number;
  variancePercent: number;
  status: DispatchLineStatus;
} {
  const planned = Number(plannedQuantity) || 0;
  const actual = Number(actualQuantity) || 0;
  const variance = actual - planned;
  const variancePercent =
    planned === 0
      ? variance === 0
        ? 0
        : variance > 0
          ? 100
          : -100
      : (variance / planned) * 100;

  let status: DispatchLineStatus;
  if (variance === 0) {
    status = "complete";
  } else if (variance < 0) {
    status = "shortfall";
  } else if (planned > 0 && variance < planned * 0.05) {
    status = "on_track";
  } else {
    status = "excess";
  }

  return {
    variance,
    variancePercent: Math.round(variancePercent * 100) / 100,
    status,
  };
}

function titleCaseCustomer(raw: string): string {
  const cleaned = raw
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\bLTD\.?\b/gi, "")
    .replace(/\bLIMITED\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "Unknown Customer";
  return cleaned
    .toLowerCase()
    .split(" ")
    .map((w) => {
      if (w === "ro") return "RO";
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(" ");
}

/**
 * Infer calendar month bounds from a filename or sheet name.
 * Examples: "Dispatch_July_2026.xlsx", "Schedule Vs Despatch June 26", "June 26"
 */
export function inferPeriodFromName(
  name: string
): { periodStart: string; periodEnd: string } | null {
  const text = name.replace(/[_\-./]+/g, " ").trim();
  const monthMatch = text.match(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/i
  );
  if (!monthMatch) return null;

  const month = MONTHS[monthMatch[1]!.toLowerCase()];
  if (!month) return null;

  let year: number | null = null;
  const fullYear = text.match(/\b(20\d{2})\b/);
  if (fullYear) {
    year = Number(fullYear[1]);
  } else {
    const shortYear = text.match(
      new RegExp(
        `${monthMatch[1]}\\s*[\\-_]?\\s*(\\d{2})\\b`,
        "i"
      )
    );
    if (shortYear) {
      year = 2000 + Number(shortYear[1]);
    }
  }
  if (!year) return null;

  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { periodStart: start, periodEnd: end };
}

function defaultCurrentMonthPeriod(): {
  periodStart: string;
  periodEnd: string;
} {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { periodStart: start, periodEnd: end };
}

export function parseDispatchExcel(
  input: Buffer | ArrayBuffer,
  options: ParseDispatchOptions = {}
): DispatchParseResult {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input);
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const warnings: string[] = [];
  const dispatches: ParsedDispatchItem[] = [];

  if (wb.SheetNames.length === 0) {
    return {
      dispatches: [],
      summary: emptySummary(),
      warnings: ["Workbook has no sheets."],
      inferredPeriod: null,
    };
  }

  let inferredPeriod =
    (options.fileName ? inferPeriodFromName(options.fileName) : null) ?? null;

  const plantFilter =
    options.plant && options.plant !== "All" ? options.plant : null;

  for (const sheetName of wb.SheetNames) {
    if (!inferredPeriod) {
      inferredPeriod = inferPeriodFromName(sheetName);
    }

    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    const rows = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      defval: null,
      raw: true,
    }) as unknown[][];

    let customer = "Unknown Customer";
    let currentPlant: string | null = null;
    let cols = { plan: 3, actual: 5, itemCode: 2, partName: 1 };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] ?? [];
      const c0 = cellText(row[0]);
      const c1 = cellText(row[1]);
      const c2 = cellText(row[2]);

      // First non-empty title cell before any plant band → customer.
      if (i === 0 && c0 && !matchPlant(c0) && !looksLikeHeaderRow(row)) {
        customer = titleCaseCustomer(c0);
        continue;
      }

      const plantFromRow = matchPlant(c0);
      if (plantFromRow) {
        currentPlant = plantFromRow;
        // Plant bands often restate the column headers on the same row —
        // still advance the plant, then skip the band row itself.
        if (looksLikeHeaderRow(row)) {
          cols = findPlanActualColumns(row);
        }
        continue;
      }

      if (looksLikeHeaderRow(row)) {
        cols = findPlanActualColumns(row);
        continue;
      }

      if (!currentPlant) continue;

      const itemCode = cellText(row[cols.itemCode]);
      if (!itemCode) continue;
      if (/^item\s*code$/i.test(itemCode)) continue;

      const itemDescription = cellText(row[cols.partName]) || c1;
      if (!itemDescription) {
        warnings.push(
          `Sheet "${sheetName}" row ${i + 1}: item ${itemCode} missing description — skipped.`
        );
        continue;
      }

      if (plantFilter && currentPlant !== plantFilter) continue;

      const plannedQuantity = toNumber(row[cols.plan]);
      const actualQuantity = toNumber(row[cols.actual]);
      const metrics = computeDispatchStatus(plannedQuantity, actualQuantity);

      dispatches.push({
        customer,
        itemCode: itemCode.toUpperCase(),
        itemDescription,
        plannedQuantity,
        actualQuantity,
        variance: metrics.variance,
        variancePercent: metrics.variancePercent,
        status: metrics.status,
        plant: currentPlant,
        productFamily: c0 || undefined,
        rowNumber: i + 1,
        sheetName,
      });
    }
  }

  if (dispatches.length === 0) {
    warnings.push(
      "No dispatch rows found. Expected plant bands (Roorkee / Noida A-06 / Noida A-07) and Item Code + Plan + Actual columns."
    );
  }

  if (!inferredPeriod) {
    inferredPeriod = defaultCurrentMonthPeriod();
    warnings.push(
      `Could not infer period from filename — defaulted to ${inferredPeriod.periodStart} → ${inferredPeriod.periodEnd}.`
    );
  }

  return {
    dispatches,
    summary: buildSummary(dispatches),
    warnings,
    inferredPeriod,
  };
}

function emptySummary(): DispatchParseSummary {
  return {
    total: 0,
    plants: [],
    customers: [],
    shortfallCount: 0,
    excessCount: 0,
    onTrackCount: 0,
    completeCount: 0,
  };
}

function buildSummary(items: ParsedDispatchItem[]): DispatchParseSummary {
  const plants = Array.from(new Set(items.map((d) => d.plant))).sort();
  const customers = Array.from(new Set(items.map((d) => d.customer))).sort();
  return {
    total: items.length,
    plants,
    customers,
    shortfallCount: items.filter((d) => d.status === "shortfall").length,
    excessCount: items.filter((d) => d.status === "excess").length,
    onTrackCount: items.filter((d) => d.status === "on_track").length,
    completeCount: items.filter((d) => d.status === "complete").length,
  };
}
