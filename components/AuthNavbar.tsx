"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { logout as firebaseLogout } from "@/lib/firebase";
import {
  ROLE_HOME,
  ROLE_LABELS,
  type UserRole,
} from "@/lib/types";

export interface AuthUser {
  uid: string;
  email: string;
  role: UserRole;
  displayName: string;
}

interface AuthNavbarProps {
  user: AuthUser | null;
}

/** Mirrors ROLE_ACCESS — plant-head is plant_head only; admin shares the others. */
const NAV_LINKS: Array<{ href: string; label: string; roles: UserRole[] }> = [
  { href: "/admin", label: "Admin", roles: ["admin"] },
  { href: "/plant-head", label: "Plant Head", roles: ["plant_head"] },
  {
    href: "/accountant",
    label: "Accountant",
    roles: ["admin", "accountant"],
  },
  {
    href: "/store",
    label: "Store",
    roles: ["admin", "store_manager"],
  },
  {
    href: "/production",
    label: "Production",
    roles: ["admin", "production_head"],
  },
];

export function AuthNavbar({ user }: AuthNavbarProps) {
  const pathname = usePathname();
  const router = useRouter();

  if (!user) {
    return (
      <header className="border-b border-steel-200/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/auth/login"
            className="font-display text-lg font-semibold tracking-tight text-steel-900"
          >
            PS Industries
          </Link>
          <nav className="flex items-center gap-3 text-sm">
            <Link
              href="/auth/login"
              className="text-steel-600 transition hover:text-brand-700"
            >
              Sign in
            </Link>
            <Link
              href="/auth/register"
              className="rounded-md bg-brand-700 px-3 py-1.5 font-medium text-white transition hover:bg-brand-800"
            >
              Register
            </Link>
          </nav>
        </div>
      </header>
    );
  }

  const links = NAV_LINKS.filter((link) => link.roles.includes(user.role));

  async function handleLogout() {
    try {
      await firebaseLogout();
    } catch {
      // Firebase may already be signed out
    }
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/auth/login");
    router.refresh();
  }

  return (
    <header className="border-b border-steel-200/80 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-8">
          <Link
            href={ROLE_HOME[user.role]}
            className="font-display text-lg font-semibold tracking-tight text-steel-900"
          >
            PS Industries
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {links.map((link) => {
              const active =
                pathname === link.href || pathname.startsWith(`${link.href}/`);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                    active
                      ? "bg-brand-50 text-brand-800"
                      : "text-steel-600 hover:bg-steel-50 hover:text-steel-900"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium text-steel-900">
              {user.displayName || user.email}
            </p>
            <p className="text-xs text-steel-500">
              {ROLE_LABELS[user.role]}
            </p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-md border border-steel-200 bg-white px-3 py-1.5 text-sm font-medium text-steel-700 transition hover:border-steel-300 hover:bg-steel-50"
          >
            Log out
          </button>
        </div>
      </div>
    </header>
  );
}
