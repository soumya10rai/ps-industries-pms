"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import type { NavItem, UserRole } from "@/lib/types";

const MAIN_NAV: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "grid" },
  {
    label: "Manpower",
    href: "/admin/dashboard",
    icon: "users",
    roles: ["admin", "plant_head", "production_head"],
  },
  {
    label: "Machines",
    href: "/production/runs",
    icon: "cpu",
    roles: ["admin", "plant_head", "production_head"],
  },
  {
    label: "Orders",
    href: "/accountant/po-list",
    icon: "orders",
    roles: ["admin", "accountant", "plant_head"],
  },
  {
    label: "Inventory",
    href: "/store/inventory",
    icon: "box",
    roles: ["admin", "store_manager", "plant_head"],
  },
  {
    label: "Clients",
    href: "/accountant/po-list",
    icon: "clients",
    roles: ["admin", "accountant"],
  },
  {
    label: "Suppliers",
    href: "/store/inventory",
    icon: "truck",
    roles: ["admin", "store_manager", "accountant"],
  },
  {
    label: "Production",
    href: "/production/runs",
    icon: "factory",
    roles: ["admin", "production_head", "plant_head"],
  },
  {
    label: "HR",
    href: "/admin/dashboard",
    icon: "hr",
    roles: ["admin", "plant_head"],
  },
  {
    label: "Reports",
    href: "/dashboard",
    icon: "chart",
    roles: ["admin", "plant_head", "accountant"],
  },
  {
    label: "Reconciliation",
    href: "/accountant/po-list",
    icon: "check",
    roles: ["admin", "accountant"],
  },
  {
    label: "Imports",
    href: "/accountant/po-upload",
    icon: "upload",
    roles: ["admin", "accountant"],
  },
  {
    label: "Approvals",
    href: "/plant-head/approvals",
    icon: "check",
    roles: ["admin", "plant_head"],
  },
  {
    label: "Material Check",
    href: "/plant-head/material-check",
    icon: "box",
    roles: ["admin", "plant_head", "store_manager"],
  },
  {
    label: "Surveillance",
    href: "/plant-head/approvals",
    icon: "eye",
    roles: ["admin", "plant_head"],
  },
];

const ADMIN_NAV: NavItem[] = [
  { label: "Settings", href: "/admin/dashboard", icon: "settings", roles: ["admin"] },
  { label: "Users", href: "/admin/dashboard", icon: "user-cog", roles: ["admin"] },
];

function visible(item: NavItem, role: UserRole | null): boolean {
  if (!item.roles) return true;
  if (!role) return false;
  return item.roles.includes(role);
}

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
  serverRole?: UserRole | null;
}

export default function Sidebar({
  open = true,
  onClose,
  serverRole = null,
}: SidebarProps) {
  const pathname = usePathname();
  const { role: clientRole } = useAuth();
  const role = clientRole ?? serverRole;

  const mainItems = MAIN_NAV.filter((i) => visible(i, role));
  const adminItems = ADMIN_NAV.filter((i) => visible(i, role));

  return (
    <>
      {open && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          aria-label="Close sidebar"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed bottom-0 left-0 top-14 z-40 flex w-60 flex-col bg-ps-dark text-white transition-transform duration-200 lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-200/70">
            Main Menu
          </p>
          <ul className="space-y-0.5">
            {mainItems.map((item) => (
              <li key={`${item.label}-${item.href}`}>
                <NavLink item={item} active={isActive(pathname, item.href)} onNavigate={onClose} />
              </li>
            ))}
          </ul>

          {adminItems.length > 0 && (
            <>
              <p className="mb-2 mt-6 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-200/70">
                Admin
              </p>
              <ul className="space-y-0.5">
                {adminItems.map((item) => (
                  <li key={`${item.label}-${item.href}`}>
                    <NavLink
                      item={item}
                      active={isActive(pathname, item.href)}
                      onNavigate={onClose}
                    />
                  </li>
                ))}
              </ul>
            </>
          )}
        </nav>

        <div className="border-t border-white/10 px-4 py-3 text-[11px] text-blue-100/60">
          Greater Noida Plant
        </div>
      </aside>
    </>
  );
}

function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({
  item,
  active,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition duration-200 ease-in-out ${
        active
          ? "bg-ps-navy text-white shadow-nav-active"
          : "text-blue-50/90 hover:bg-white/10 hover:text-white"
      }`}
    >
      <NavIcon name={item.icon} />
      <span>{item.label}</span>
    </Link>
  );
}

function NavIcon({ name }: { name: string }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    className: "shrink-0 opacity-90",
  } as const;

  switch (name) {
    case "grid":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      );
    case "users":
      return (
        <svg {...common}>
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case "cpu":
      return (
        <svg {...common}>
          <rect x="4" y="4" width="16" height="16" rx="2" />
          <rect x="9" y="9" width="6" height="6" />
          <path d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3" />
        </svg>
      );
    case "orders":
      return (
        <svg {...common}>
          <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
          <rect x="9" y="3" width="6" height="4" rx="1" />
          <path d="M9 12h6M9 16h4" />
        </svg>
      );
    case "box":
      return (
        <svg {...common}>
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12" />
        </svg>
      );
    case "clients":
      return (
        <svg {...common}>
          <path d="M3 21h18M5 21V7l7-4 7 4v14" />
          <path d="M9 21v-6h6v6" />
        </svg>
      );
    case "truck":
      return (
        <svg {...common}>
          <path d="M1 3h15v13H1zM16 8h4l3 3v5h-7V8z" />
          <circle cx="5.5" cy="18.5" r="2.5" />
          <circle cx="18.5" cy="18.5" r="2.5" />
        </svg>
      );
    case "factory":
      return (
        <svg {...common}>
          <path d="M2 20h20M4 20V10l6 4V10l6 4V4h4v16" />
        </svg>
      );
    case "hr":
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
        </svg>
      );
    case "chart":
      return (
        <svg {...common}>
          <path d="M4 19V5M4 19h16M8 17V11M12 17V7M16 17v-4" />
        </svg>
      );
    case "check":
      return (
        <svg {...common}>
          <path d="M9 11l3 3L22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
      );
    case "upload":
      return (
        <svg {...common}>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
        </svg>
      );
    case "eye":
      return (
        <svg {...common}>
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
    case "settings":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
        </svg>
      );
    case "user-cog":
      return (
        <svg {...common}>
          <circle cx="9" cy="7" r="3.5" />
          <path d="M2 20c0-3.3 3.1-6 7-6" />
          <circle cx="18" cy="15" r="3" />
          <path d="M18 11.5V12M18 18v.5M15.2 12.8l.4.4M20.4 16.8l.4.4M14.5 15H15M21 15h.5M15.2 17.2l.4-.4M20.4 13.2l.4-.4" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
        </svg>
      );
  }
}
