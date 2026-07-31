import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session";
import {
  loadDashboardKpisForRole,
  type RoleDashboardKpis,
} from "@/lib/dashboard-kpis";
import { isUserRole, type UserRole } from "@/lib/types";

export const runtime = "nodejs";

/**
 * GET /api/dashboard/kpis?role=admin|plant_head|accountant|store_manager|production_head
 * Aggregates live Firestore KPIs for the requested (or session) role.
 */
export async function GET(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const session = await verifySessionToken(token);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const roleParam = request.nextUrl.searchParams.get("role");
  let role: UserRole = session.role;

  if (roleParam) {
    if (!isUserRole(roleParam)) {
      return NextResponse.json({ error: "Invalid role." }, { status: 400 });
    }
    // Non-admins may only request their own role KPIs.
    if (session.role !== "admin" && roleParam !== session.role) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }
    role = roleParam;
  }

  try {
    const payload: RoleDashboardKpis = await loadDashboardKpisForRole(role, {
      email: session.email,
      uid: session.uid,
    });

    return NextResponse.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      ...payload,
    });
  } catch (err) {
    console.error("[dashboard/kpis]", err);
    const message =
      err instanceof Error ? err.message : "Failed to load dashboard KPIs.";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
