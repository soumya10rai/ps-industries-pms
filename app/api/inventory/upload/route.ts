import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import {
  canWriteInventory,
  getInventorySession,
} from "@/lib/inventory-auth";
import { parseInventoryExcel } from "@/lib/inventory-parser";
import {
  createStockMovement,
  inventoryDb,
} from "@/lib/inventory";
import { stripUndefined } from "@/lib/firestore-utils";
import { INVENTORY_PLANTS } from "@/lib/types";

export const runtime = "nodejs";

/** Sheet names may arrive as repeated fields or one JSON/comma-separated value. */
function readSheetNames(form: FormData): string[] {
  const values = form.getAll("sheets");
  const names: string[] = [];

  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          names.push(...parsed.map((v) => String(v)));
          continue;
        }
      } catch {
        // fall through to comma handling
      }
    }
    names.push(...trimmed.split(",").map((v) => v.trim()));
  }

  return names.filter(Boolean);
}

/**
 * POST /api/inventory/upload
 * multipart/form-data: file + plant (+ optional sheets)
 */
export async function POST(request: NextRequest) {
  const session = await getInventorySession(request);
  if (!session || !canWriteInventory(session.role)) {
    return NextResponse.json(
      { error: "Unauthorized. store_manager, plant_head, or admin required." },
      { status: 401 }
    );
  }

  let uploadId = "";
  const db = inventoryDb();

  try {
    const form = await request.formData();
    const file = form.get("file");
    const plant = String(form.get("plant") ?? "").trim();
    const sheetNames = readSheetNames(form);

    if (!plant || !(INVENTORY_PLANTS as readonly string[]).includes(plant)) {
      return NextResponse.json(
        {
          error: `Invalid plant. Use one of: ${INVENTORY_PLANTS.join(", ")}`,
        },
        { status: 400 }
      );
    }

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "Excel file is required (field name: file)." },
        { status: 400 }
      );
    }

    const fileName = file.name || "inventory.xlsx";
    const buffer = Buffer.from(await file.arrayBuffer());

    const uploadRef = db.collection("inventory_uploads").doc();
    uploadId = uploadRef.id;

    await uploadRef.set({
      uploadId,
      fileName,
      uploadedBy: session.uid,
      uploadedAt: FieldValue.serverTimestamp(),
      totalItems: 0,
      itemsAdded: 0,
      itemsUpdated: 0,
      isLatest: false,
      plant,
      status: "processing",
    });

    const parsed = parseInventoryExcel(
      buffer,
      sheetNames.length > 0 ? { sheetNames } : {}
    );

    if (parsed.items.length === 0) {
      await uploadRef.set(
        {
          status: "failed",
          warnings: parsed.warnings,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      return NextResponse.json(
        {
          error: "No valid inventory rows found in Excel.",
          warnings: parsed.warnings,
          sheets: parsed.sheets,
          uploadId,
        },
        { status: 400 }
      );
    }

    let itemsAdded = 0;
    let itemsUpdated = 0;

    for (const row of parsed.items) {
      const ref = db.collection("raw_materials").doc(row.materialCode);
      const existing = await ref.get();

      // Rate is not in the RM workbook — preserve whatever is already recorded.
      let ratePerKg = 0;
      if (existing.exists) {
        const data = existing.data() as Record<string, unknown>;
        ratePerKg = Number(data.ratePerKg ?? 0);
        itemsUpdated += 1;
      } else {
        itemsAdded += 1;
      }

      await ref.set(
        stripUndefined({
          materialCode: row.materialCode,
          materialName: row.materialName,
          materialGroup: row.materialGroup,
          materialType: row.materialType,
          currentStockKg: row.currentStockKg,
          reorderLevelKg: row.reorderLevelKg,
          unit: row.unit,
          location: plant,
          ratePerKg,
          partyName: row.partyName,
          lastUpdatedAt: FieldValue.serverTimestamp(),
          lastUpdatedBy: session.uid,
          isActive: true,
        }),
        { merge: true }
      );

      await createStockMovement({
        materialCode: row.materialCode,
        materialName: row.materialName,
        type: "opening_balance",
        quantityKg: row.currentStockKg,
        balanceAfterKg: row.currentStockKg,
        reason: `Initial Excel Upload: ${fileName}`,
        referenceId: uploadId,
        createdBy: session.uid,
        plant,
      });
    }

    // Mark previous uploads for this plant as not latest. Legacy docs written
    // without a plant are cleared too, so exactly one upload stays flagged.
    const prevSnap = await db
      .collection("inventory_uploads")
      .where("isLatest", "==", true)
      .get();

    const batch = db.batch();
    for (const doc of prevSnap.docs) {
      if (doc.id === uploadId) continue;
      const docPlant = doc.data().plant;
      if (!docPlant || docPlant === plant) {
        batch.set(doc.ref, { isLatest: false }, { merge: true });
      }
    }
    batch.set(
      uploadRef,
      {
        status: "complete",
        isLatest: true,
        totalItems: parsed.items.length,
        itemsAdded,
        itemsUpdated,
        sheets: parsed.sheets.filter((s) => s.selected).map((s) => s.sheetName),
        warnings: parsed.warnings,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    await batch.commit();

    return NextResponse.json({
      success: true,
      uploadId,
      sheets: parsed.sheets,
      summary: {
        added: itemsAdded,
        updated: itemsUpdated,
        total: parsed.items.length,
        skipped: parsed.skippedRows,
        warnings: parsed.warnings,
      },
    });
  } catch (err) {
    console.error("[inventory/upload]", err);
    if (uploadId) {
      try {
        await db.collection("inventory_uploads").doc(uploadId).set(
          {
            status: "failed",
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      } catch {
        // ignore
      }
    }
    const message = err instanceof Error ? err.message : "Upload failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
