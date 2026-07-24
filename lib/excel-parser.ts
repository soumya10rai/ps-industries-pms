import * as XLSX from "xlsx";

export interface ParsedMaterial {
  material_name: string;
  current_qty: number;
  location: string;
  reorder_level: number;
}

const REQUIRED_HEADERS = [
  "material name",
  "quantity",
  "location",
  "reorder level",
] as const;

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const cleaned = String(value ?? "")
    .replace(/,/g, "")
    .trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Validate a single parsed material row.
 */
export function validateMaterialRow(
  row: Partial<ParsedMaterial> | null | undefined
): row is ParsedMaterial {
  if (!row) return false;
  if (!row.material_name || !String(row.material_name).trim()) return false;
  if (!Number.isFinite(row.current_qty) || (row.current_qty as number) < 0) {
    return false;
  }
  if (!row.location || !String(row.location).trim()) return false;
  if (
    !Number.isFinite(row.reorder_level) ||
    (row.reorder_level as number) < 0
  ) {
    return false;
  }
  return true;
}

function mapRow(
  raw: Record<string, unknown>,
  headerMap: Record<string, string>
): ParsedMaterial | null {
  const get = (canonical: string) => {
    const key = headerMap[canonical];
    return key ? raw[key] : undefined;
  };

  const material: Partial<ParsedMaterial> = {
    material_name: String(get("material name") ?? "").trim(),
    current_qty: toNumber(get("quantity")),
    location: String(get("location") ?? "").trim(),
    reorder_level: toNumber(get("reorder level")),
  };

  return validateMaterialRow(material) ? material : null;
}

function buildHeaderMap(headers: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const header of headers) {
    const normalized = normalizeHeader(header);
    // Accept common aliases
    if (
      normalized === "material name" ||
      normalized === "material" ||
      normalized === "name"
    ) {
      map["material name"] = header;
    } else if (
      normalized === "quantity" ||
      normalized === "qty" ||
      normalized === "current qty" ||
      normalized === "current_qty"
    ) {
      map["quantity"] = header;
    } else if (normalized === "location" || normalized === "warehouse") {
      map["location"] = header;
    } else if (
      normalized === "reorder level" ||
      normalized === "reorder" ||
      normalized === "reorder_level"
    ) {
      map["reorder level"] = header;
    }
  }
  return map;
}

/**
 * Parse an .xlsx inventory file into material rows.
 * Expected columns: Material Name | Quantity | Location | Reorder Level
 */
export async function parseExcelFile(file: File): Promise<ParsedMaterial[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("Excel file has no sheets.");
  }

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: true,
  });

  if (rows.length === 0) {
    throw new Error("Excel sheet is empty.");
  }

  const headers = Object.keys(rows[0] ?? {});
  const headerMap = buildHeaderMap(headers);
  const missing = REQUIRED_HEADERS.filter((h) => !headerMap[h]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required columns: ${missing
        .map((h) => h.replace(/\b\w/g, (c) => c.toUpperCase()))
        .join(", ")}. Expected Material Name | Quantity | Location | Reorder Level.`
    );
  }

  const materials: ParsedMaterial[] = [];
  const invalidRows: number[] = [];

  rows.forEach((row, index) => {
    const parsed = mapRow(row, headerMap);
    if (parsed) {
      materials.push(parsed);
    } else {
      // Skip completely blank rows
      const values = Object.values(row).map((v) => String(v ?? "").trim());
      if (values.some((v) => v.length > 0)) {
        invalidRows.push(index + 2); // +2 accounts for header row
      }
    }
  });

  if (materials.length === 0) {
    throw new Error(
      invalidRows.length
        ? `No valid material rows found. Check rows: ${invalidRows.slice(0, 8).join(", ")}`
        : "No valid material rows found."
    );
  }

  if (invalidRows.length > 0) {
    console.warn(
      "[excel-parser] Skipped invalid rows:",
      invalidRows.join(", ")
    );
  }

  return materials;
}

/**
 * Parse a file and return materials ready to persist to Firestore.
 */
export async function exportToFirestore(file: File): Promise<ParsedMaterial[]> {
  return parseExcelFile(file);
}

export function isXlsxFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    name.endsWith(".xlsx") ||
    file.type ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export interface RawMaterialRecord {
  id: string;
  material_name: string;
  current_qty: number;
  location: string;
  reorder_level: number;
  last_updated: string;
}
