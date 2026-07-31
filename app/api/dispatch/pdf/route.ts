import { NextRequest, NextResponse } from "next/server";
import {
  canExportDispatchPdf,
  getDispatchSession,
} from "@/lib/dispatch-auth";
import {
  buildVarianceReport,
  getDispatchUpload,
  listDispatches,
} from "@/lib/dispatch";
import { buildDispatchVariancePdf } from "@/lib/dispatch-pdf";

export const runtime = "nodejs";

/**
 * GET /api/dispatch/pdf?plant=&uploadId=
 * Returns application/pdf variance report.
 */
export async function GET(request: NextRequest) {
  const session = await getDispatchSession(request);
  if (!session || !canExportDispatchPdf(session.role)) {
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

    if (items.length === 0) {
      return NextResponse.json(
        { error: "No dispatch data to export." },
        { status: 404 }
      );
    }

    const report = buildVarianceReport(items);
    let periodStart = items[0]?.periodStart ?? "";
    let periodEnd = items[0]?.periodEnd ?? "";
    let fileName: string | undefined;

    if (uploadId) {
      const upload = await getDispatchUpload(uploadId);
      if (upload) {
        periodStart = upload.periodStart;
        periodEnd = upload.periodEnd;
        fileName = upload.fileName;
      }
    }

    const pdf = await buildDispatchVariancePdf({
      report,
      periodStart,
      periodEnd,
      plant,
      fileName,
    });

    const filename = `dispatch-variance-${periodStart || "report"}.pdf`;
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[dispatch/pdf]", err);
    const message =
      err instanceof Error ? err.message : "Failed to generate PDF.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
