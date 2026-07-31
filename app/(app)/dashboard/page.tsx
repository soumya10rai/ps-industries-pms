"use client";

import AdminDashboardClient from "@/components/dashboard/AdminDashboardClient";
import RoleDashboardClient from "@/components/dashboard/RoleDashboardClient";
import { useAuth } from "@/lib/auth-context";

/**
 * Main /dashboard — role-aware KPIs from Firestore.
 * Admins see the full plant overview; other roles see their focused board.
 */
export default function DashboardPage() {
  const { role, loading } = useAuth();

  if (loading) {
    return (
      <div className="ps-section">
        <div className="grid gap-8 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="border-l-4 border-ps-red bg-white p-6 shadow-card"
            >
              <div className="h-3 w-24 animate-pulse rounded bg-ps-gray-100" />
              <div className="mt-3 h-8 w-20 animate-pulse rounded bg-ps-gray-100" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (role && role !== "admin") {
    return <RoleDashboardClient role={role} />;
  }

  return <AdminDashboardClient />;
}
