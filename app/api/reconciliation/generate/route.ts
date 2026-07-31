import { NextRequest, NextResponse } from "next/server";
import {
  canWriteReconciliation,
  getReconciliationSession,
} from "@/lib/reconciliation-auth";
import { generateReconciliationReport } from "@/lib/reconciliation";

export const runtime = "nodejs";

/**
 * POST /api/reconciliation/generate
 * Body: { periodStart, periodEnd, plant?, mode?, regenerate? }
 */
export async function POST(request: NextRequest) {
  const session = await getReconciliationSession(request);
  if (!session || !canWriteReconciliation(session.role)) {
    return NextResponse.json(
      { error: "Unauthorized. Admin or Plant Head required." },
      { status: 401 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const periodStart = String(body.periodStart ?? "").trim();
    const periodEnd = String(body.periodEnd ?? "").trim();
    const plant = String(body.plant ?? "All").trim() || "All";
    const mode = body.mode === "manual" ? "manual" : "auto";
    const regenerate = body.regenerate === true;

    if (!periodStart || !periodEnd) {
      return NextResponse.json(
        { error: "periodStart and periodEnd are required (YYYY-MM-DD)." },
        { status: 400 }
      );
    }

    const { report, cached } = await generateReconciliationReport({
      periodStart,
      periodEnd,
      plant,
      mode,
      regenerate,
      generatedBy: session.uid,
      generatedByName: session.name || session.email,
    });

    return NextResponse.json({
      success: true,
      cached,
      report,
    });
  } catch (err) {
    console.error("[reconciliation/generate]", err);
    const message =
      err instanceof Error ? err.message : "Failed to generate report.";
    const status =
      message.includes("required") ||
      message.includes("must be") ||
      message.includes("coming soon")
        ? 400
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
