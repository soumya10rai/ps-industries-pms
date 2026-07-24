"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { ROLE_LABELS, type UserRole } from "@/lib/types";

interface NavbarProps {
  onMenuToggle?: () => void;
  serverUser?: {
    email: string;
    role: UserRole;
    displayName: string;
  };
}

export default function Navbar({ onMenuToggle, serverUser }: NavbarProps) {
  const { profile, role: clientRole, logout } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const role = clientRole ?? serverUser?.role ?? null;
  const displayName =
    profile?.displayName ||
    serverUser?.displayName ||
    profile?.email ||
    serverUser?.email ||
    "User";
  const email = profile?.email || serverUser?.email || "";

  const initials = displayName
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  async function handleLogout() {
    setBusy(true);
    try {
      await logout();
      router.push("/auth/login");
      router.refresh();
    } finally {
      setBusy(false);
      setOpen(false);
    }
  }

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between bg-ps-navy px-4 text-white shadow-md lg:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuToggle}
          className="rounded-lg p-1.5 transition duration-200 ease-in-out hover:bg-white/10 lg:hidden"
          aria-label="Toggle sidebar"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <Link href="/dashboard" className="flex flex-col leading-tight">
          <span className="font-serif text-lg font-bold tracking-wide sm:text-xl">
            PS INDUSTRIES
          </span>
          <span className="hidden text-[11px] text-blue-100 sm:block">
            Admin Portal — Greater Noida Plant
          </span>
        </Link>
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition duration-200 ease-in-out hover:bg-white/10"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-xs font-semibold">
            {initials || "U"}
          </span>
          <span className="hidden text-left sm:block">
            <span className="block text-sm font-medium leading-tight">
              {displayName}
            </span>
            {role && (
              <span className="block text-[11px] text-blue-100">
                {ROLE_LABELS[role]}
              </span>
            )}
          </span>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="opacity-80"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {open && (
          <>
            <button
              type="button"
              className="fixed inset-0 z-40 cursor-default"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
            />
            <div className="absolute right-0 z-50 mt-1 w-56 overflow-hidden rounded-lg border border-ps-gray-200 bg-white text-ps-gray-800 shadow-card">
              <div className="border-b border-ps-navy/20 px-4 py-3">
                <p className="truncate text-sm font-semibold">{displayName}</p>
                <p className="truncate text-xs text-ps-gray-500">{email}</p>
              </div>
              <Link
                href="/admin/dashboard"
                onClick={() => setOpen(false)}
                className="block px-4 py-2.5 text-sm transition duration-200 ease-in-out hover:bg-ps-gray-100"
              >
                Profile &amp; Settings
              </Link>
              <button
                type="button"
                disabled={busy}
                onClick={handleLogout}
                className="w-full px-4 py-2.5 text-left text-sm text-ps-red transition duration-200 ease-in-out hover:bg-red-50 disabled:opacity-60"
              >
                {busy ? "Signing out…" : "Sign out"}
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
