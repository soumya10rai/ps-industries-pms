import type { NextApiRequest, NextApiResponse } from "next";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { stripUndefined } from "@/lib/firestore-utils";
import { upsertPO } from "@/lib/mock-data";
import { getPart } from "@/lib/parts";
import {
  aggregatePoTax,
  calcLineTax,
  withinTolerance,
} from "@/lib/po-gst";
import {
  INVENTORY_PLANTS,
  type POItem,
  type PurchaseOrder,
  type POStatus,
} from "@/lib/types";

interface SaveItemInput {
  itemCode?: string;
  item_code?: string;
  description?: string;
  hsnCode?: string;
  hsn_code?: string;
  quantity?: number;
  unit?: string;
  uom?: string;
  rate?: number;
  subTotal?: number;
  sub_total?: number;
  cgstPercent?: number;
  cgst_percent?: number;
  cgstAmount?: number;
  cgst_amount?: number;
  sgstPercent?: number;
  sgst_percent?: number;
  sgstAmount?: number;
  sgst_amount?: number;
  igstPercent?: number;
  igst_percent?: number;
  igstAmount?: number;
  igst_amount?: number;
  total?: number;
}

interface SaveBody {
  poId?: string;
  id?: string;
  poNumber?: string;
  po_number?: string;
  customerCode?: string;
  customer_code?: string;
  customerName?: string;
  customer_name?: string;
  poDate?: string;
  po_date?: string;
  deliveryDate?: string;
  delivery_date?: string;
  paymentTerms?: string;
  payment_terms?: string;
  plant?: string;
  pdfUrl?: string;
  pdf_url?: string;
  sourceFile?: string;
  source_file?: string;
  gst?: string;
  interstate?: boolean;
  items?: SaveItemInput[];
  subTotal?: number;
  sub_total?: number;
  totalCgst?: number;
  total_cgst?: number;
  totalSgst?: number;
  total_sgst?: number;
  totalIgst?: number;
  total_igst?: number;
  totalTax?: number;
  total_tax?: number;
  grandTotal?: number;
  grand_total?: number;
  totalAmount?: number;
  total_amount?: number;
  status?: "draft" | "new";
}

function pctInRange(n: number): boolean {
  return Number.isFinite(n) && n >= 0 && n <= 30;
}

function normalizeItems(
  raw: SaveItemInput[],
  interstate: boolean
): { items: POItem[]; errors: string[] } {
  const items: POItem[] = [];
  const errors: string[] = [];

  raw.forEach((item, index) => {
    const lineNo = index + 1;
    const code = String(item.itemCode ?? item.item_code ?? "")
      .trim()
      .toUpperCase();
    const hsn = String(item.hsnCode ?? item.hsn_code ?? "").trim();
    const quantity = Number(item.quantity ?? 0);
    const rate = Number(item.rate ?? 0);

    if (!code) errors.push(`Line ${lineNo}: item code is required.`);
    if (!hsn) errors.push(`Line ${lineNo}: HSN code is required.`);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      errors.push(`Line ${lineNo}: quantity must be > 0.`);
    }
    if (!Number.isFinite(rate) || rate < 0) {
      errors.push(`Line ${lineNo}: rate must be ≥ 0.`);
    }

    const cgstPercent = Number(
      item.cgstPercent ?? item.cgst_percent ?? (interstate ? 0 : 9)
    );
    const sgstPercent = Number(
      item.sgstPercent ?? item.sgst_percent ?? (interstate ? 0 : 9)
    );
    const igstPercent = Number(
      item.igstPercent ?? item.igst_percent ?? (interstate ? 18 : 0)
    );

    if (!pctInRange(cgstPercent)) {
      errors.push(`Line ${lineNo}: CGST % must be 0–30.`);
    }
    if (!pctInRange(sgstPercent)) {
      errors.push(`Line ${lineNo}: SGST % must be 0–30.`);
    }
    if (!pctInRange(igstPercent)) {
      errors.push(`Line ${lineNo}: IGST % must be 0–30.`);
    }

    const computed = calcLineTax({
      quantity,
      rate,
      cgstPercent: interstate ? 0 : cgstPercent,
      sgstPercent: interstate ? 0 : sgstPercent,
      igstPercent: interstate ? igstPercent : 0,
      interstate,
    });

    const claimedSub = item.subTotal ?? item.sub_total;
    if (
      claimedSub !== undefined &&
      !withinTolerance(Number(claimedSub), computed.subTotal, 0.01)
    ) {
      errors.push(
        `Line ${lineNo}: subTotal mismatch (expected ${computed.subTotal}).`
      );
    }

    const claimedTotal = item.total;
    if (
      claimedTotal !== undefined &&
      !withinTolerance(Number(claimedTotal), computed.total, 0.01)
    ) {
      errors.push(
        `Line ${lineNo}: line total mismatch (expected ${computed.total}).`
      );
    }

    items.push({
      item_code: code,
      description: String(item.description ?? "").trim(),
      part_code: code || null,
      hsn_code: hsn,
      quantity,
      uom: String(item.unit ?? item.uom ?? "NOS").toUpperCase() || "NOS",
      rate,
      sub_total: computed.subTotal,
      cgst_percent: computed.cgstPercent,
      cgst_amount: computed.cgstAmount,
      sgst_percent: computed.sgstPercent,
      sgst_amount: computed.sgstAmount,
      igst_percent: computed.igstPercent,
      igst_amount: computed.igstAmount,
      total: computed.total,
      material_grade: null,
      colour: null,
    });
  });

  return { items, errors };
}

/**
 * POST /api/po/save
 * Validated structured save for manual PO entry (with GST + HSN).
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
    const body = (req.body ?? {}) as SaveBody;
    const poNumber = String(body.poNumber ?? body.po_number ?? "").trim();
    const customerCode = String(body.customerCode ?? body.customer_code ?? "")
      .trim()
      .toUpperCase();
    const customerName = String(
      body.customerName ?? body.customer_name ?? ""
    ).trim();
    const poDate = String(body.poDate ?? body.po_date ?? "").trim();
    const deliveryDate = String(
      body.deliveryDate ?? body.delivery_date ?? ""
    ).trim();
    const paymentTerms = String(
      body.paymentTerms ?? body.payment_terms ?? ""
    ).trim();
    const plant = String(body.plant ?? "").trim();
    const pdfUrl = String(body.pdfUrl ?? body.pdf_url ?? "").trim() || null;
    const sourceFile =
      String(body.sourceFile ?? body.source_file ?? "").trim() || undefined;
    const interstate = body.interstate === true;
    const status: POStatus = body.status === "draft" ? "draft" : "new";
    const existingId = String(body.poId ?? body.id ?? "").trim();

    if (!poNumber) {
      return res.status(400).json({ error: "PO number is required." });
    }
    if (!customerCode || !customerName) {
      return res.status(400).json({ error: "Customer is required." });
    }
    if (!poDate) {
      return res.status(400).json({ error: "PO date is required." });
    }
    if (!deliveryDate) {
      return res.status(400).json({ error: "Delivery date is required." });
    }
    if (!plant || !(INVENTORY_PLANTS as readonly string[]).includes(plant)) {
      return res.status(400).json({
        error: `Invalid plant. Use one of: ${INVENTORY_PLANTS.join(", ")}`,
      });
    }

    const rawItems = Array.isArray(body.items) ? body.items : [];
    if (rawItems.length === 0) {
      return res
        .status(400)
        .json({ error: "At least one line item is required." });
    }

    const { items, errors } = normalizeItems(rawItems, interstate);
    if (errors.length > 0) {
      return res.status(400).json({ error: errors[0], errors });
    }

    const totals = aggregatePoTax(
      items.map((i) => ({
        subTotal: i.sub_total!,
        cgstAmount: i.cgst_amount!,
        sgstAmount: i.sgst_amount!,
        igstAmount: i.igst_amount!,
        total: i.total,
      }))
    );

    const claimedGrand = Number(
      body.grandTotal ??
        body.grand_total ??
        body.totalAmount ??
        body.total_amount ??
        totals.grandTotal
    );
    if (!withinTolerance(claimedGrand, totals.grandTotal, 1)) {
      return res.status(400).json({
        error: `Grand total mismatch. Expected ~${totals.grandTotal}, got ${claimedGrand}.`,
      });
    }

    const claimedSub = body.subTotal ?? body.sub_total;
    if (
      claimedSub !== undefined &&
      !withinTolerance(Number(claimedSub), totals.subTotal, 1)
    ) {
      return res.status(400).json({
        error: `Sub total mismatch. Expected ~${totals.subTotal}, got ${claimedSub}.`,
      });
    }

    const missingCodes: string[] = [];
    for (const item of items) {
      const part = await getPart(item.item_code);
      if (!part) missingCodes.push(item.item_code);
    }
    if (missingCodes.length > 0) {
      return res.status(400).json({
        error: `Unknown item code(s) not in parts master: ${missingCodes.join(", ")}`,
        missingCodes,
      });
    }

    const db = getAdminDb();

    const dupSnap = await db
      .collection("po_uploads")
      .where("po_number", "==", poNumber)
      .limit(5)
      .get();
    const conflict = dupSnap.docs.find((d) => d.id !== existingId);
    if (conflict) {
      return res.status(409).json({
        error: `PO number "${poNumber}" already exists.`,
        existingId: conflict.id,
      });
    }

    if (existingId) {
      const existing = await db.collection("po_uploads").doc(existingId).get();
      if (existing.exists) {
        const prev = existing.data() as Record<string, unknown>;
        if (prev.status && prev.status !== "draft") {
          return res.status(400).json({
            error: `Cannot edit a PO with status "${String(prev.status)}".`,
          });
        }
      }
    }

    const uploadedBy = String(
      req.headers["x-user-email"] || req.headers["x-user-uid"] || "unknown"
    );
    const nowIso = new Date().toISOString();
    const docId = existingId || `po_${Date.now()}`;

    const gstLabel = interstate
      ? `IGST ${items[0]?.igst_percent ?? 18}%`
      : `CGST ${items[0]?.cgst_percent ?? 9}% + SGST ${items[0]?.sgst_percent ?? 9}%`;

    const saved: PurchaseOrder = {
      id: docId,
      po_number: poNumber,
      po_date: poDate,
      customer_code: customerCode,
      customer_name: customerName,
      delivery_date: deliveryDate,
      payment_terms: paymentTerms,
      items,
      sub_total: totals.subTotal,
      total_cgst: totals.totalCgst,
      total_sgst: totals.totalSgst,
      total_igst: totals.totalIgst,
      total_tax: totals.totalTax,
      grand_total: totals.grandTotal,
      total_amount: totals.grandTotal,
      interstate,
      gst: String(body.gst ?? gstLabel),
      status,
      plant,
      pdf_url: pdfUrl,
      parse_source: "manual",
      source_file: sourceFile,
      uploaded_by: uploadedBy,
      uploaded_at: nowIso,
    };

    await db
      .collection("po_uploads")
      .doc(docId)
      .set(
        stripUndefined({
          ...saved,
          updatedAt: FieldValue.serverTimestamp(),
          ...(existingId ? {} : { createdAt: FieldValue.serverTimestamp() }),
        }),
        { merge: true }
      );

    upsertPO(saved);

    return res.status(200).json({
      ok: true,
      po: saved,
      firestorePath: `po_uploads/${docId}`,
      message:
        status === "draft" ? "Draft saved." : "PO submitted for approval.",
    });
  } catch (err) {
    console.error("[po/save]", err);
    const message = err instanceof Error ? err.message : "Save failed";
    return res.status(500).json({ error: message });
  }
}
