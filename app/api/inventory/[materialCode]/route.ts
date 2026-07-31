import { NextRequest, NextResponse } from "next/server";
import {
  canReadInventory,
  getInventorySession,
} from "@/lib/inventory-auth";
import { loadRawMaterial } from "@/lib/inventory";

/**
 * GET /api/inventory/[materialCode]
 */
export async function GET(
  request: NextRequest,
  context: { params: { materialCode: string } }
) {
  const session = await getInventorySession(request);
  if (!session || !canReadInventory(session.role)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const code = decodeURIComponent(context.params.materialCode || "")
      .trim()
      .toUpperCase();
    if (!code) {
      return NextResponse.json(
        { error: "materialCode is required." },
        { status: 400 }
      );
    }

    const material = await loadRawMaterial(code);
    if (!material || !material.isActive) {
      return NextResponse.json(
        { error: `Material "${code}" not found.` },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, material });
  } catch (err) {
    console.error("[inventory/detail]", err);
    const message = err instanceof Error ? err.message : "Lookup failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
