import { NextRequest, NextResponse } from "next/server";
import {
  canReadDispatch,
  getDispatchSession,
} from "@/lib/dispatch-auth";
import { listDispatches } from "@/lib/dispatch";

export const runtime = "nodejs";

/**
 * GET /api/dispatch/list
 * ?plant= &customer= &status= &uploadId=
 */
export async function GET(request: NextRequest) {
  const session = await getDispatchSession(request);
  if (!session || !canReadDispatch(session.role)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const { searchParams } = request.nextUrl;
    const plant = searchParams.get("plant")?.trim() || undefined;
    const customer = searchParams.get("customer")?.trim() || undefined;
    const status = searchParams.get("status")?.trim() || undefined;
    const uploadId = searchParams.get("uploadId")?.trim() || undefined;

    const dispatches = await listDispatches({
      plant,
      customer,
      status,
      uploadId,
      latestOnly: !uploadId,
    });

    const shortfallCount = dispatches.filter(
      (d) => d.status === "shortfall"
    ).length;
    const excessCount = dispatches.filter((d) => d.status === "excess").length;
    const onTrackCount = dispatches.filter(
      (d) => d.status === "on_track"
    ).length;
    const completeCount = dispatches.filter(
      (d) => d.status === "complete"
    ).length;
    const totalPlanned = dispatches.reduce(
      (s, d) => s + d.plannedQuantity,
      0
    );
    const totalDispatched = dispatches.reduce(
      (s, d) => s + d.actualQuantity,
      0
    );
    const totalVariance = totalDispatched - totalPlanned;
    const totalVariancePercent =
      totalPlanned === 0
        ? 0
        : Math.round((totalVariance / totalPlanned) * 10000) / 100;

    const customers = Array.from(
      new Set(dispatches.map((d) => d.customer).filter(Boolean))
    ).sort();
    const plants = Array.from(
      new Set(dispatches.map((d) => d.plant).filter(Boolean))
    ).sort();

    return NextResponse.json({
      success: true,
      dispatches,
      customers,
      plants,
      kpis: {
        total: dispatches.length,
        shortfallCount,
        excessCount,
        onTrackCount,
        completeCount,
        totalPlanned,
        totalDispatched,
        totalVariance,
        totalVariancePercent,
      },
    });
  } catch (err) {
    console.error("[dispatch/list]", err);
    const message = err instanceof Error ? err.message : "Failed to list.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
