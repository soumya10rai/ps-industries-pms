import { NextRequest, NextResponse } from "next/server";
import {
  canReadInventory,
  getInventorySession,
} from "@/lib/inventory-auth";
import { listActiveRawMaterials } from "@/lib/inventory";

/**
 * GET /api/inventory/list?plant=&lowStock=true
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
    const plant = searchParams.get("plant") || undefined;
    const lowStock = searchParams.get("lowStock") === "true";
    const materialGroup = searchParams.get("materialGroup") || undefined;
    const typeParam = searchParams.get("materialType");
    const materialType =
      typeParam === "raw_material" || typeParam === "masterbatch"
        ? typeParam
        : undefined;

    const materials = await listActiveRawMaterials({
      plant,
      lowStock,
      materialType,
      materialGroup,
    });
    const lowStockCount = materials.filter(
      (m) => m.currentStockKg < m.reorderLevelKg
    ).length;
    const totalStockValue = materials.reduce(
      (sum, m) => sum + m.currentStockKg * (m.ratePerKg || 0),
      0
    );
    const totalStockKg = materials.reduce(
      (sum, m) => sum + m.currentStockKg,
      0
    );

    return NextResponse.json({
      success: true,
      count: materials.length,
      lowStockCount,
      totalStockKg,
      totalStockValue,
      materials,
    });
  } catch (err) {
    console.error("[inventory/list]", err);
    const message = err instanceof Error ? err.message : "List failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
