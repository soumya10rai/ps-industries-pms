import { NextRequest, NextResponse } from "next/server";
import {
  canWriteInventory,
  getInventorySession,
} from "@/lib/inventory-auth";
import { issueStock } from "@/lib/inventory";
import { INVENTORY_PLANTS } from "@/lib/types";

/**
 * POST /api/inventory/issue
 * Body: { materialCode, quantityKg, reason, referenceId?, plant, notes? }
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
    const reason = String(body.reason ?? "").trim();
    const referenceId = body.referenceId
      ? String(body.referenceId)
      : undefined;
    const notes = body.notes ? String(body.notes) : undefined;
    const plant = String(body.plant ?? "").trim();

    if (!plant || !(INVENTORY_PLANTS as readonly string[]).includes(plant)) {
      return NextResponse.json(
        {
          error: `Invalid plant. Use one of: ${INVENTORY_PLANTS.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const result = await issueStock({
      materialCode,
      quantityKg,
      reason,
      referenceId,
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
    console.error("[inventory/issue]", err);
    const message = err instanceof Error ? err.message : "Issue failed.";
    const status =
      message.includes("Insufficient") ||
      message.includes("not found") ||
      message.includes("required") ||
      message.includes("positive")
        ? 400
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
