import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminDb } from "@/lib/firebase-admin";
import {
  PART_WEIGHT_GRAMS,
  SCRAP_PERCENT,
  calculatePOMaterials,
  type POMaterialCheck,
} from "@/lib/material-calc";
import { calculatePOMaterialsLive } from "@/lib/material-calc-live";
import { getPOStore, MOCK_POS } from "@/lib/mock-data";
import type { PurchaseOrder } from "@/lib/types";

function mapDoc(id: string, data: Record<string, unknown>): PurchaseOrder {
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
    approved_at: data.approved_at as string | undefined,
    rejection_reason: data.rejection_reason as string | undefined,
  };
}

async function loadApprovedPOs(): Promise<PurchaseOrder[]> {
  try {
    const db = getAdminDb();
    let snap;
    try {
      snap = await db
        .collection("po_uploads")
        .where("status", "==", "approved")
        .limit(100)
        .get();
    } catch {
      snap = await db.collection("po_uploads").limit(200).get();
    }

    if (!snap.empty) {
      return snap.docs
        .map((d) => mapDoc(d.id, d.data() as Record<string, unknown>))
        .filter((po) => po.status === "approved");
    }
  } catch (err) {
    console.error("[material-calc] Firestore load failed:", err);
  }

  const memory = getPOStore().filter((p) => p.status === "approved");
  if (memory.length) return memory;
  return structuredClone(MOCK_POS).filter((p) => p.status === "approved");
}

/**
 * GET  /api/material-calc/calculate — all approved POs with live stock
 * POST /api/material-calc/calculate — single PO by id / po_number
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    if (req.method === "GET") {
      const approved = await loadApprovedPOs();
      const checks: POMaterialCheck[] = [];
      for (const po of approved) {
        checks.push(await calculatePOMaterialsLive(po));
      }
      return res.status(200).json({
        ok: true,
        formula: {
          part_weight_grams: PART_WEIGHT_GRAMS,
          scrap_percent: SCRAP_PERCENT,
          expression:
            "(part_weight_grams / 1000) * quantity * (1 + scrap_percent/100)",
        },
        stock_source: "raw_materials",
        count: checks.length,
        checks,
      });
    }

    if (req.method === "POST") {
      const poId = String(req.body?.poId ?? req.body?.po_number ?? "").trim();
      if (!poId) {
        return res.status(400).json({ error: "Provide poId or po_number." });
      }

      const approved = await loadApprovedPOs();
      const po =
        approved.find((p) => p.id === poId || p.po_number === poId) || null;

      if (!po) {
        try {
          const db = getAdminDb();
          const doc = await db.collection("po_uploads").doc(poId).get();
          if (doc.exists) {
            const mapped = mapDoc(
              doc.id,
              doc.data() as Record<string, unknown>
            );
            const check = await calculatePOMaterialsLive(mapped);
            return res.status(200).json({ ok: true, check });
          }
        } catch {
          // ignore
        }
        return res.status(404).json({ error: "Purchase order not found." });
      }

      return res.status(200).json({
        ok: true,
        check: await calculatePOMaterialsLive(po),
      });
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Material calculation failed.";
    // Fallback to sync calc with mock stock if live fails hard
    try {
      if (req.method === "GET") {
        const approved = await loadApprovedPOs();
        return res.status(200).json({
          ok: true,
          stock_source: "fallback",
          count: approved.length,
          checks: approved.map((po) => calculatePOMaterials(po)),
          warning: message,
        });
      }
    } catch {
      // ignore
    }
    return res.status(500).json({ error: message });
  }
}
