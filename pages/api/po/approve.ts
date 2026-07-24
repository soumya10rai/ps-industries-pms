import type { NextApiRequest, NextApiResponse } from "next";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { findPO, upsertPO } from "@/lib/mock-data";
import { isAwaitingApproval, type PurchaseOrder } from "@/lib/types";

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
 * POST /api/po/approve
 * Body: { id, notes? }
 * Updates Firestore po_uploads: status → approved, approved_by, approved_at.
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
    const { id, notes } = req.body as { id?: string; notes?: string };
    if (!id) {
      return res.status(400).json({ error: "Missing PO id." });
    }

    const existing = await loadPO(id);
    if (!existing) {
      return res.status(404).json({ error: "Purchase order not found." });
    }

    if (!isAwaitingApproval(existing.status) && existing.status !== "rejected") {
      return res.status(400).json({
        error: `Cannot approve a PO with status "${existing.status}".`,
      });
    }

    const approvedBy = String(
      req.headers["x-user-email"] || "plant@psindustries.in"
    );
    const approvedAt = new Date().toISOString();

    const approved: PurchaseOrder = {
      ...existing,
      status: "approved",
      approved_by: approvedBy,
      approved_at: approvedAt,
      rejection_reason: undefined,
    };

    await getAdminDb()
      .collection("po_uploads")
      .doc(approved.id)
      .set(
        {
          ...approved,
          notes: notes || null,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

    upsertPO(approved);

    return res.status(200).json({
      ok: true,
      po: approved,
      message: "PO Approved",
    });
  } catch (err) {
    console.error("[po/approve]", err);
    const message = err instanceof Error ? err.message : "Approve failed";
    return res.status(500).json({ error: message });
  }
}
