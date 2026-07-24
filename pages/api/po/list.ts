import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminDb } from "@/lib/firebase-admin";
import { getPOStore, MOCK_POS } from "@/lib/mock-data";
import { isAwaitingApproval, type PurchaseOrder } from "@/lib/types";

function mapDoc(id: string, data: Record<string, unknown>): PurchaseOrder {
  return {
    id,
    po_number: String(data.po_number ?? ""),
    po_date: String(data.po_date ?? ""),
    customer_code: String(data.customer_code ?? ""),
    customer_name: String(data.customer_name ?? ""),
    delivery_date: (data.delivery_date as string | null) ?? null,
    payment_terms: String(data.payment_terms ?? ""),
    items: Array.isArray(data.items) ? (data.items as PurchaseOrder["items"]) : [],
    total_amount: Number(data.total_amount ?? 0),
    gst: String(data.gst ?? ""),
    status: (data.status as PurchaseOrder["status"]) ?? "new",
    parse_source: data.parse_source as string | undefined,
    source_file: data.source_file as string | undefined,
    uploaded_by: data.uploaded_by as string | undefined,
    uploaded_at: String(data.uploaded_at ?? ""),
    approved_by: data.approved_by as string | undefined,
    approved_at: data.approved_at as string | undefined,
    rejection_reason: data.rejection_reason as string | undefined,
  };
}

/**
 * GET /api/po/list
 * Optional query: ?status=new|pending|approved|rejected|all
 * `status=new` returns POs awaiting approval (`new` + legacy `pending`).
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

    let orders: PurchaseOrder[] = !snap.empty
      ? snap.docs.map((doc) => mapDoc(doc.id, doc.data() as Record<string, unknown>))
      : getPOStore().length > 0
        ? getPOStore()
        : structuredClone(MOCK_POS);

    if (statusFilter === "new") {
      orders = orders.filter((o) => isAwaitingApproval(o.status));
    } else if (statusFilter !== "all") {
      orders = orders.filter((o) => o.status === statusFilter);
    }

    return res.status(200).json({
      ok: true,
      source: snap && !snap.empty ? "firestore" : "memory",
      status: statusFilter,
      orders,
    });
  } catch (err) {
    console.error("[po/list]", err);
    let orders =
      getPOStore().length > 0 ? getPOStore() : structuredClone(MOCK_POS);
    if (statusFilter === "new") {
      orders = orders.filter((o) => isAwaitingApproval(o.status));
    } else if (statusFilter !== "all") {
      orders = orders.filter((o) => o.status === statusFilter);
    }
    return res.status(200).json({
      ok: true,
      source: "fallback",
      status: statusFilter,
      orders,
      warning:
        err instanceof Error
          ? err.message
          : "Firestore unavailable; using local data.",
    });
  }
}
