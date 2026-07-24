"use client";

import { useState, type ReactNode } from "react";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import Footer from "@/components/Footer";
import type { UserRole } from "@/lib/types";

export interface ShellUser {
  email: string;
  role: UserRole;
  displayName: string;
}

export default function AppShell({
  children,
  user,
}: {
  children: ReactNode;
  user: ShellUser;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-ps-surface">
      <Navbar
        onMenuToggle={() => setSidebarOpen((v) => !v)}
        serverUser={user}
      />
      <div className="flex flex-1">
        <Sidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          serverRole={user.role}
        />
        <div className="flex min-h-[calc(100vh-3.5rem)] flex-1 flex-col lg:ml-60">
          <main className="flex-1 bg-ps-surface px-6 py-4 lg:px-8 lg:py-6">
            {children}
          </main>
          <Footer />
        </div>
      </div>
    </div>
  );
}
