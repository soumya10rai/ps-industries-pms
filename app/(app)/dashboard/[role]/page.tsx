import { notFound, redirect } from "next/navigation";
import RoleDashboardClient from "@/components/dashboard/RoleDashboardClient";
import { getHomeForRole } from "@/lib/auth";
import { getServerSession } from "@/lib/server-auth";
import { isUserRole, type UserRole } from "@/lib/types";

const ROLE_ALIASES: Record<string, UserRole> = {
  admin: "admin",
  plant_head: "plant_head",
  "plant-head": "plant_head",
  accountant: "accountant",
  store: "store_manager",
  store_manager: "store_manager",
  production: "production_head",
  production_head: "production_head",
};

export default async function RoleDashboardPage({
  params,
}: {
  params: { role: string };
}) {
  const session = await getServerSession();
  if (!session) redirect("/auth/login");

  const roleKey = ROLE_ALIASES[params.role];
  if (!roleKey || !isUserRole(roleKey)) notFound();

  if (session.role !== "admin" && session.role !== roleKey) {
    redirect(getHomeForRole(session.role));
  }

  return <RoleDashboardClient role={roleKey} />;
}
