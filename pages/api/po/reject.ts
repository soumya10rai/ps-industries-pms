import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminDb } from "@/lib/firebase-admin";
import {
  FieldValue,
  loadPOFromFirestore,
  resolveActor,
} from "@/lib/po-firestore";
import { upsertPO } from "@/lib/mock-data";
import { isAwaitingApproval } from "@/lib/types";

/**
 * POST /api/po/reject
 * Body: { po_id, rejection_reason, approved_by? }
 *
 * Firestore /po_uploads/{po_id}:
 *   status = "rejected"
 *   rejection_reason = notes
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
    const body = (req.body ?? {}) as {
      po_id?: string;
      id?: string;
      rejection_reason?: string;
      reason?: string;
      notes?: string;
      approved_by?: string;
    };

    const poId = String(body.po_id || body.id || "").trim();
    const reason = String(
      body.rejection_reason || body.reason || body.notes || ""
    ).trim();

    if (!poId) {
      return res.status(400).json({ error: "Missing po_id." });
    }
    if (!reason) {
      return res.status(400).json({
        error: "Notes are required to reject a purchase order.",
      });
    }

    const existing = await loadPOFromFirestore(poId);
    if (!existing) {
      return res.status(404).json({
        error: `Purchase order not found in Firestore for id "${poId}". Upload/save the PO first.`,
      });
    }

    if (!isAwaitingApproval(existing.status)) {
      return res.status(400).json({
        error: `Cannot reject a PO with status "${existing.status}".`,
      });
    }

    const actor = resolveActor(
      { body: body as Record<string, unknown>, headers: req.headers },
      "unknown"
    );

    const ref = getAdminDb().collection("po_uploads").doc(existing.id);

    await ref.set(
      {
        status: "rejected",
        rejection_reason: reason,
        notes: reason,
        rejected_by: actor.uid !== "unknown" ? actor.uid : null,
        approved_by: actor.uid !== "unknown" ? actor.uid : null,
        approved_at: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    const verify = await ref.get();
    if (verify.data()?.status !== "rejected") {
      return res.status(500).json({
        error: "Firestore write verification failed.",
      });
    }

    const rejected = {
      ...existing,
      status: "rejected" as const,
      rejection_reason: reason,
      approved_by: actor.uid,
      approved_at: new Date().toISOString(),
    };
    upsertPO(rejected);

    return res.status(200).json({
      ok: true,
      po: rejected,
      firestorePath: `po_uploads/${existing.id}`,
      message: "PO Rejected",
    });
  } catch (err) {
    console.error("[po/reject]", err);
    const message = err instanceof Error ? err.message : "Reject failed";
    return res.status(500).json({ error: message });
  }
}
