import { NextRequest, NextResponse } from "next/server";
import {
  canReadReconciliation,
  getReconciliationSession,
} from "@/lib/reconciliation-auth";
import { listReconciliationReports } from "@/lib/reconciliation";

export const runtime = "nodejs";

/**
 * GET /api/reconciliation/reports
 * List recent cached reconciliation reports.
 */
export async function GET(request: NextRequest) {
  const session = await getReconciliationSession(request);
  if (!session || !canReadReconciliation(session.role)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const limit = Math.min(
      Math.max(Number(request.nextUrl.searchParams.get("limit") || 50), 1),
      100
    );
    const reports = await listReconciliationReports(limit);

    // History list omits heavy summary arrays for speed.
    const items = reports.map((r) => ({
      reportId: r.reportId,
      periodStart: r.periodStart,
      periodEnd: r.periodEnd,
      plant: r.plant,
      mode: r.mode,
      generatedBy: r.generatedBy,
      generatedByName: r.generatedByName,
      generatedAt: r.generatedAt,
      totalExpectedKg: r.totalExpectedKg,
      totalActualKg: r.totalActualKg,
      totalVarianceKg: r.totalVarianceKg,
      totalVariancePercent: r.totalVariancePercent,
      materialsAnalyzed: r.materialsAnalyzed,
      alertCount: r.alertCount,
      attentionCount: r.attentionCount,
      healthyCount: r.healthyCount,
      unmappedCount: r.unmappedCount,
    }));

    return NextResponse.json({ success: true, count: items.length, reports: items });
  } catch (err) {
    console.error("[reconciliation/reports]", err);
    const message =
      err instanceof Error ? err.message : "Failed to list reports.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
