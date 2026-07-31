/**
 * Parse PS Industries RM stock workbooks (e.g. RM_01-06-26.xlsx).
 *
 * The workbook holds one stock sheet per month per category, e.g.
 * "RM STOCK JUN-25", "MB STOCK JUN-25" … "RM STOCK JUNE - 26". Each sheet:
 *
 *   row 1  — title cell ("RAW MATERIAL STOCK" / "MASTER BATCH STOCK")
 *   row 2  — headers: SR.NO. | MATERIAL NAME | MATERIAL GROUP or PARTY NAME |
 *            UOM | OP STOCK … daily date columns … | BALANCE STOCK
 *   rows   — one per material, terminated by a TOTAL row
 *   later  — summary table: SR.NO | RM NAME / MATERIAL NAME | AVL IN KG | RE ORDER LEVEL
 *
 * Daily date columns are ignored — those transactions flow through the
 * receive/issue endpoints. Only opening and balance stock are imported.
 *
 * Because history sheets repeat the same materials with older balances, only
 * the most recent raw-material and masterbatch sheets are selected by default.
 */

import * as XLSX from "xlsx";
import type { MaterialType } from "@/lib/types";

/** Reorder level used when a material is absent from the summary table. */
export const FALLBACK_REORDER_LEVEL_KG = 500;

export interface ParsedInventoryRow {
  materialCode: string;
  materialName: string;
  materialGroup: string;
  materialType: MaterialType;
  unit: string;
  openingStockKg: number;
  currentStockKg: number;
  reorderLevelKg: number;
  partyName?: string;
  sheetName: string;
  rowNumber: number;
}

export interface ParsedSheetSummary {
  sheetName: string;
  materialType: MaterialType;
  /** Human-readable stock period parsed from the sheet name, e.g. "JUN 2026". */
  period: string | null;
  count: number;
  /** Whether this sheet's rows are included in `items`. */
  selected: boolean;
}

export interface InventoryParseResult {
  items: ParsedInventoryRow[];
  sheets: ParsedSheetSummary[];
  warnings: string[];
  totalRows: number;
  skippedRows: number;
}

export interface ParseInventoryOptions {
  /**
   * Sheets to import. Defaults to the most recent raw-material sheet and the
   * most recent masterbatch sheet.
   */
  sheetNames?: string[];
}

function normalizeHeader(value: unknown): string {
  if (value instanceof Date) return "";
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_/.\-\r\n]+/g, " ")
    .trim();
}

function matchesAny(header: string, candidates: string[]): boolean {
  if (!header) return false;
  return candidates.some((c) => header === c || header.includes(c));
}

function findColumn(headers: string[], candidates: string[]): number {
  for (let i = 0; i < headers.length; i++) {
    if (matchesAny(headers[i] ?? "", candidates)) return i;
  }
  return -1;
}

/** Search right-to-left — BALANCE STOCK sits after the daily date columns. */
function findLastColumn(headers: string[], candidates: string[]): number {
  for (let i = headers.length - 1; i >= 0; i--) {
    if (matchesAny(headers[i] ?? "", candidates)) return i;
  }
  return -1;
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const cleaned = String(value).replace(/,/g, "").trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function cellText(row: unknown[], col: number): string {
  if (col < 0 || col >= row.length) return "";
  const value = row[col];
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return "";
  return String(value).trim();
}

/** "ABS KENT WHITE UVS 120" → "ABS_KENT_WHITE_UVS_120" */
export function materialCodeFromName(name: string): string {
  return name
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_")
    .replace(/[^A-Z0-9_]/g, "");
}

/** Key used to reconcile summary-table rows against material rows. */
function nameKey(name: string): string {
  return name.trim().toUpperCase().replace(/\s+/g, " ");
}

const NAME_HEADERS = ["material name", "rm name", "r m name"];
const STOCK_HEADERS = [
  "op stock",
  "op stk",
  "phy op stk",
  "opening",
  "balance stock",
];
const OPENING_HEADERS = ["op stock", "op stk", "phy op stk", "opening"];
const BALANCE_HEADERS = ["balance stock", "closing stock", "balance"];
const REORDER_HEADERS = ["re order level", "reorder level"];

/** Consumption and cutting sheets are not stock masters. */
const EXCLUDED_SHEET_PATTERN = /CUTTING|CONSUMPTION|\bCON\b|SHIFT/;

const MONTHS: Record<string, number> = {
  JAN: 1,
  FEB: 2,
  MAR: 3,
  APR: 4,
  MAY: 5,
  JUN: 6,
  JUL: 7,
  AUG: 8,
  SEP: 9,
  OCT: 10,
  NOV: 11,
  DEC: 12,
};

/** "RM STOCK JUNE - 26" → { year: 2026, month: 6, label: "JUN 2026" } */
function parsePeriod(
  sheetName: string
): { year: number; month: number; label: string } | null {
  const upper = sheetName.toUpperCase();
  const match = upper.match(
    /\b(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]*/
  );
  if (!match || match.index === undefined) return null;

  const month = MONTHS[match[1]!]!;
  const rest = upper.slice(match.index + match[0].length);
  const yearMatch = rest.match(/\d{2,4}/);
  if (!yearMatch) return null;

  let year = Number(yearMatch[0]);
  if (year < 100) year += 2000;
  return { year, month, label: `${match[1]} ${year}` };
}

function detectMaterialType(
  sheetName: string,
  headers: string[]
): MaterialType {
  const upper = sheetName.toUpperCase();
  if (/\bMB\b|MASTER\s*BATCH|MASTERBATCH|COLOU?R/.test(upper)) {
    return "masterbatch";
  }
  if (/\bRM\b|RAW/.test(upper)) return "raw_material";
  return headers.some((h) => matchesAny(h, ["party name"]))
    ? "masterbatch"
    : "raw_material";
}

/**
 * Reorder levels from the summary table below the material rows.
 * Returns the map of normalized material name → reorder level (kg) and the
 * summary header row index, which also bounds the material rows above it.
 */
function parseSummaryTable(
  rows: unknown[][],
  startIdx: number
): { reorderByName: Map<string, number>; headerIdx: number } {
  const reorderByName = new Map<string, number>();

  let headerIdx = -1;
  for (let r = startIdx; r < rows.length; r++) {
    const headers = (rows[r] ?? []).map(normalizeHeader);
    if (headers.some((h) => matchesAny(h, REORDER_HEADERS))) {
      headerIdx = r;
      break;
    }
  }
  if (headerIdx < 0) return { reorderByName, headerIdx };

  const headers = (rows[headerIdx] ?? []).map(normalizeHeader);
  const colName = findColumn(headers, NAME_HEADERS);
  const colReorder = findColumn(headers, REORDER_HEADERS);
  if (colName < 0 || colReorder < 0) return { reorderByName, headerIdx };

  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const name = cellText(row, colName);
    if (!name || /^total/i.test(name)) continue;
    const reorder = toNumber(row[colReorder]);
    if (reorder === null || reorder < 0) continue;
    reorderByName.set(nameKey(name), reorder);
  }

  return { reorderByName, headerIdx };
}

interface SheetParse {
  sheetName: string;
  materialType: MaterialType;
  period: { year: number; month: number; label: string } | null;
  sheetIndex: number;
  items: ParsedInventoryRow[];
  totalRows: number;
  skippedRows: number;
  /** Reported only when the sheet is selected for import. */
  warnings: string[];
}

function parseSheet(
  sheetName: string,
  sheetIndex: number,
  rows: unknown[][]
): SheetParse | null {
  const warnings: string[] = [];
  if (rows.length === 0) return null;

  // The material header row is the first row naming a material *and* carrying
  // a stock column — this skips the title row and the later summary header.
  let headerIdx = -1;
  for (let r = 0; r < rows.length; r++) {
    const headers = (rows[r] ?? []).map(normalizeHeader);
    const hasName = headers.some((h) => matchesAny(h, NAME_HEADERS));
    const hasStock = headers.some((h) => matchesAny(h, STOCK_HEADERS));
    if (hasName && hasStock) {
      headerIdx = r;
      break;
    }
  }
  if (headerIdx < 0) return null;

  const headers = (rows[headerIdx] ?? []).map(normalizeHeader);
  const materialType = detectMaterialType(sheetName, headers);

  const colSr = findColumn(headers, ["sr no", "srno", "s no"]);
  const colName = findColumn(headers, NAME_HEADERS);
  const colGroup = findColumn(headers, ["material group", "grade"]);
  const colParty = findColumn(headers, ["party name", "supplier"]);
  const colUom = findColumn(headers, ["uom", "unit"]);
  const colOpening = findColumn(headers, OPENING_HEADERS);
  const colBalance = findLastColumn(headers, BALANCE_HEADERS);

  if (colBalance < 0) {
    warnings.push(
      `Sheet "${sheetName}": no BALANCE STOCK column — using opening stock as current stock.`
    );
  }

  const { reorderByName, headerIdx: summaryIdx } = parseSummaryTable(
    rows,
    headerIdx + 1
  );
  const endIdx = summaryIdx > headerIdx ? summaryIdx : rows.length;

  const items: ParsedInventoryRow[] = [];
  const byCode = new Map<string, ParsedInventoryRow>();
  const missingReorder: string[] = [];
  let totalRows = 0;
  let skippedRows = 0;

  for (let r = headerIdx + 1; r < endIdx; r++) {
    const row = rows[r] ?? [];
    const materialName = cellText(row, colName);
    const srRaw = cellText(row, colSr);

    // Material rows run until the TOTAL row, a blank name, or a non-numeric SR.NO.
    if (!materialName) break;
    if (/^total$/i.test(materialName)) break;
    if (srRaw && toNumber(srRaw) === null) break;

    totalRows += 1;

    const opening = colOpening >= 0 ? toNumber(row[colOpening]) : null;
    const balance = colBalance >= 0 ? toNumber(row[colBalance]) : null;
    const currentStockKg = balance ?? opening ?? 0;
    const openingStockKg = opening ?? 0;

    if (currentStockKg < 0 || openingStockKg < 0) {
      warnings.push(
        `Sheet "${sheetName}" row ${r + 1} (${materialName}): negative quantity — skipped.`
      );
      skippedRows += 1;
      continue;
    }

    const materialCode = materialCodeFromName(materialName);
    if (!materialCode) {
      warnings.push(
        `Sheet "${sheetName}" row ${r + 1}: material name "${materialName}" yields an empty code — skipped.`
      );
      skippedRows += 1;
      continue;
    }

    const existing = byCode.get(materialCode);
    if (existing) {
      // BALANCE STOCK is a snapshot, so duplicates are kept, not summed.
      warnings.push(
        `Sheet "${sheetName}" row ${r + 1}: duplicate material "${materialName}" — kept the first row (${existing.currentStockKg} kg).`
      );
      skippedRows += 1;
      continue;
    }

    const groupRaw = cellText(row, colGroup);
    const partyName = cellText(row, colParty);
    const materialGroup = (
      groupRaw || (materialType === "masterbatch" ? "MB" : "UNGROUPED")
    ).toUpperCase();
    const unit = (cellText(row, colUom) || "KGS").toUpperCase();

    const reorder = reorderByName.get(nameKey(materialName));
    if (reorder === undefined) missingReorder.push(materialName);

    const item: ParsedInventoryRow = {
      materialCode,
      materialName,
      materialGroup,
      materialType,
      unit,
      openingStockKg: Number(openingStockKg.toFixed(3)),
      currentStockKg: Number(currentStockKg.toFixed(3)),
      reorderLevelKg: reorder ?? FALLBACK_REORDER_LEVEL_KG,
      partyName: partyName || undefined,
      sheetName,
      rowNumber: r + 1,
    };
    byCode.set(materialCode, item);
    items.push(item);
  }

  if (items.length === 0) return null;

  if (missingReorder.length > 0) {
    warnings.push(
      `Sheet "${sheetName}": ${missingReorder.length} material(s) missing from the reorder summary — defaulted to ${FALLBACK_REORDER_LEVEL_KG} kg (${missingReorder
        .slice(0, 5)
        .join(", ")}${missingReorder.length > 5 ? "…" : ""}).`
    );
  }

  return {
    sheetName,
    materialType,
    period: parsePeriod(sheetName),
    sheetIndex,
    items,
    totalRows,
    skippedRows,
    warnings,
  };
}

/** Latest sheet per material type, by period then workbook order. */
function selectLatestSheets(parsed: SheetParse[]): Set<string> {
  const latest = new Map<MaterialType, SheetParse>();

  for (const sheet of parsed) {
    const current = latest.get(sheet.materialType);
    if (!current) {
      latest.set(sheet.materialType, sheet);
      continue;
    }
    const rank = (s: SheetParse) =>
      s.period ? s.period.year * 12 + s.period.month : -1;
    const sheetRank = rank(sheet);
    const currentRank = rank(current);
    if (
      sheetRank > currentRank ||
      (sheetRank === currentRank && sheet.sheetIndex > current.sheetIndex)
    ) {
      latest.set(sheet.materialType, sheet);
    }
  }

  return new Set(Array.from(latest.values()).map((s) => s.sheetName));
}

/**
 * Parse an RM workbook into inventory rows.
 */
export function parseInventoryExcel(
  buffer: ArrayBuffer | Buffer,
  options: ParseInventoryOptions = {}
): InventoryParseResult {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const warnings: string[] = [];

  if (workbook.SheetNames.length === 0) {
    return {
      items: [],
      sheets: [],
      warnings: ["Workbook has no sheets."],
      totalRows: 0,
      skippedRows: 0,
    };
  }

  const parsedSheets: SheetParse[] = [];

  workbook.SheetNames.forEach((sheetName, sheetIndex) => {
    if (EXCLUDED_SHEET_PATTERN.test(sheetName.toUpperCase())) return;

    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return;

    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: null,
      raw: true,
    }) as unknown[][];

    const parsed = parseSheet(sheetName, sheetIndex, rows);
    if (parsed) parsedSheets.push(parsed);
  });

  if (parsedSheets.length === 0) {
    return {
      items: [],
      sheets: [],
      warnings: [
        ...warnings,
        "No stock sheets found. Expected a MATERIAL NAME header row with OP STOCK / BALANCE STOCK columns.",
      ],
      totalRows: 0,
      skippedRows: 0,
    };
  }

  const requested = options.sheetNames?.filter((name) =>
    parsedSheets.some((s) => s.sheetName === name)
  );
  const unknownRequested = (options.sheetNames ?? []).filter(
    (name) => !parsedSheets.some((s) => s.sheetName === name)
  );
  for (const name of unknownRequested) {
    warnings.push(`Requested sheet "${name}" is not a stock sheet — ignored.`);
  }

  const selectedNames =
    requested && requested.length > 0
      ? new Set(requested)
      : selectLatestSheets(parsedSheets);

  const items: ParsedInventoryRow[] = [];
  const seenCodes = new Map<string, ParsedInventoryRow>();
  const sheets: ParsedSheetSummary[] = [];
  let totalRows = 0;
  let skippedRows = 0;

  for (const sheet of parsedSheets) {
    const selected = selectedNames.has(sheet.sheetName);
    let count = 0;

    if (selected) {
      totalRows += sheet.totalRows;
      skippedRows += sheet.skippedRows;
      warnings.push(...sheet.warnings);

      for (const item of sheet.items) {
        const duplicate = seenCodes.get(item.materialCode);
        if (duplicate) {
          warnings.push(
            `Material "${item.materialName}" appears in both "${duplicate.sheetName}" and "${sheet.sheetName}" — kept the "${duplicate.sheetName}" row.`
          );
          skippedRows += 1;
          continue;
        }
        seenCodes.set(item.materialCode, item);
        items.push(item);
        count += 1;
      }
    } else {
      count = sheet.items.length;
    }

    sheets.push({
      sheetName: sheet.sheetName,
      materialType: sheet.materialType,
      period: sheet.period?.label ?? null,
      count,
      selected,
    });
  }

  return { items, sheets, warnings, totalRows, skippedRows };
}
