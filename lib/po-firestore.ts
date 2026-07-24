import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import type { PurchaseOrder } from "@/lib/types";

export function mapPODoc(
  id: string,
  data: Record<string, unknown>
): PurchaseOrder {
  return {
    id,
    po_number: String(data.po_number ?? ""),
    po_date: String(data.po_date ?? ""),
    customer_code: String(data.customer_code ?? ""),
    customer_name: String(data.customer_name ?? ""),
    delivery_date: (data.delivery_date as string | null) ?? null,
    payment_terms: String(data.payment_terms ?? ""),
    items: Array.isArray(data.items)
      ? (data.items as PurchaseOrder["items"])
      : [],
    total_amount: Number(data.total_amount ?? 0),
    gst: String(data.gst ?? ""),
    status: (data.status as PurchaseOrder["status"]) ?? "new",
    parse_source: data.parse_source as string | undefined,
    source_file: data.source_file as string | undefined,
    uploaded_by: data.uploaded_by as string | undefined,
    uploaded_at: String(data.uploaded_at ?? ""),
    approved_by: data.approved_by as string | undefined,
    approved_at:
      typeof data.approved_at === "string"
        ? data.approved_at
        : data.approved_at &&
            typeof (data.approved_at as { toDate?: () => Date }).toDate ===
              "function"
          ? (data.approved_at as { toDate: () => Date }).toDate().toISOString()
          : undefined,
    rejection_reason: data.rejection_reason as string | undefined,
  };
}

/**
 * Load a PO from Firestore by document id or po_number.
 * Does NOT use the in-memory mock store — approvals must hit Firestore.
 */
export async function loadPOFromFirestore(
  poIdOrNumber: string
): Promise<PurchaseOrder | null> {
  const db = getAdminDb();
  const key = poIdOrNumber.trim();
  if (!key) return null;

  const byId = await db.collection("po_uploads").doc(key).get();
  if (byId.exists) {
    return mapPODoc(byId.id, byId.data() as Record<string, unknown>);
  }

  const byNumber = await db
    .collection("po_uploads")
    .where("po_number", "==", key)
    .limit(1)
    .get();

  if (!byNumber.empty) {
    const doc = byNumber.docs[0]!;
    return mapPODoc(doc.id, doc.data() as Record<string, unknown>);
  }

  return null;
}

export function resolveActor(
  req: {
    body?: Record<string, unknown>;
    headers: { [key: string]: string | string[] | undefined };
  },
  fallback = "unknown"
): { uid: string; email: string } {
  const headerUid = String(req.headers["x-user-uid"] ?? "").trim();
  const headerEmail = String(req.headers["x-user-email"] ?? "").trim();
  const bodyUid = String(
    req.body?.approved_by ?? req.body?.uid ?? ""
  ).trim();

  return {
    uid: bodyUid || headerUid || fallback,
    email: headerEmail || fallback,
  };
}

export { FieldValue };
