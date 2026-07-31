/**
 * Server-only material check against parts master + live /raw_materials stock.
 * Do not import this from client components.
 */

import { loadRawMaterial } from "@/lib/inventory";
import { getPart } from "@/lib/parts";
import {
  calcUsableWeightKg,
  calculatePOMaterials,
  type MaterialLine,
  type POMaterialCheck,
} from "@/lib/material-calc";
import type { PurchaseOrder } from "@/lib/types";

export interface PartMaterialRequirement {
  itemCode: string;
  description: string;
  materialCode: string;
  materialName: string;
  requiredKg: number;
  stockKg: number;
  shortfallKg: number;
  status: "ok" | "shortfall" | "missing_part" | "missing_material";
  weightGrams: number;
  scrapPercent: number;
  quantity: number;
}

/**
 * Per-line requirements from /parts/{itemCode} → /raw_materials/{materialCode}.
 */
export async function calculatePORequirementsFromParts(
  po: PurchaseOrder
): Promise<{
  lines: PartMaterialRequirement[];
  allOk: boolean;
  missingParts: string[];
  shortfalls: PartMaterialRequirement[];
}> {
  const lines: PartMaterialRequirement[] = [];
  const missingParts: string[] = [];

  for (const item of po.items) {
    const code = item.item_code.trim().toUpperCase();
    const part = await getPart(code);
    if (!part) {
      missingParts.push(code);
      lines.push({
        itemCode: code,
        description: item.description,
        materialCode: "",
        materialName: "",
        requiredKg: 0,
        stockKg: 0,
        shortfallKg: 0,
        status: "missing_part",
        weightGrams: 0,
        scrapPercent: 0,
        quantity: item.quantity,
      });
      continue;
    }

    const requiredKg = calcUsableWeightKg(
      item.quantity,
      part.weightGrams,
      part.scrapPercent
    );
    const material = await loadRawMaterial(part.materialCode);
    const stockKg = material?.currentStockKg ?? 0;
    const shortfallKg = Math.max(
      0,
      Number((requiredKg - stockKg).toFixed(1))
    );

    let status: PartMaterialRequirement["status"] = "ok";
    if (!material) status = "missing_material";
    else if (shortfallKg > 0) status = "shortfall";

    lines.push({
      itemCode: code,
      description: item.description || part.description,
      materialCode: part.materialCode,
      materialName: material?.materialName || part.materialCode,
      requiredKg,
      stockKg,
      shortfallKg,
      status,
      weightGrams: part.weightGrams,
      scrapPercent: part.scrapPercent,
      quantity: item.quantity,
    });
  }

  const shortfalls = lines.filter(
    (l) => l.status === "shortfall" || l.status === "missing_material"
  );

  return {
    lines,
    allOk: lines.every((l) => l.status === "ok"),
    missingParts,
    shortfalls,
  };
}

/**
 * Aggregate material requirements for Material Check UI.
 * Prefers parts-master weights; falls back to heuristic calc when parts empty.
 */
export async function calculatePOMaterialsLive(
  po: PurchaseOrder
): Promise<POMaterialCheck> {
  const fromParts = await calculatePORequirementsFromParts(po);
  const hasAnyPart = fromParts.lines.some((l) => l.status !== "missing_part");

  if (!hasAnyPart) {
    // Legacy POs without parts-master codes — keep heuristic path.
    return calculatePOMaterials(po, null);
  }

  // Aggregate by material code for the Material Check table
  const buckets = new Map<
    string,
    {
      material: string;
      material_code: string;
      required_kg: number;
      stock_kg: number;
      item_codes: string[];
      total_parts: number;
    }
  >();

  for (const line of fromParts.lines) {
    if (line.status === "missing_part") continue;
    const key = line.materialCode || line.itemCode;
    const prev = buckets.get(key) || {
      material: line.materialName || line.materialCode,
      material_code: line.materialCode,
      required_kg: 0,
      stock_kg: line.stockKg,
      item_codes: [] as string[],
      total_parts: 0,
    };
    prev.required_kg = Number((prev.required_kg + line.requiredKg).toFixed(1));
    prev.stock_kg = line.stockKg;
    prev.item_codes.push(line.itemCode);
    prev.total_parts += line.quantity;
    buckets.set(key, prev);
  }

  const lines: MaterialLine[] = Array.from(buckets.values()).map((agg) => {
    const shortfall_kg = Math.max(
      0,
      Number((agg.required_kg - agg.stock_kg).toFixed(1))
    );
    return {
      material: agg.material,
      material_code: agg.material_code,
      required_kg: agg.required_kg,
      stock_kg: agg.stock_kg,
      shortfall_kg,
      status: shortfall_kg > 0 ? "shortfall" : "ok",
      item_codes: agg.item_codes,
      total_parts: agg.total_parts,
    };
  });

  // Surface missing parts as shortfall lines so the UI flags them
  for (const code of fromParts.missingParts) {
    lines.push({
      material: `MISSING PART ${code}`,
      required_kg: 0,
      stock_kg: 0,
      shortfall_kg: 0,
      status: "shortfall",
      item_codes: [code],
      total_parts: 0,
    });
  }

  const total_required_kg = Number(
    lines.reduce((s, l) => s + l.required_kg, 0).toFixed(1)
  );
  const total_shortfall_kg = Number(
    lines.reduce((s, l) => s + l.shortfall_kg, 0).toFixed(1)
  );

  return {
    po,
    lines,
    all_stock_available:
      fromParts.missingParts.length === 0 &&
      lines.every((l) => l.status === "ok"),
    total_required_kg,
    total_shortfall_kg,
  };
}
