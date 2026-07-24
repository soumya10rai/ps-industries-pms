import type { NextApiRequest, NextApiResponse } from "next";
import { findPO, upsertPO } from "@/lib/mock-data";

/**
 * POST /api/po/approve
 * Marks a purchase order as approved (Plant Head).
 */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { id } = req.body as { id?: string };
    if (!id) {
      return res.status(400).json({ error: "Missing PO id." });
    }

    const existing = findPO(id);
    if (!existing) {
      return res.status(404).json({ error: "Purchase order not found." });
    }

    if (existing.status !== "pending" && existing.status !== "rejected") {
      return res.status(400).json({
        error: `Cannot approve a PO with status "${existing.status}".`,
      });
    }

    const approved = upsertPO({
      ...existing,
      status: "approved",
      approved_by: String(req.headers["x-user-email"] || "plant@psindustries.in"),
      approved_at: new Date().toISOString(),
      rejection_reason: undefined,
    });

    return res.status(200).json({ po: approved, message: "PO approved." });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Approve failed";
    return res.status(500).json({ error: message });
  }
}
