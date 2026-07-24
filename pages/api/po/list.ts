import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminDb } from "@/lib/firebase-admin";
import { getPOStore, MOCK_POS } from "@/lib/mock-data";
import type { PurchaseOrder } from "@/lib/types";

/**
 * GET /api/po/list
 * Returns purchase orders from Firestore `po_uploads`, falling back to
 * in-memory + mock fixtures when the collection is empty / unavailable.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const db = getAdminDb();
    let snap;
    try {
      snap = await db
        .collection("po_uploads")
        .orderBy("uploaded_at", "desc")
        .limit(100)
        .get();
    } catch {
      snap = await db.collection("po_uploads").limit(100).get();
    }

    if (!snap.empty) {
      const orders = snap.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          po_number: String(data.po_number ?? ""),
          po_date: String(data.po_date ?? ""),
          customer_code: String(data.customer_code ?? ""),
          customer_name: String(data.customer_name ?? ""),
          delivery_date: data.delivery_date ?? null,
          payment_terms: String(data.payment_terms ?? ""),
          items: Array.isArray(data.items) ? data.items : [],
          total_amount: Number(data.total_amount ?? 0),
          gst: String(data.gst ?? ""),
          status: data.status ?? "pending",
          parse_source: data.parse_source,
          source_file: data.source_file,
          uploaded_by: data.uploaded_by,
          uploaded_at: data.uploaded_at ?? "",
          approved_by: data.approved_by,
          approved_at: data.approved_at,
          rejection_reason: data.rejection_reason,
        } as PurchaseOrder;
      });

      return res.status(200).json({
        ok: true,
        source: "firestore",
        orders,
      });
    }

    // Empty collection — seed list from memory / mocks for first-run UX
    const memory = getPOStore();
    const orders = memory.length > 0 ? memory : structuredClone(MOCK_POS);

    return res.status(200).json({
      ok: true,
      source: "memory",
      orders,
    });
  } catch (err) {
    console.error("[po/list]", err);
    // Soft fallback so UI still works if Admin SDK / index is unavailable
    return res.status(200).json({
      ok: true,
      source: "fallback",
      orders: getPOStore().length ? getPOStore() : structuredClone(MOCK_POS),
      warning:
        err instanceof Error ? err.message : "Firestore unavailable; using local data.",
    });
  }
}
