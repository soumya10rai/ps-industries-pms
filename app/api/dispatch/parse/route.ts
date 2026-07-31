import { NextRequest, NextResponse } from "next/server";
import {
  canWriteDispatch,
  getDispatchSession,
} from "@/lib/dispatch-auth";
import { parseDispatchExcel } from "@/lib/dispatch-parser";
import { DISPATCH_PLANTS } from "@/lib/types";

export const runtime = "nodejs";

/**
 * POST /api/dispatch/parse
 * Preview-only Excel parse (no Firestore writes).
 */
export async function POST(request: NextRequest) {
  const session = await getDispatchSession(request);
  if (!session || !canWriteDispatch(session.role)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const form = await request.formData();
    const file = form.get("file");
    const plant = String(form.get("plant") ?? "All").trim() || "All";

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "Excel file is required." },
        { status: 400 }
      );
    }

    if (!(DISPATCH_PLANTS as readonly string[]).includes(plant)) {
      return NextResponse.json(
        {
          error: `Invalid plant. Use one of: ${DISPATCH_PLANTS.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = parseDispatchExcel(buffer, {
      plant,
      fileName: file.name,
    });

    return NextResponse.json({
      success: true,
      fileName: file.name,
      dispatches: parsed.dispatches,
      summary: parsed.summary,
      warnings: parsed.warnings,
      inferredPeriod: parsed.inferredPeriod,
    });
  } catch (err) {
    console.error("[dispatch/parse]", err);
    const message = err instanceof Error ? err.message : "Parse failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
