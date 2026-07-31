import { NextRequest, NextResponse } from "next/server";
import {
  canWriteInventory,
  getInventorySession,
} from "@/lib/inventory-auth";
import { receiveStock } from "@/lib/inventory";
import { INVENTORY_PLANTS } from "@/lib/types";

/**
 * POST /api/inventory/receive
 * Body: { materialCode, quantityKg, notes?, plant, ratePerKg? }
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
    const quantityKg = Number(body.quantityKg);
    const notes = body.notes ? String(body.notes) : undefined;
    const plant = String(body.plant ?? "").trim();
    const ratePerKg =
      body.ratePerKg !== undefined && body.ratePerKg !== null
        ? Number(body.ratePerKg)
        : undefined;

    if (!plant || !(INVENTORY_PLANTS as readonly string[]).includes(plant)) {
      return NextResponse.json(
        {
          error: `Invalid plant. Use one of: ${INVENTORY_PLANTS.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const result = await receiveStock({
      materialCode,
      quantityKg,
      notes,
      plant,
      ratePerKg,
      uid: session.uid,
    });

    return NextResponse.json({
      success: true,
      material: result.material,
      movement: result.movement,
    });
  } catch (err) {
    console.error("[inventory/receive]", err);
    const message = err instanceof Error ? err.message : "Receive failed.";
    const status = message.includes("required") || message.includes("positive")
      ? 400
      : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
