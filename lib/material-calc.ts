import type { POItem, PurchaseOrder } from "@/lib/types";

/** Demo part master defaults (grams per finished part). */
export const PART_WEIGHT_GRAMS = 45;
/** Demo scrap allowance (%). */
export const SCRAP_PERCENT = 8;

export interface MaterialStock {
  material: string;
  stock_kg: number;
}

/**
 * Demo store stock levels (kg).
 * HIPS SH03 is intentionally short so shortfall UI is visible;
 * HIPS NATURAL is surplus so OK / green path is visible.
 */
export const MATERIAL_STOCK: MaterialStock[] = [
  { material: "HIPS SH03", stock_kg: 234 },
  { material: "HIPS NATURAL", stock_kg: 350 },
  { material: "EVA COMPOUND", stock_kg: 180 },
  { material: "PP COPOLYMER", stock_kg: 420 },
  { material: "ABS NATURAL", stock_kg: 95 },
  { material: "GENERAL RESIN", stock_kg: 150 },
];

export interface MaterialLine {
  material: string;
  required_kg: number;
  stock_kg: number;
  shortfall_kg: number;
  status: "ok" | "shortfall";
  item_codes: string[];
  total_parts: number;
}

export interface POMaterialCheck {
  po: PurchaseOrder;
  lines: MaterialLine[];
  all_stock_available: boolean;
  total_required_kg: number;
  total_shortfall_kg: number;
}

/**
 * usable_weight_kg = (part_weight_grams / 1000) * quantity * (1 + scrap_percent/100)
 * Example: (45/1000) * 17000 * 1.08 = 826.2 kg
 */
export function calcUsableWeightKg(
  quantity: number,
  partWeightGrams: number = PART_WEIGHT_GRAMS,
  scrapPercent: number = SCRAP_PERCENT
): number {
  const kg = (partWeightGrams / 1000) * quantity * (1 + scrapPercent / 100);
  return Number(kg.toFixed(1));
}

/** Map a PO line item to a demo material grade / SKU name. */
export function resolveMaterial(item: POItem): string {
  const grade = (item.material_grade || "").toUpperCase();
  const desc = (item.description || "").toUpperCase();
  const code = item.item_code || "";

  if (grade.includes("HIPS") || desc.includes("HIPS")) {
    // Alternate between short and OK stock for demo variety
    return code.endsWith("0") || code.includes("602240")
      ? "HIPS SH03"
      : "HIPS NATURAL";
  }
  if (desc.includes("EVA")) return "EVA COMPOUND";
  if (desc.includes("PP") || desc.includes("POLYPROPYLENE")) return "PP COPOLYMER";
  if (desc.includes("ABS")) return "ABS NATURAL";
  if (desc.includes("FRAME") || desc.includes("HINGE")) return "HIPS SH03";
  if (desc.includes("TRAY") || desc.includes("COVER")) return "HIPS NATURAL";

  // Deterministic fallback from item code
  const idx =
    code.split("").reduce((s, ch) => s + ch.charCodeAt(0), 0) %
    MATERIAL_STOCK.length;
  return MATERIAL_STOCK[idx]!.material;
}

function stockFor(material: string): number {
  return (
    MATERIAL_STOCK.find((m) => m.material === material)?.stock_kg ?? 0
  );
}

/**
 * Aggregate material requirements for one purchase order.
 */
export function calculatePOMaterials(po: PurchaseOrder): POMaterialCheck {
  const buckets = new Map<
    string,
    { required_kg: number; item_codes: string[]; total_parts: number }
  >();

  for (const item of po.items) {
    const material = resolveMaterial(item);
    const required = calcUsableWeightKg(item.quantity);
    const prev = buckets.get(material) || {
      required_kg: 0,
      item_codes: [],
      total_parts: 0,
    };
    prev.required_kg = Number((prev.required_kg + required).toFixed(1));
    prev.item_codes.push(item.item_code);
    prev.total_parts += item.quantity;
    buckets.set(material, prev);
  }

  const lines: MaterialLine[] = Array.from(buckets.entries()).map(
    ([material, agg]) => {
      const stock_kg = stockFor(material);
      const shortfall_kg = Math.max(
        0,
        Number((agg.required_kg - stock_kg).toFixed(1))
      );
      return {
        material,
        required_kg: agg.required_kg,
        stock_kg,
        shortfall_kg,
        status: shortfall_kg > 0 ? "shortfall" : "ok",
        item_codes: agg.item_codes,
        total_parts: agg.total_parts,
      };
    }
  );

  const total_required_kg = Number(
    lines.reduce((s, l) => s + l.required_kg, 0).toFixed(1)
  );
  const total_shortfall_kg = Number(
    lines.reduce((s, l) => s + l.shortfall_kg, 0).toFixed(1)
  );

  return {
    po,
    lines,
    all_stock_available: lines.every((l) => l.status === "ok"),
    total_required_kg,
    total_shortfall_kg,
  };
}
