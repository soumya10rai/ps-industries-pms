import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminDb } from "@/lib/firebase-admin";
import type { RawMaterialRecord } from "@/lib/excel-parser";

/**
 * GET /api/inventory/list
 * Returns all documents from Firestore `raw_materials`.
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
    const snap = await db.collection("raw_materials").get();

    const materials: RawMaterialRecord[] = snap.docs.map((doc) => {
      const data = doc.data();
      let last_updated = "";
      if (typeof data.last_updated_iso === "string") {
        last_updated = data.last_updated_iso;
      } else if (
        data.last_updated &&
        typeof data.last_updated.toDate === "function"
      ) {
        last_updated = data.last_updated.toDate().toISOString();
      } else if (typeof data.last_updated === "string") {
        last_updated = data.last_updated;
      }

      return {
        id: doc.id,
        material_name: String(data.material_name ?? ""),
        current_qty: Number(data.current_qty ?? 0),
        location: String(data.location ?? ""),
        reorder_level: Number(data.reorder_level ?? 0),
        last_updated,
      };
    });

    materials.sort((a, b) =>
      a.material_name.localeCompare(b.material_name, undefined, {
        sensitivity: "base",
      })
    );

    return res.status(200).json({ ok: true, materials, count: materials.length });
  } catch (err) {
    console.error("[inventory/list]", err);
    const message =
      err instanceof Error ? err.message : "Failed to load inventory.";
    return res.status(500).json({ error: message });
  }
}
