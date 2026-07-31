import { NextRequest, NextResponse } from "next/server";
import {
  canWriteInventory,
  getInventorySession,
} from "@/lib/inventory-auth";
import { adjustStock } from "@/lib/inventory";

/**
 * POST /api/inventory/adjust
 * Body: { materialCode, newStockKg, reason, notes?, plant? }
 */
export async function POST(request: NextRequest) {
  const session = await getInventorySession(request);
  if (!session || !canWriteInventory(session.role)) {
    return NextResponse.json(
      { error: "Unauthorized. store_manager, plant_head, or admin required." },
      { status: 401 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const materialCode = String(body.materialCode ?? "").trim();
    const newStockKg = Number(body.newStockKg);
    const reason = String(body.reason ?? "").trim();
    const notes = body.notes ? String(body.notes) : undefined;
    const plant = body.plant ? String(body.plant) : undefined;

    const result = await adjustStock({
      materialCode,
      newStockKg,
      reason,
      notes,
      plant,
      uid: session.uid,
    });

    return NextResponse.json({
      success: true,
      material: result.material,
      movement: result.movement,
    });
  } catch (err) {
    console.error("[inventory/adjust]", err);
    const message = err instanceof Error ? err.message : "Adjust failed.";
    const status =
      message.includes("not found") ||
      message.includes("required") ||
      message.includes("non-negative")
        ? 400
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
