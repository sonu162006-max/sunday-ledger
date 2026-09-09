"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import React from "react";
import {
  LayoutGrid,
  Users,
  CalendarDays,
  Landmark,
  Receipt,
  LogOut,
  ShieldAlert,
  BookOpen,
} from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { data: session } = useSession();

  const navItems = [
    { label: "Overview", href: "/", icon: LayoutGrid },
    { label: "Workers", href: "/workers", icon: Users },
    { label: "Attendance", href: "/attendance", icon: CalendarDays },
    { label: "Holidays", href: "/holidays", icon: Landmark },
    { label: "Salary Reports", href: "/salary-reports", icon: Receipt },
  ];

  const userRole = (session?.user as { role?: string })?.role || "VIEWER";
  const userEmail = session?.user?.email || "user@sundayledger.com";
  const userName = session?.user?.name || userEmail.split("@")[0];

  return (
    <div className="flex min-h-screen flex-col md:flex-row bg-[var(--paper)]">
      {/* Deep Pine Sidebar */}
      <aside className="w-full md:w-64 bg-[var(--pine)] text-white flex flex-col justify-between shrink-0">
        <div>
          {/* Header & Brand */}
          <div className="p-6 border-b border-[rgba(255,255,255,0.1)]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-[3px] bg-[var(--gold)] flex items-center justify-center text-[var(--pine-deep)]">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h1 className="font-serif text-lg font-bold tracking-wide text-white m-0">
                  Sunday Ledger
                </h1>
                <p className="text-[0.68rem] tracking-widest uppercase text-[var(--gold-soft)] font-medium m-0">
                  Payroll & Attendance
                </p>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 flex flex-col gap-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-[3px] text-sm font-medium transition-all ${
                    isActive
                      ? "bg-[var(--pine-deep)] text-[var(--gold-soft)] border-l-4 border-[var(--gold)]"
                      : "text-slate-300 hover:bg-[rgba(255,255,255,0.06)] hover:text-white"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? "text-[var(--gold)]" : "text-slate-400"}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Profile & Role Info */}
        <div className="p-4 border-t border-[rgba(255,255,255,0.1)] bg-[var(--pine-deep)]">
          <div className="flex items-center justify-between mb-2">
            <div className="flex flex-col truncate">
              <span className="text-xs font-semibold text-white truncate capitalize">
                {userName}
              </span>
              <span className="text-[0.7rem] text-slate-400 truncate">
                {userEmail}
              </span>
            </div>
            <span
              className={`pill ${
                userRole === "ADMIN" ? "gold" : "muted"
              } text-[0.65rem] tracking-wider`}
            >
              {userRole}
            </span>
          </div>

          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="w-full flex items-center justify-center gap-2 mt-2 px-3 py-1.5 rounded-[3px] text-xs text-slate-300 bg-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.15)] hover:text-white transition"
            id="logout-btn"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar */}
        <header className="h-14 bg-white border-b border-[var(--hairline)] px-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
              Ledger Book System
            </span>
            <span className="text-xs text-[var(--hairline-strong)]">/</span>
            <span className="text-xs font-medium text-[var(--pine)]">
              {navItems.find((n) =>
                n.href === "/" ? pathname === "/" : pathname.startsWith(n.href)
              )?.label || "Dashboard"}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {userRole === "VIEWER" && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[var(--gold-bg)] border border-[var(--gold-soft)] rounded text-xs text-[#624510]">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Read-Only Viewer</span>
              </div>
            )}
            <div className="text-xs text-[var(--ink-muted)] font-mono">
              {new Date().toLocaleDateString("en-US", {
                weekday: "short",
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </div>
          </div>
        </header>

        {/* Content Wrapper */}
        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
