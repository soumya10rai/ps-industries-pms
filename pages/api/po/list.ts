import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminDb } from "@/lib/firebase-admin";
import { mapPODoc } from "@/lib/po-firestore";
import { isAwaitingApproval, type PurchaseOrder } from "@/lib/types";

/**
 * GET /api/po/list
 * Optional query: ?status=new|pending|approved|rejected|all
 * `status=new` returns POs awaiting approval (`new` + legacy `pending`).
 *
 * Always reads from Firestore `po_uploads` (no mock fallback for approval queues).
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const statusFilter = String(req.query.status ?? "all").toLowerCase();

  try {
    const db = getAdminDb();
    let snap;
    try {
      snap = await db
        .collection("po_uploads")
        .orderBy("uploaded_at", "desc")
        .limit(200)
        .get();
    } catch {
      snap = await db.collection("po_uploads").limit(200).get();
    }

    let orders: PurchaseOrder[] = snap.docs.map((doc) =>
      mapPODoc(doc.id, doc.data() as Record<string, unknown>)
    );

    if (statusFilter === "new") {
      orders = orders.filter((o) => isAwaitingApproval(o.status));
    } else if (statusFilter !== "all") {
      orders = orders.filter((o) => o.status === statusFilter);
    }

    return res.status(200).json({
      ok: true,
      source: "firestore",
      status: statusFilter,
      count: orders.length,
      orders,
    });
  } catch (err) {
    console.error("[po/list]", err);
    return res.status(500).json({
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : "Failed to load purchase orders from Firestore.",
      orders: [],
    });
  }
}
