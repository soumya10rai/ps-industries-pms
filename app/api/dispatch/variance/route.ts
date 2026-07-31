import { NextRequest, NextResponse } from "next/server";
import {
  canReadDispatch,
  getDispatchSession,
} from "@/lib/dispatch-auth";
import {
  buildVarianceReport,
  getDispatchUpload,
  listDispatches,
  listDispatchUploads,
} from "@/lib/dispatch";

export const runtime = "nodejs";

/**
 * GET /api/dispatch/variance
 * Aggregated plan vs actual report (+ optional history for charts).
 */
export async function GET(request: NextRequest) {
  const session = await getDispatchSession(request);
  if (!session || !canReadDispatch(session.role)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const { searchParams } = request.nextUrl;
    const plant = searchParams.get("plant")?.trim() || undefined;
    const uploadId = searchParams.get("uploadId")?.trim() || undefined;

    const items = await listDispatches({
      plant,
      uploadId,
      latestOnly: !uploadId,
    });
    const report = buildVarianceReport(items);

    let periodStart = "";
    let periodEnd = "";
    if (uploadId) {
      const upload = await getDispatchUpload(uploadId);
      periodStart = upload?.periodStart ?? "";
      periodEnd = upload?.periodEnd ?? "";
    } else if (items[0]) {
      periodStart = items[0].periodStart;
      periodEnd = items[0].periodEnd;
    }

    const uploads = await listDispatchUploads();
    const history = uploads
      .filter((u) => u.status === "complete")
      .filter((u) => !plant || plant === "All" || u.plant === plant || u.plant === "All")
      .slice(0, 12)
      .map((u) => ({
        uploadId: u.uploadId,
        periodStart: u.periodStart,
        periodEnd: u.periodEnd,
        plant: u.plant,
        totalItems: u.totalItems,
        uploadedAt: u.uploadedAt,
        isLatest: u.isLatest,
      }));

    return NextResponse.json({
      success: true,
      periodStart,
      periodEnd,
      ...report,
      // Don't dump full items twice for clients that only need aggregates —
      // keep items for PDF / detailed UI.
      history,
    });
  } catch (err) {
    console.error("[dispatch/variance]", err);
    const message =
      err instanceof Error ? err.message : "Failed to build variance report.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
