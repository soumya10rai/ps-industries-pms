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
 * POST /api/po/approve
 * Body: { po_id | id, approved_by?: uid, notes? }
 *
 * Updates Firestore /po_uploads/{po_id}:
 *   status → "approved"
 *   approved_by → user UID
 *   approved_at → server timestamp
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
      approved_by?: string;
      notes?: string;
    };

    const poId = String(body.po_id || body.id || "").trim();
    if (!poId) {
      return res.status(400).json({ error: "Missing po_id." });
    }

    const existing = await loadPOFromFirestore(poId);
    if (!existing) {
      return res.status(404).json({
        error: `Purchase order not found in Firestore for id "${poId}".`,
      });
    }

    if (!isAwaitingApproval(existing.status) && existing.status !== "rejected") {
      return res.status(400).json({
        error: `Cannot approve a PO with status "${existing.status}".`,
      });
    }

    const actor = resolveActor(
      { body: body as Record<string, unknown>, headers: req.headers },
      "unknown"
    );

    const notes = String(body.notes || "").trim();

    await getAdminDb()
      .collection("po_uploads")
      .doc(existing.id)
      .update({
        status: "approved",
        approved_by: actor.uid,
        approved_by_email: actor.email || null,
        approved_at: FieldValue.serverTimestamp(),
        rejection_reason: FieldValue.delete(),
        notes: notes || null,
        updatedAt: FieldValue.serverTimestamp(),
      });

    const approved = {
      ...existing,
      status: "approved" as const,
      approved_by: actor.uid,
      approved_at: new Date().toISOString(),
      rejection_reason: undefined,
    };
    upsertPO(approved);

    return res.status(200).json({
      ok: true,
      po: approved,
      firestorePath: `po_uploads/${existing.id}`,
      message: "PO Approved",
    });
  } catch (err) {
    console.error("[po/approve]", err);
    const message = err instanceof Error ? err.message : "Approve failed";
    return res.status(500).json({ error: message });
  }
}
