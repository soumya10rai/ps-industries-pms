/**
 * Server-only material check against live /raw_materials stock.
 * Do not import this from client components.
 */

import { loadLiveStockMap, resolveMaterialCode } from "@/lib/inventory";
import {
  calculatePOMaterials,
  type MaterialLine,
  type POMaterialCheck,
} from "@/lib/material-calc";
import type { PurchaseOrder } from "@/lib/types";

/**
 * Calculate PO materials using live /raw_materials stock.
 * Falls back to MATERIAL_STOCK when Firestore has no materials.
 */
export async function calculatePOMaterialsLive(
  po: PurchaseOrder
): Promise<POMaterialCheck> {
  const stockMap = await loadLiveStockMap();
  const check = calculatePOMaterials(
    po,
    stockMap.size > 0 ? stockMap : null
  );

  const enriched: MaterialLine[] = [];
  for (const line of check.lines) {
    const resolved = await resolveMaterialCode(line.material);
    enriched.push({
      ...line,
      material_code: resolved?.materialCode,
      stock_kg: resolved ? resolved.stockKg : line.stock_kg,
      shortfall_kg: resolved
        ? Math.max(0, Number((line.required_kg - resolved.stockKg).toFixed(1)))
        : line.shortfall_kg,
      status: resolved
        ? line.required_kg > resolved.stockKg
          ? "shortfall"
          : "ok"
        : line.status,
    });
  }

  const total_shortfall_kg = Number(
    enriched.reduce((s, l) => s + l.shortfall_kg, 0).toFixed(1)
  );

  return {
    ...check,
    lines: enriched,
    all_stock_available: enriched.every((l) => l.status === "ok"),
    total_shortfall_kg,
  };
}
