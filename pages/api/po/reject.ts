import type { NextApiRequest, NextApiResponse } from "next";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { findPO, upsertPO } from "@/lib/mock-data";
import type { PurchaseOrder } from "@/lib/types";

async function loadPO(id: string): Promise<PurchaseOrder | null> {
  const memory = findPO(id);
  if (memory) return memory;

  const db = getAdminDb();
  const snap = await db.collection("po_uploads").doc(id).get();
  if (!snap.exists) {
    const byNumber = await db
      .collection("po_uploads")
      .where("po_number", "==", id)
      .limit(1)
      .get();
    if (byNumber.empty) return null;
    const doc = byNumber.docs[0]!;
    return { id: doc.id, ...(doc.data() as Omit<PurchaseOrder, "id">) };
  }
  return { id: snap.id, ...(snap.data() as Omit<PurchaseOrder, "id">) };
}

/**
 * POST /api/po/reject
 * Marks a purchase order as rejected in Firestore + memory.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { id, reason } = req.body as { id?: string; reason?: string };
    if (!id) {
      return res.status(400).json({ error: "Missing PO id." });
    }

    const existing = await loadPO(id);
    if (!existing) {
      return res.status(404).json({ error: "Purchase order not found." });
    }

    if (existing.status !== "pending") {
      return res.status(400).json({
        error: `Cannot reject a PO with status "${existing.status}".`,
      });
    }

    const rejected: PurchaseOrder = {
      ...existing,
      status: "rejected",
      rejection_reason: reason || "Rejected by Plant Head",
      approved_by: String(
        req.headers["x-user-email"] || "plant@psindustries.in"
      ),
      approved_at: new Date().toISOString(),
    };

    await getAdminDb()
      .collection("po_uploads")
      .doc(rejected.id)
      .set(
        {
          ...rejected,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

    upsertPO(rejected);

    return res.status(200).json({ po: rejected, message: "PO rejected." });
  } catch (err) {
    console.error("[po/reject]", err);
    const message = err instanceof Error ? err.message : "Reject failed";
    return res.status(500).json({ error: message });
  }
}
