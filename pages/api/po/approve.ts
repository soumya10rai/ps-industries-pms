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
    // Also allow lookup by po_number
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
 * Marks a purchase order as approved (Plant Head) in Firestore + memory.
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
    const { id } = req.body as { id?: string };
    if (!id) {
      return res.status(400).json({ error: "Missing PO id." });
    }

    const existing = await loadPO(id);
    if (!existing) {
      return res.status(404).json({ error: "Purchase order not found." });
    }

    if (existing.status !== "pending" && existing.status !== "rejected") {
      return res.status(400).json({
        error: `Cannot approve a PO with status "${existing.status}".`,
      });
    }

    const approved: PurchaseOrder = {
      ...existing,
      status: "approved",
      approved_by: String(
        req.headers["x-user-email"] || "plant@psindustries.in"
      ),
      approved_at: new Date().toISOString(),
      rejection_reason: undefined,
    };

    await getAdminDb()
      .collection("po_uploads")
      .doc(approved.id)
      .set(
        {
          ...approved,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

    upsertPO(approved);

    return res.status(200).json({ po: approved, message: "PO approved." });
  } catch (err) {
    console.error("[po/approve]", err);
    const message = err instanceof Error ? err.message : "Approve failed";
    return res.status(500).json({ error: message });
  }
}
