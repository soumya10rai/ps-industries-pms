import type { NextApiRequest, NextApiResponse } from "next";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { stripUndefined } from "@/lib/firestore-utils";
import type { ParsedMaterial } from "@/lib/excel-parser";

function slugifyMaterialName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || `material-${Date.now()}`;
}

/**
 * POST /api/inventory/upload
 * Body: { materials: ParsedMaterial[] }
 * Upserts each row into Firestore collection `raw_materials`.
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
    const materials = (req.body?.materials ?? []) as ParsedMaterial[];
    if (!Array.isArray(materials) || materials.length === 0) {
      return res.status(400).json({ error: "No materials to upload." });
    }

    const db = getAdminDb();
    const batch = db.batch();
    const nowIso = new Date().toISOString();
    let saved = 0;

    for (const row of materials) {
      const material_name = String(row.material_name ?? "").trim();
      const current_qty = Number(row.current_qty);
      const location = String(row.location ?? "").trim();
      const reorder_level = Number(row.reorder_level);

      if (
        !material_name ||
        !Number.isFinite(current_qty) ||
        current_qty < 0 ||
        !location ||
        !Number.isFinite(reorder_level) ||
        reorder_level < 0
      ) {
        continue;
      }

      const docId = slugifyMaterialName(material_name);
      const ref = db.collection("raw_materials").doc(docId);
      batch.set(
        ref,
        stripUndefined({
          material_name,
          current_qty,
          location,
          reorder_level,
          last_updated: FieldValue.serverTimestamp(),
          last_updated_iso: nowIso,
        }),
        { merge: true }
      );
      saved += 1;
    }

    if (saved === 0) {
      return res.status(400).json({ error: "No valid material rows to save." });
    }

    await batch.commit();

    return res.status(200).json({
      ok: true,
      saved,
      message: `${saved} materials uploaded successfully`,
    });
  } catch (err) {
    console.error("[inventory/upload]", err);
    const message =
      err instanceof Error ? err.message : "Failed to save inventory.";
    return res.status(500).json({ error: message });
  }
}
