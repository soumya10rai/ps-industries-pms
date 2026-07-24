import type { NextApiRequest, NextApiResponse } from "next";
import { findPO, MOCK_INVENTORY } from "@/lib/mock-data";

interface MaterialRequirement {
  item_code: string;
  description: string;
  required_qty: number;
  uom: string;
  estimated_material_kg: number;
  scrap_factor: number;
  stock_sku: string | null;
  stock_available: number;
  shortage: number;
  status: "ok" | "low" | "missing";
}

/**
 * POST /api/material-calc/calculate
 * Body: { poId?: string, po_number?: string, scrapPercent?: number }
 *
 * Estimates raw-material needs for a purchase order against store stock.
 */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const poId = String(req.body?.poId ?? req.body?.po_number ?? "").trim();
    const scrapPercent = Number(req.body?.scrapPercent ?? 3);

    if (!poId) {
      return res
        .status(400)
        .json({ error: "Provide poId or po_number." });
    }

    if (Number.isNaN(scrapPercent) || scrapPercent < 0 || scrapPercent > 50) {
      return res
        .status(400)
        .json({ error: "scrapPercent must be between 0 and 50." });
    }

    const po = findPO(poId);
    if (!po) {
      return res.status(404).json({ error: "Purchase order not found." });
    }

    const scrapFactor = 1 + scrapPercent / 100;
    const lines: MaterialRequirement[] = po.items.map((item) => {
      const weightPerUnit =
        item.material_grade?.toUpperCase() === "HIPS" ? 0.085 : 0.12;
      const estimatedKg = Number(
        (item.quantity * weightPerUnit * scrapFactor).toFixed(2)
      );

      const stock = MOCK_INVENTORY.find(
        (inv) =>
          inv.name.toLowerCase().includes(item.description.split(" ")[0].toLowerCase()) ||
          inv.sku.toLowerCase().includes(item.item_code.slice(0, 4).toLowerCase()) ||
          (item.material_grade &&
            inv.name.toLowerCase().includes(item.material_grade.toLowerCase()))
      );

      const stockAvailable = stock?.quantity ?? 0;
      const compareQty =
        stock?.uom.toUpperCase() === "KG" ? estimatedKg : item.quantity;
      const shortage = Math.max(0, Number((compareQty - stockAvailable).toFixed(2)));

      let status: MaterialRequirement["status"] = "ok";
      if (!stock) status = "missing";
      else if (shortage > 0) status = "low";

      return {
        item_code: item.item_code,
        description: item.description,
        required_qty: item.quantity,
        uom: item.uom,
        estimated_material_kg: estimatedKg,
        scrap_factor: scrapFactor,
        stock_sku: stock?.sku ?? null,
        stock_available: stockAvailable,
        shortage,
        status,
      };
    });

    const summary = {
      po_number: po.po_number,
      customer: po.customer_name,
      items: lines.length,
      ok: lines.filter((l) => l.status === "ok").length,
      low: lines.filter((l) => l.status === "low").length,
      missing: lines.filter((l) => l.status === "missing").length,
      total_estimated_kg: Number(
        lines.reduce((s, l) => s + l.estimated_material_kg, 0).toFixed(2)
      ),
      ready_for_production: lines.every((l) => l.status === "ok"),
    };

    return res.status(200).json({ summary, lines });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Material calculation failed.";
    return res.status(500).json({ error: message });
  }
}
