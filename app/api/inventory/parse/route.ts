import { NextRequest, NextResponse } from "next/server";
import {
  canWriteInventory,
  getInventorySession,
} from "@/lib/inventory-auth";
import { parseInventoryExcel } from "@/lib/inventory-parser";

export const runtime = "nodejs";

/**
 * POST /api/inventory/parse
 * Preview-only Excel parse (no Firestore writes).
 */
export async function POST(request: NextRequest) {
  const session = await getInventorySession(request);
  if (!session || !canWriteInventory(session.role)) {
    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401 }
    );
  }

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "Excel file is required." },
        { status: 400 }
      );
    }

    const sheetNames = form
      .getAll("sheets")
      .filter((v): v is string => typeof v === "string")
      .map((v) => v.trim())
      .filter(Boolean);

    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = parseInventoryExcel(
      buffer,
      sheetNames.length > 0 ? { sheetNames } : {}
    );

    return NextResponse.json({
      success: true,
      fileName: file.name,
      items: parsed.items,
      sheets: parsed.sheets,
      warnings: parsed.warnings,
      totalRows: parsed.totalRows,
      skippedRows: parsed.skippedRows,
      count: parsed.items.length,
    });
  } catch (err) {
    console.error("[inventory/parse]", err);
    const message = err instanceof Error ? err.message : "Parse failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
