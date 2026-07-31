import { NextRequest, NextResponse } from "next/server";
import {
  canReadInventory,
  getInventorySession,
} from "@/lib/inventory-auth";
import { inventoryDb, mapStockMovement } from "@/lib/inventory";
import type { StockMovementType } from "@/lib/types";

/**
 * GET /api/inventory/movements?materialCode=&limit=&type=
 */
export async function GET(request: NextRequest) {
  const session = await getInventorySession(request);
  if (!session || !canReadInventory(session.role)) {
    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = request.nextUrl;
    const materialCode = (searchParams.get("materialCode") || "")
      .trim()
      .toUpperCase();
    const type = searchParams.get("type") as StockMovementType | null;
    const limit = Math.min(
      Math.max(Number(searchParams.get("limit") || 50), 1),
      200
    );

    let query = inventoryDb()
      .collection("stock_movements")
      .orderBy("createdAt", "desc")
      .limit(limit);

    if (materialCode) {
      query = inventoryDb()
        .collection("stock_movements")
        .where("materialCode", "==", materialCode)
        .orderBy("createdAt", "desc")
        .limit(limit);
    }

    let snap;
    try {
      snap = await query.get();
    } catch (err) {
      // Fallback without orderBy if index missing
      console.warn("[inventory/movements] indexed query failed:", err);
      if (materialCode) {
        snap = await inventoryDb()
          .collection("stock_movements")
          .where("materialCode", "==", materialCode)
          .limit(limit)
          .get();
      } else {
        snap = await inventoryDb()
          .collection("stock_movements")
          .limit(limit)
          .get();
      }
    }

    let movements = snap.docs.map((d) =>
      mapStockMovement(d.id, d.data() as Record<string, unknown>)
    );

    if (type) {
      movements = movements.filter((m) => m.type === type);
    }

    // Client-side sort if fallback returned unsorted
    movements.sort((a, b) =>
      String(b.createdAt).localeCompare(String(a.createdAt))
    );

    return NextResponse.json({
      success: true,
      count: movements.length,
      movements,
    });
  } catch (err) {
    console.error("[inventory/movements]", err);
    const message = err instanceof Error ? err.message : "Movements failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
