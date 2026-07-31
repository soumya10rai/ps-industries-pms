import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminDb } from "@/lib/firebase-admin";
import {
  FieldValue,
  loadPOFromFirestore,
  resolveActor,
} from "@/lib/po-firestore";
import { upsertPO } from "@/lib/mock-data";
import { isAwaitingApproval } from "@/lib/types";
import { calculatePOMaterialsLive } from "@/lib/material-calc-live";
import {
  issueStock,
  listActiveRawMaterials,
  resolveMaterialCode,
} from "@/lib/inventory";

/**
 * POST /api/po/approve
 * Body: { po_id, approved_by: uid, notes?, skip_stock_check?, plant? }
 *
 * On approval with sufficient stock: auto-deduct materials and log movements.
 * On shortfall: do not approve or deduct; return shortfall list.
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

    const plant = String(body.plant || "Noida A-06").trim();
    const skipStock = body.skip_stock_check === true;

    // Only gate / deduct when inventory has been loaded into Firestore
    const inventoryLoaded = (await listActiveRawMaterials()).length > 0;
    const materialCheck = inventoryLoaded
      ? await calculatePOMaterialsLive(existing)
      : null;

    if (
      !skipStock &&
      materialCheck &&
      !materialCheck.all_stock_available
    ) {
      return res.status(400).json({
        error: "Material shortfall — stock not deducted and PO not approved.",
        shortfalls: materialCheck.lines.filter((l) => l.status === "shortfall"),
        check: materialCheck,
      });
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

    // Auto-deduct stock for each OK line when inventory is in use
    const deductions: Array<{
      material: string;
      materialCode: string;
      quantityKg: number;
      movementId: string;
    }> = [];
    const deductionErrors: string[] = [];

    if (!skipStock && materialCheck) {
      for (const line of materialCheck.lines) {
        if (line.required_kg <= 0) continue;

        let code = line.material_code;
        let name = line.material;
        if (!code) {
          const resolved = await resolveMaterialCode(line.material);
          if (!resolved) {
            deductionErrors.push(
              `No inventory match for material "${line.material}".`
            );
            continue;
          }
          code = resolved.materialCode;
          name = resolved.materialName;
        }

        try {
          const result = await issueStock({
            materialCode: code,
            quantityKg: line.required_kg,
            reason: `PO Approval: ${existing.po_number}`,
            referenceId: existing.id,
            plant,
            uid: actor.uid,
          });
          deductions.push({
            material: name,
            materialCode: code,
            quantityKg: line.required_kg,
            movementId: result.movement.movementId,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Deduction failed";
          deductionErrors.push(`${code}: ${msg}`);
        }
      }

      // If any deduction failed after approval, surface partial failure
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

    const deductionSummary =
      deductions.length > 0
        ? deductions
            .map((d) => `${d.quantityKg} kg of ${d.material}`)
            .join(", ")
        : null;

    return res.status(200).json({
      ok: true,
      po: approved,
      firestorePath: `po_uploads/${existing.id}`,
      message: deductionSummary
        ? `Approved. Deducted ${deductionSummary} from stock.`
        : "PO Approved",
      deductions,
      deductionErrors: deductionErrors.length ? deductionErrors : undefined,
      materialCheck,
    });
  } catch (err) {
    console.error("[po/approve]", err);
    const message = err instanceof Error ? err.message : "Approve failed";
    return res.status(500).json({ error: message });
  }
}
