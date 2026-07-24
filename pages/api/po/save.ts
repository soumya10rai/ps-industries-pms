import type { NextApiRequest, NextApiResponse } from "next";
import { upsertPO } from "@/lib/mock-data";
import type { PurchaseOrder } from "@/lib/types";

/**
 * POST /api/po/save
 * Persists a parsed purchase order into the in-memory store.
 */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = req.body as { po?: PurchaseOrder };
    const po = body?.po;

    if (!po || !po.po_number || !Array.isArray(po.items)) {
      return res.status(400).json({ error: "Invalid purchase order payload." });
    }

    const saved: PurchaseOrder = {
      ...po,
      id: po.id || `po-${Date.now()}`,
      status: po.status || "pending",
      uploaded_at: po.uploaded_at || new Date().toISOString(),
    };

    upsertPO(saved);

    return res.status(200).json({ po: saved, message: "Purchase order saved." });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Save failed";
    return res.status(500).json({ error: message });
  }
}
