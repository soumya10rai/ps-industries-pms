import { NextResponse } from "next/server";
import { getDashboardKPIs } from "@/lib/firestore-queries";

/**
 * GET /api/dashboard/kpis
 * Returns live KPI metrics from Firestore (Admin SDK).
 */
export async function GET() {
  try {
    const kpis = await getDashboardKPIs();
    return NextResponse.json({ ok: true, kpis });
  } catch (err) {
    console.error("[api/dashboard/kpis]", err);
    const message =
      err instanceof Error ? err.message : "Error loading data";
    return NextResponse.json(
      { ok: false, error: "Error loading data", detail: message },
      { status: 500 }
    );
  }
}
