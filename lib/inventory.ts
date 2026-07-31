/**
 * Firestore helpers for raw materials, stock movements, and inventory uploads.
 */

import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { stripUndefined } from "@/lib/firestore-utils";
import {
  DEFAULT_REORDER_LEVEL_KG,
  type MaterialType,
  type RawMaterial,
  type StockMovement,
  type StockMovementType,
} from "@/lib/types";

export function inventoryDb(): Firestore {
  return getAdminDb();
}

function tsToIso(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate: () => Date }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return "";
}

export function mapRawMaterial(
  id: string,
  data: Record<string, unknown>
): RawMaterial {
  return {
    materialCode: String(data.materialCode ?? id).toUpperCase(),
    materialName: String(data.materialName ?? ""),
    materialGroup: String(data.materialGroup ?? ""),
    materialType:
      data.materialType === "masterbatch" ? "masterbatch" : "raw_material",
    currentStockKg: Number(data.currentStockKg ?? 0),
    reorderLevelKg: Number(data.reorderLevelKg ?? DEFAULT_REORDER_LEVEL_KG),
    unit: String(data.unit ?? "KGS"),
    location: String(data.location ?? ""),
    ratePerKg: Number(data.ratePerKg ?? 0),
    partyName: data.partyName ? String(data.partyName) : undefined,
    lastUpdatedAt: tsToIso(data.lastUpdatedAt),
    lastUpdatedBy: String(data.lastUpdatedBy ?? ""),
    isActive: data.isActive !== false,
  };
}

export function mapStockMovement(
  id: string,
  data: Record<string, unknown>
): StockMovement {
  return {
    movementId: String(data.movementId ?? id),
    materialCode: String(data.materialCode ?? "").toUpperCase(),
    materialName: String(data.materialName ?? ""),
    type: data.type as StockMovementType,
    quantityKg: Number(data.quantityKg ?? 0),
    balanceAfterKg: Number(data.balanceAfterKg ?? 0),
    reason: String(data.reason ?? ""),
    referenceId: data.referenceId ? String(data.referenceId) : undefined,
    notes: data.notes ? String(data.notes) : undefined,
    createdBy: String(data.createdBy ?? ""),
    createdAt: tsToIso(data.createdAt),
    plant: String(data.plant ?? ""),
  };
}

export async function loadRawMaterial(
  materialCode: string
): Promise<RawMaterial | null> {
  const code = materialCode.trim().toUpperCase();
  if (!code) return null;
  const doc = await inventoryDb().collection("raw_materials").doc(code).get();
  if (!doc.exists) return null;
  return mapRawMaterial(doc.id, doc.data() as Record<string, unknown>);
}

export async function listActiveRawMaterials(opts?: {
  plant?: string;
  lowStock?: boolean;
  materialType?: MaterialType;
  materialGroup?: string;
}): Promise<RawMaterial[]> {
  const snap = await inventoryDb().collection("raw_materials").get();
  let items = snap.docs
    .map((d) => mapRawMaterial(d.id, d.data() as Record<string, unknown>))
    .filter((m) => m.isActive);

  if (opts?.plant) {
    const plant = opts.plant.trim().toLowerCase();
    items = items.filter((m) => m.location.toLowerCase().includes(plant));
  }
  if (opts?.materialType) {
    items = items.filter((m) => m.materialType === opts.materialType);
  }
  if (opts?.materialGroup) {
    const group = opts.materialGroup.trim().toUpperCase();
    items = items.filter((m) => m.materialGroup.toUpperCase() === group);
  }
  if (opts?.lowStock) {
    items = items.filter((m) => m.currentStockKg < m.reorderLevelKg);
  }

  items.sort((a, b) => a.materialCode.localeCompare(b.materialCode));
  return items;
}

/**
 * Live stock map keyed by materialCode, materialName, and materialGroup (uppercase).
 */
export async function loadLiveStockMap(): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  try {
    const materials = await listActiveRawMaterials();
    for (const m of materials) {
      map.set(m.materialCode.toUpperCase(), m.currentStockKg);
      if (m.materialName) {
        map.set(m.materialName.toUpperCase(), m.currentStockKg);
      }
      if (m.materialGroup) {
        // A group spans several codes — expose the group total.
        const key = m.materialGroup.toUpperCase();
        map.set(key, (map.get(key) ?? 0) + m.currentStockKg);
      }
    }
  } catch (err) {
    console.error("[inventory] loadLiveStockMap failed:", err);
  }
  return map;
}

export interface MovementWriteInput {
  materialCode: string;
  materialName: string;
  type: StockMovementType;
  quantityKg: number;
  balanceAfterKg: number;
  reason: string;
  referenceId?: string;
  notes?: string;
  createdBy: string;
  plant: string;
}

export async function createStockMovement(
  input: MovementWriteInput
): Promise<StockMovement> {
  const ref = inventoryDb().collection("stock_movements").doc();
  const payload = stripUndefined({
    movementId: ref.id,
    materialCode: input.materialCode.toUpperCase(),
    materialName: input.materialName,
    type: input.type,
    quantityKg: input.quantityKg,
    balanceAfterKg: input.balanceAfterKg,
    reason: input.reason,
    referenceId: input.referenceId,
    notes: input.notes,
    createdBy: input.createdBy,
    createdAt: FieldValue.serverTimestamp(),
    plant: input.plant,
  });
  await ref.set(payload);
  return {
    movementId: ref.id,
    materialCode: input.materialCode.toUpperCase(),
    materialName: input.materialName,
    type: input.type,
    quantityKg: input.quantityKg,
    balanceAfterKg: input.balanceAfterKg,
    reason: input.reason,
    referenceId: input.referenceId,
    notes: input.notes,
    createdBy: input.createdBy,
    createdAt: new Date().toISOString(),
    plant: input.plant,
  };
}

export interface ReceiveStockInput {
  materialCode: string;
  quantityKg: number;
  notes?: string;
  plant: string;
  ratePerKg?: number;
  uid: string;
  reason?: string;
  referenceId?: string;
}

export async function receiveStock(input: ReceiveStockInput): Promise<{
  material: RawMaterial;
  movement: StockMovement;
}> {
  const code = input.materialCode.trim().toUpperCase();
  const qty = Number(input.quantityKg);
  if (!code) throw new Error("materialCode is required.");
  if (!Number.isFinite(qty) || qty <= 0) {
    throw new Error("quantityKg must be a positive number.");
  }

  const db = inventoryDb();
  const ref = db.collection("raw_materials").doc(code);
  const snap = await ref.get();

  let materialName = code.replace(/_/g, " ");
  let materialGroup = code.split("_")[0] || code;
  let materialType: MaterialType = "raw_material";
  let location = input.plant;
  let reorderLevelKg = DEFAULT_REORDER_LEVEL_KG;
  let ratePerKg = input.ratePerKg ?? 0;
  let partyName: string | undefined;
  let unit = "KGS";
  let prevStock = 0;

  if (snap.exists) {
    const data = snap.data() as Record<string, unknown>;
    materialName = String(data.materialName ?? materialName);
    materialGroup = String(data.materialGroup ?? materialGroup);
    materialType =
      data.materialType === "masterbatch" ? "masterbatch" : "raw_material";
    location = String(data.location || input.plant);
    reorderLevelKg = Number(data.reorderLevelKg ?? DEFAULT_REORDER_LEVEL_KG);
    ratePerKg =
      input.ratePerKg !== undefined
        ? Number(input.ratePerKg)
        : Number(data.ratePerKg ?? 0);
    partyName = data.partyName ? String(data.partyName) : undefined;
    unit = String(data.unit ?? "KGS");
    prevStock = Number(data.currentStockKg ?? 0);
  }

  const newStock = Number((prevStock + qty).toFixed(3));

  await ref.set(
    stripUndefined({
      materialCode: code,
      materialName,
      materialGroup,
      materialType,
      currentStockKg: newStock,
      reorderLevelKg,
      unit,
      location,
      ratePerKg,
      partyName,
      lastUpdatedAt: FieldValue.serverTimestamp(),
      lastUpdatedBy: input.uid,
      isActive: true,
    }),
    { merge: true }
  );

  const movement = await createStockMovement({
    materialCode: code,
    materialName,
    type: "receive",
    quantityKg: qty,
    balanceAfterKg: newStock,
    reason: input.reason || "Manual Receive",
    referenceId: input.referenceId,
    notes: input.notes,
    createdBy: input.uid,
    plant: input.plant,
  });

  return {
    material: {
      materialCode: code,
      materialName,
      materialGroup,
      materialType,
      currentStockKg: newStock,
      reorderLevelKg,
      unit,
      location,
      ratePerKg,
      partyName,
      lastUpdatedAt: new Date().toISOString(),
      lastUpdatedBy: input.uid,
      isActive: true,
    },
    movement,
  };
}

export interface IssueStockInput {
  materialCode: string;
  quantityKg: number;
  reason: string;
  referenceId?: string;
  notes?: string;
  plant: string;
  uid: string;
  /** When true, skip negative-stock guard (not used by default). */
  allowNegative?: boolean;
}

export async function issueStock(input: IssueStockInput): Promise<{
  material: RawMaterial;
  movement: StockMovement;
}> {
  const code = input.materialCode.trim().toUpperCase();
  const qty = Number(input.quantityKg);
  if (!code) throw new Error("materialCode is required.");
  if (!Number.isFinite(qty) || qty <= 0) {
    throw new Error("quantityKg must be a positive number.");
  }
  if (!input.reason?.trim()) throw new Error("reason is required.");

  const db = inventoryDb();
  const ref = db.collection("raw_materials").doc(code);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new Error(`Material "${code}" not found in inventory.`);
  }

  const data = snap.data() as Record<string, unknown>;
  const prevStock = Number(data.currentStockKg ?? 0);
  if (!input.allowNegative && qty > prevStock) {
    throw new Error(
      `Insufficient stock for ${code}: available ${prevStock} kg, requested ${qty} kg.`
    );
  }

  const newStock = Number((prevStock - qty).toFixed(3));
  const materialName = String(data.materialName ?? code);

  await ref.set(
    {
      currentStockKg: newStock,
      lastUpdatedAt: FieldValue.serverTimestamp(),
      lastUpdatedBy: input.uid,
    },
    { merge: true }
  );

  const movement = await createStockMovement({
    materialCode: code,
    materialName,
    type: "issue",
    quantityKg: -qty,
    balanceAfterKg: newStock,
    reason: input.reason.trim(),
    referenceId: input.referenceId,
    notes: input.notes,
    createdBy: input.uid,
    plant: input.plant || String(data.location ?? ""),
  });

  return {
    material: mapRawMaterial(code, {
      ...data,
      currentStockKg: newStock,
      lastUpdatedBy: input.uid,
      lastUpdatedAt: new Date().toISOString(),
    }),
    movement,
  };
}

export interface AdjustStockInput {
  materialCode: string;
  newStockKg: number;
  reason: string;
  notes?: string;
  uid: string;
  plant?: string;
}

export async function adjustStock(input: AdjustStockInput): Promise<{
  material: RawMaterial;
  movement: StockMovement;
}> {
  const code = input.materialCode.trim().toUpperCase();
  const newStock = Number(input.newStockKg);
  if (!code) throw new Error("materialCode is required.");
  if (!Number.isFinite(newStock) || newStock < 0) {
    throw new Error("newStockKg must be a non-negative number.");
  }
  if (!input.reason?.trim()) throw new Error("reason is required.");

  const db = inventoryDb();
  const ref = db.collection("raw_materials").doc(code);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new Error(`Material "${code}" not found in inventory.`);
  }

  const data = snap.data() as Record<string, unknown>;
  const prevStock = Number(data.currentStockKg ?? 0);
  const delta = Number((newStock - prevStock).toFixed(3));
  const materialName = String(data.materialName ?? code);

  await ref.set(
    {
      currentStockKg: newStock,
      lastUpdatedAt: FieldValue.serverTimestamp(),
      lastUpdatedBy: input.uid,
    },
    { merge: true }
  );

  const movement = await createStockMovement({
    materialCode: code,
    materialName,
    type: "adjustment",
    quantityKg: delta,
    balanceAfterKg: newStock,
    reason: input.reason.trim(),
    notes: input.notes,
    createdBy: input.uid,
    plant: input.plant || String(data.location ?? ""),
  });

  return {
    material: mapRawMaterial(code, {
      ...data,
      currentStockKg: newStock,
      lastUpdatedBy: input.uid,
      lastUpdatedAt: new Date().toISOString(),
    }),
    movement,
  };
}

/**
 * Resolve a material-calc label (name/group) to a raw_materials doc id.
 */
export async function resolveMaterialCode(
  label: string
): Promise<{ materialCode: string; materialName: string; stockKg: number } | null> {
  const key = label.trim().toUpperCase();
  if (!key) return null;

  const byId = await loadRawMaterial(key);
  if (byId) {
    return {
      materialCode: byId.materialCode,
      materialName: byId.materialName,
      stockKg: byId.currentStockKg,
    };
  }

  const materials = await listActiveRawMaterials();
  const match =
    materials.find((m) => m.materialName.toUpperCase() === key) ||
    materials.find((m) => m.materialGroup.toUpperCase() === key) ||
    materials.find(
      (m) =>
        m.materialName.toUpperCase().includes(key) ||
        key.includes(m.materialName.toUpperCase())
    );

  if (!match) return null;
  return {
    materialCode: match.materialCode,
    materialName: match.materialName,
    stockKg: match.currentStockKg,
  };
}
