import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminDb } from "@/lib/firebase-admin";
import {
  FieldValue,
  loadPOFromFirestore,
  resolveActor,
} from "@/lib/po-firestore";
import { upsertPO } from "@/lib/mock-data";
import { isAwaitingApproval } from "@/lib/types";
import { calculatePORequirementsFromParts } from "@/lib/material-calc-live";
import { issueStock, listActiveRawMaterials } from "@/lib/inventory";

/**
 * POST /api/po/approve
 * Body: { po_id, approved_by: uid, notes?, skip_stock_check?, plant? }
 *
 * Looks up each item in /parts → material_code + weight, then deducts stock.
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
      skip_stock_check?: boolean;
      plant?: string;
    };

    const poId = String(body.po_id || body.id || "").trim();
    if (!poId) {
      return res.status(400).json({ error: "Missing po_id." });
    }

    const existing = await loadPOFromFirestore(poId);
    if (!existing) {
      return res.status(404).json({
        error: `Purchase order not found in Firestore for id "${poId}". Upload/save the PO first.`,
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
    if (!actor.uid || actor.uid === "unknown") {
      return res.status(401).json({
        error: "Missing approved_by user id. Sign in again and retry.",
      });
    }

    const plant = String(
      body.plant || existing.plant || "Noida A-06"
    ).trim();
    const skipStock = body.skip_stock_check === true;

    const inventoryLoaded = (await listActiveRawMaterials()).length > 0;
    const requirements = inventoryLoaded
      ? await calculatePORequirementsFromParts(existing)
      : null;

    if (!skipStock && requirements) {
      if (requirements.missingParts.length > 0) {
        const detail = requirements.missingParts
          .map((c) => `item ${c} not found in parts master`)
          .join("; ");
        return res.status(400).json({
          error: `Cannot approve — ${detail}.`,
          missingParts: requirements.missingParts,
          requirements,
        });
      }

      if (requirements.shortfalls.length > 0) {
        const detail = requirements.shortfalls
          .map((s) =>
            s.status === "missing_material"
              ? `${s.itemCode}: material ${s.materialCode} not in inventory`
              : `${s.itemCode} needs ${s.shortfallKg}kg more of ${s.materialCode}`
          )
          .join(", ");
        return res.status(400).json({
          error: `Material shortfall — stock not deducted and PO not approved: ${detail}.`,
          shortfalls: requirements.shortfalls,
          requirements,
        });
      }
    }

    const notes = String(body.notes || "").trim();
    const ref = getAdminDb().collection("po_uploads").doc(existing.id);

    await ref.set(
      {
        status: "approved",
        approved_by: actor.uid,
        approved_by_email: actor.email !== "unknown" ? actor.email : null,
        approved_at: FieldValue.serverTimestamp(),
        rejection_reason: FieldValue.delete(),
        notes: notes || null,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    const verify = await ref.get();
    const savedStatus = verify.data()?.status;
    if (savedStatus !== "approved") {
      return res.status(500).json({
        error: `Firestore write verification failed (status=${savedStatus}).`,
      });
    }

    const deductions: Array<{
      itemCode: string;
      material: string;
      materialCode: string;
      quantityKg: number;
      movementId: string;
    }> = [];
    const deductionErrors: string[] = [];

    if (!skipStock && requirements) {
      // Aggregate by material code so we issue once per material
      const byMaterial = new Map<
        string,
        { materialCode: string; materialName: string; kg: number; items: string[] }
      >();

      for (const line of requirements.lines) {
        if (line.requiredKg <= 0 || !line.materialCode) continue;
        const prev = byMaterial.get(line.materialCode) || {
          materialCode: line.materialCode,
          materialName: line.materialName,
          kg: 0,
          items: [] as string[],
        };
        prev.kg = Number((prev.kg + line.requiredKg).toFixed(3));
        prev.items.push(line.itemCode);
        byMaterial.set(line.materialCode, prev);
      }

      for (const entry of Array.from(byMaterial.values())) {
        try {
          const result = await issueStock({
            materialCode: entry.materialCode,
            quantityKg: entry.kg,
            reason: `PO Approval: ${existing.po_number}`,
            referenceId: existing.id,
            plant,
            uid: actor.uid,
          });
          deductions.push({
            itemCode: entry.items.join(","),
            material: entry.materialName,
            materialCode: entry.materialCode,
            quantityKg: entry.kg,
            movementId: result.movement.movementId,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Deduction failed";
          deductionErrors.push(`${entry.materialCode}: ${msg}`);
        }
      }

      if (deductionErrors.length > 0 && deductions.length === 0) {
        return res.status(500).json({
          error: "PO approved but stock deduction failed.",
          deductionErrors,
          po_id: existing.id,
        });
      }
    }

    const approved = {
      ...existing,
      status: "approved" as const,
      approved_by: actor.uid,
      approved_at: new Date().toISOString(),
      rejection_reason: undefined,
    };
    upsertPO(approved);

    let message = "PO approved.";
    if (deductions.length > 0) {
      const detail = deductions
        .map((d) => `${d.quantityKg}kg of ${d.materialCode}`)
        .join(", ");
      message = `PO approved. Deducted ${detail} from stock.`;
    } else if (deductionErrors.length > 0) {
      message = `PO approved but ${deductionErrors.length} deduction(s) failed.`;
    }

    return res.status(200).json({
      ok: true,
      po: approved,
      firestorePath: `po_uploads/${existing.id}`,
      message,
      deductions,
      deductionErrors: deductionErrors.length ? deductionErrors : undefined,
      requirements,
    });
  } catch (err) {
    console.error("[po/approve]", err);
    const message = err instanceof Error ? err.message : "Approve failed";
    return res.status(500).json({ error: message });
  }
}
