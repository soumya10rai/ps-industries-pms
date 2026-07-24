import type { NextApiRequest, NextApiResponse } from "next";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { upsertPO } from "@/lib/mock-data";
import type { PurchaseOrder } from "@/lib/types";

/**
 * POST /api/po/save
 * Persists a parsed purchase order to Firestore collection `po_uploads`
 * and mirrors it into the in-memory store for the current process.
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
    const body = req.body as { po?: PurchaseOrder };
    const po = body?.po;

    if (!po || !po.po_number || !Array.isArray(po.items) || po.items.length === 0) {
      return res.status(400).json({ error: "Invalid purchase order payload." });
    }

    const uploadedBy = String(
      req.headers["x-user-email"] || po.uploaded_by || "unknown"
    );
    const nowIso = new Date().toISOString();
    const docId = po.id || `po_${Date.now()}`;

    const saved: PurchaseOrder = {
      ...po,
      id: docId,
      status: po.status || "pending",
      uploaded_by: uploadedBy,
      uploaded_at: po.uploaded_at || nowIso,
      parse_source: po.parse_source || "upload",
    };

    const db = getAdminDb();
    const ref = db.collection("po_uploads").doc(docId);

    await ref.set(
      {
        ...saved,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // Keep process-local cache in sync for list/approve during this session
    upsertPO(saved);

    return res.status(200).json({
      ok: true,
      po: saved,
      firestorePath: `po_uploads/${docId}`,
      message: "PO saved successfully",
    });
  } catch (err) {
    console.error("[po/save]", err);
    const message = err instanceof Error ? err.message : "Save failed";
    return res.status(500).json({ error: message });
  }
}
