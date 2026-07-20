import { ROLE_LABELS, type UserRole } from "@/lib/types";

interface DashboardShellProps {
  title: string;
  description: string;
  role: UserRole;
  children: React.ReactNode;
}

export function DashboardShell({
  title,
  description,
  role,
  children,
}: DashboardShellProps) {
  return (
    <div className="dashboard-shell">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">
        {ROLE_LABELS[role]}
      </p>
      <h1 className="dashboard-title mt-2">{title}</h1>
      <p className="mt-2 max-w-2xl text-steel-500">{description}</p>
      {children}
    </div>
  );
}
