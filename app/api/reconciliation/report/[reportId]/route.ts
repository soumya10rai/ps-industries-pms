import { NextRequest, NextResponse } from "next/server";
import {
  canReadReconciliation,
  canWriteReconciliation,
  getReconciliationSession,
} from "@/lib/reconciliation-auth";
import {
  deleteReconciliationReport,
  getReconciliationReport,
} from "@/lib/reconciliation";

export const runtime = "nodejs";

/**
 * GET /api/reconciliation/report/:reportId
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

    return NextResponse.json({ success: true, report });
  } catch (err) {
    console.error("[reconciliation/report GET]", err);
    const message =
      err instanceof Error ? err.message : "Failed to fetch report.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/reconciliation/report/:reportId
 */
export async function DELETE(
  request: NextRequest,
  context: { params: { reportId: string } }
) {
  const session = await getReconciliationSession(request);
  if (!session || !canWriteReconciliation(session.role)) {
    return NextResponse.json(
      { error: "Unauthorized. Admin or Plant Head required." },
      { status: 401 }
    );
  }

  try {
    const reportId = decodeURIComponent(context.params.reportId || "").trim();
    if (!reportId) {
      return NextResponse.json(
        { error: "reportId is required." },
        { status: 400 }
      );
    }

    const deleted = await deleteReconciliationReport(reportId);
    if (!deleted) {
      return NextResponse.json({ error: "Report not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true, deleted: true });
  } catch (err) {
    console.error("[reconciliation/report DELETE]", err);
    const message =
      err instanceof Error ? err.message : "Failed to delete report.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
