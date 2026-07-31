/**
 * Firestore helpers for parts + customers masters.
 * Collections: `parts/{itemCode}`, `customers/{code}`.
 */

import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { stripUndefined } from "@/lib/firestore-utils";
import { DEFAULT_HSN_CODE } from "@/lib/po-gst";
import { seedPartsAsMaster } from "@/lib/parts-seed";
import {
  DEFAULT_CUSTOMERS,
  type CustomerMaster,
  type PartMaster,
} from "@/lib/types";

export function partsDb(): Firestore {
  return getAdminDb();
}

export function mapPart(
  id: string,
  data: Record<string, unknown>
): PartMaster {
  return {
    itemCode: String(data.itemCode ?? id).toUpperCase(),
    description: String(data.description ?? ""),
    customerCode: String(data.customerCode ?? "").toUpperCase(),
    customerName: String(data.customerName ?? ""),
    weightGrams: Number(data.weightGrams ?? 0),
    materialCode: String(data.materialCode ?? "").toUpperCase(),
    scrapPercent: Number(data.scrapPercent ?? 8),
    defaultHsnCode: String(data.defaultHsnCode ?? DEFAULT_HSN_CODE),
    isActive: data.isActive !== false,
  };
}

export function mapCustomer(
  id: string,
  data: Record<string, unknown>
): CustomerMaster {
  return {
    code: String(data.code ?? id).toUpperCase(),
    name: String(data.name ?? ""),
    isActive: data.isActive !== false,
  };
}

export async function countParts(): Promise<number> {
  const snap = await partsDb().collection("parts").limit(1).get();
  if (snap.empty) return 0;
  // Prefer aggregation when available; fall back to full count for small masters.
  const all = await partsDb().collection("parts").select().get();
  return all.size;
}

export async function listParts(opts?: {
  customerCode?: string;
}): Promise<PartMaster[]> {
  const snap = await partsDb().collection("parts").get();
  let parts = snap.docs
    .map((d) => mapPart(d.id, d.data() as Record<string, unknown>))
    .filter((p) => p.isActive);

  if (opts?.customerCode) {
    const code = opts.customerCode.trim().toUpperCase();
    parts = parts.filter((p) => p.customerCode === code);
  }

  parts.sort((a, b) => a.itemCode.localeCompare(b.itemCode));
  return parts;
}

export async function getPart(itemCode: string): Promise<PartMaster | null> {
  const code = itemCode.trim().toUpperCase();
  if (!code) return null;
  const doc = await partsDb().collection("parts").doc(code).get();
  if (!doc.exists) return null;
  return mapPart(doc.id, doc.data() as Record<string, unknown>);
}

export async function listCustomers(): Promise<CustomerMaster[]> {
  const snap = await partsDb().collection("customers").get();
  if (snap.empty) return DEFAULT_CUSTOMERS;
  return snap.docs
    .map((d) => mapCustomer(d.id, d.data() as Record<string, unknown>))
    .filter((c) => c.isActive)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function seedPartsAndCustomers(): Promise<{
  partsUpserted: number;
  customersUpserted: number;
}> {
  const db = partsDb();
  const parts = seedPartsAsMaster();
  let partsUpserted = 0;
  let customersUpserted = 0;

  // Firestore batches max 500 ops
  const chunk = <T,>(arr: T[], size: number): T[][] => {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  };

  for (const group of chunk(parts, 400)) {
    const batch = db.batch();
    for (const p of group) {
      const ref = db.collection("parts").doc(p.itemCode.toUpperCase());
      batch.set(
        ref,
        stripUndefined({
          ...p,
          itemCode: p.itemCode.toUpperCase(),
          customerCode: p.customerCode.toUpperCase(),
          materialCode: p.materialCode.toUpperCase(),
          updatedAt: FieldValue.serverTimestamp(),
        }),
        { merge: true }
      );
      partsUpserted += 1;
    }
    await batch.commit();
  }

  {
    const batch = db.batch();
    for (const c of DEFAULT_CUSTOMERS) {
      const ref = db.collection("customers").doc(c.code);
      batch.set(
        ref,
        {
          ...c,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      customersUpserted += 1;
    }
    await batch.commit();
  }

  return { partsUpserted, customersUpserted };
}
