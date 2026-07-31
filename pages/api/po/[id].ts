import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminDb } from "@/lib/firebase-admin";
import { mapPODoc } from "@/lib/po-firestore";

/**
 * GET    /api/po/[id]  — fetch one PO
 * DELETE /api/po/[id]  — delete a draft PO only
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const id = String(req.query.id ?? "").trim();
  if (!id) {
    return res.status(400).json({ error: "Missing PO id." });
  }

  const db = getAdminDb();
  const ref = db.collection("po_uploads").doc(id);

  try {
    if (req.method === "GET") {
      const doc = await ref.get();
      if (!doc.exists) {
        return res.status(404).json({ error: "Purchase order not found." });
      }
      return res.status(200).json({
        ok: true,
        po: mapPODoc(doc.id, doc.data() as Record<string, unknown>),
      });
    }

    if (req.method === "DELETE") {
      const doc = await ref.get();
      if (!doc.exists) {
        return res.status(404).json({ error: "Purchase order not found." });
      }
      const data = doc.data() as Record<string, unknown>;
      if (data.status !== "draft") {
        return res.status(400).json({
          error: `Only draft POs can be deleted (status is "${String(data.status)}").`,
        });
      }
      await ref.delete();
      return res.status(200).json({ ok: true, deleted: id });
    }

    res.setHeader("Allow", "GET, DELETE");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("[po/id]", err);
    const message = err instanceof Error ? err.message : "Request failed";
    return res.status(500).json({ error: message });
  }
}
