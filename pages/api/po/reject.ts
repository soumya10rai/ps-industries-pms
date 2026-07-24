import type { NextApiRequest, NextApiResponse } from "next";
import { findPO, upsertPO } from "@/lib/mock-data";

/**
 * POST /api/po/reject
 * Marks a purchase order as rejected with an optional reason.
 */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { id, reason } = req.body as { id?: string; reason?: string };
    if (!id) {
      return res.status(400).json({ error: "Missing PO id." });
    }

    const existing = findPO(id);
    if (!existing) {
      return res.status(404).json({ error: "Purchase order not found." });
    }

    if (existing.status !== "pending") {
      return res.status(400).json({
        error: `Cannot reject a PO with status "${existing.status}".`,
      });
    }

    const rejected = upsertPO({
      ...existing,
      status: "rejected",
      rejection_reason: reason || "Rejected by Plant Head",
      approved_by: String(req.headers["x-user-email"] || "plant@psindustries.in"),
      approved_at: new Date().toISOString(),
    });

    return res.status(200).json({ po: rejected, message: "PO rejected." });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Reject failed";
    return res.status(500).json({ error: message });
  }
}
