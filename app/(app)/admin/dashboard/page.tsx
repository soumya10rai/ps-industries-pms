import AdminDashboardClient from "@/components/dashboard/AdminDashboardClient";

export default function AdminDashboardPage() {
  return (
    <AdminDashboardClient
      title="Admin Overview"
      subtitle="Configure users, monitor plant KPIs, and oversee every operational stream."
      showAdminLinks
    />
  );
}
