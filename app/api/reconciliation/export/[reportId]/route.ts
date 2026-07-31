import { NextRequest, NextResponse } from "next/server";
import {
  canReadReconciliation,
  getReconciliationSession,
} from "@/lib/reconciliation-auth";
import { getReconciliationReport } from "@/lib/reconciliation";
import { buildReconciliationPdf } from "@/lib/reconciliation-pdf";

export const runtime = "nodejs";

/**
 * GET /api/reconciliation/export/:reportId
 * Returns application/pdf reconciliation report.
 */
export async function GET(
  request: NextRequest,
  context: { params: { reportId: string } }
) {
  const session = await getReconciliationSession(request);
  if (!session || !canReadReconciliation(session.role)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const reportId = decodeURIComponent(context.params.reportId || "").trim();
    if (!reportId) {
      return NextResponse.json(
        { error: "reportId is required." },
        { status: 400 }
      );
    }

    const report = await getReconciliationReport(reportId);
    if (!report) {
      return NextResponse.json({ error: "Report not found." }, { status: 404 });
    }

    const pdf = await buildReconciliationPdf({ report });
    const filename = `reconciliation-${report.periodStart}-${report.periodEnd}.pdf`;

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[reconciliation/export]", err);
    const message =
      err instanceof Error ? err.message : "Failed to generate PDF.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
