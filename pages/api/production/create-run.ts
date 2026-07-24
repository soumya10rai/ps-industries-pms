import type { NextApiRequest, NextApiResponse } from "next";
import { findPO, getRunStore, upsertRun } from "@/lib/mock-data";
import type { ProductionRun } from "@/lib/types";

/**
 * POST /api/production/create-run
 * Body: { po_number, product?, quantity?, machine?, due_date? }
 *
 * Creates a new production run linked to an approved / material-check PO.
 */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const poNumber = String(req.body?.po_number ?? "").trim();
    if (!poNumber) {
      return res.status(400).json({ error: "po_number is required." });
    }

    const po = findPO(poNumber);
    if (!po) {
      return res.status(404).json({ error: "Purchase order not found." });
    }

    if (!["approved", "material_check", "in_production"].includes(po.status)) {
      return res.status(400).json({
        error: `PO status "${po.status}" cannot start production. Approve it first.`,
      });
    }

    const product =
      String(req.body?.product ?? "").trim() ||
      po.items[0]?.description ||
      "Production item";

    const quantity = Number(
      req.body?.quantity ?? po.items[0]?.quantity ?? 0
    );
    if (!quantity || quantity <= 0) {
      return res.status(400).json({ error: "quantity must be > 0." });
    }

    const machine = String(req.body?.machine ?? "IMM-01").trim() || "IMM-01";
    const due_date =
      String(req.body?.due_date ?? "").trim() ||
      po.delivery_date ||
      new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

    const seq = getRunStore().length + 84;
    const run: ProductionRun = {
      id: `run-${Date.now()}`,
      run_number: `PR-2026-${String(seq).padStart(3, "0")}`,
      po_number: po.po_number,
      customer: po.customer_name,
      product,
      quantity,
      completed: 0,
      status: "scheduled",
      machine,
      started_at: null,
      due_date,
    };

    upsertRun(run);

    return res.status(201).json({
      run,
      message: `Production run ${run.run_number} created.`,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to create production run.";
    return res.status(500).json({ error: message });
  }
}
