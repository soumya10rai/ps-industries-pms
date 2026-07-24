import type { NextApiRequest, NextApiResponse } from "next";
import {
  getPOStore,
  getRunStore,
  MOCK_INVENTORY,
} from "@/lib/mock-data";

/**
 * GET /api/admin/stats
 * Plant-wide KPI snapshot for the admin dashboard.
 */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const role = String(req.headers["x-user-role"] ?? "");
    if (role && role !== "admin" && role !== "plant_head") {
      return res.status(403).json({
        error: "Admin or Plant Head role required.",
      });
    }

    const orders = getPOStore();
    const runs = getRunStore();
    const inventory = MOCK_INVENTORY;

    const totalPOValue = orders.reduce((s, p) => s + p.total_amount, 0);
    const pending = orders.filter((p) => p.status === "pending");
    const approved = orders.filter((p) => p.status === "approved");
    const rejected = orders.filter((p) => p.status === "rejected");
    const materialCheck = orders.filter((p) => p.status === "material_check");
    const lowStock = inventory.filter((i) => i.quantity <= i.reorder_level);

    const stats = {
      plant: "Greater Noida Plant",
      generated_at: new Date().toISOString(),
      orders: {
        count: orders.length,
        total_value: totalPOValue,
        pending: pending.length,
        approved: approved.length,
        rejected: rejected.length,
        material_check: materialCheck.length,
        by_customer: Object.fromEntries(
          ["BMR", "KENT", "PREM"].map((code) => [
            code,
            orders
              .filter((o) => o.customer_code === code)
              .reduce((s, o) => s + o.total_amount, 0),
          ])
        ),
      },
      inventory: {
        sku_count: inventory.length,
        low_stock: lowStock.length,
        categories: Array.from(new Set(inventory.map((i) => i.category)))
          .length,
        low_stock_items: lowStock.map((i) => ({
          sku: i.sku,
          name: i.name,
          quantity: i.quantity,
          reorder_level: i.reorder_level,
        })),
      },
      production: {
        total_runs: runs.length,
        running: runs.filter((r) => r.status === "running").length,
        scheduled: runs.filter((r) => r.status === "scheduled").length,
        paused: runs.filter((r) => r.status === "paused").length,
        completed: runs.filter((r) => r.status === "completed").length,
        machines: Array.from(new Set(runs.map((r) => r.machine))),
      },
      sample_pos: orders.map((o) => ({
        po_number: o.po_number,
        customer: o.customer_code,
        items: o.items.length,
        total: o.total_amount,
        status: o.status,
      })),
    };

    return res.status(200).json({ ok: true, stats });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load admin stats.";
    return res.status(500).json({ error: message });
  }
}
