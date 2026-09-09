"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  CalendarDays,
  Landmark,
  Receipt,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Calendar,
} from "lucide-react";
import { formatDisplayDate } from "@/src/lib/formatters";

interface Worker {
  id: string;
  name: string;
  monthlySalary: number;
  isActive: boolean;
  joinDate: string;
}

interface Holiday {
  id: string;
  date: string;
  name: string;
}

export default function DashboardOverviewPage() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [wRes, hRes] = await Promise.all([
          fetch("/api/workers"),
          fetch("/api/holidays"),
        ]);
        if (wRes.ok) setWorkers(await wRes.json());
        if (hRes.ok) setHolidays(await hRes.json());
      } catch (err) {
        console.error("Failed to load dashboard overview data", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const activeWorkers = workers.filter((w) => w.isActive);
  const upcomingHolidays = holidays.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--ink)] tracking-tight">
          Ledger Overview
        </h1>
        <p className="text-sm text-[var(--ink-muted)] mt-1">
          Real-time roster figures, automated Sunday rule governance, and operational records.
        </p>
      </div>

      {/* Top Stat Row */}
      <div className="stat-row">
        <div className="stat">
          <div className="flex items-center justify-between">
            <span className="label">Active Workers</span>
            <Users className="w-4 h-4 text-[var(--pine)]" />
          </div>
          <div className="value">{loading ? "..." : activeWorkers.length}</div>
          <div className="sub">{workers.length} total registered</div>
        </div>

        <div className="stat">
          <div className="flex items-center justify-between">
            <span className="label">Public Holidays</span>
            <Landmark className="w-4 h-4 text-[var(--gold)]" />
          </div>
          <div className="value">{loading ? "..." : holidays.length}</div>
          <div className="sub">Configured in official registry</div>
        </div>

        <div className="stat">
          <div className="flex items-center justify-between">
            <span className="label">Monthly Base Scale</span>
            <Receipt className="w-4 h-4 text-[var(--olive)]" />
          </div>
          <div className="value">
            {loading
              ? "..."
              : `₹${activeWorkers
                  .reduce((acc, w) => acc + Number(w.monthlySalary), 0)
                  .toLocaleString("en-IN")}`}
          </div>
          <div className="sub">Sum of monthly worker salaries</div>
        </div>

        <div className="stat">
          <div className="flex items-center justify-between">
            <span className="label">Rule Engine</span>
            <ShieldCheck className="w-4 h-4 text-[var(--pine-light)]" />
          </div>
          <div className="value text-base font-serif text-[var(--pine)] mt-1">
            Active & Verified
          </div>
          <div className="sub">Sunday adjacency & holiday overrides</div>
        </div>
      </div>

      {/* Sunday Rule Ledger Policy Banner */}
      <div className="note">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-[var(--gold)] shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-[#442D07] block text-sm mb-0.5">
              Sunday Wage Governance Policy
            </span>
            <p className="m-0 text-xs text-[#5C4010] leading-relaxed">
              <strong>1. Default Rule:</strong> Unmarked workdays default to <strong>PRESENT</strong>.<br />
              <strong>2. Adjacency Guarantee:</strong> A Sunday is paid if either the preceding Saturday or following Monday is present (or an approved holiday).<br />
              <strong>3. Unpaid Criterion:</strong> A Sunday is unpaid <em>only</em> if both adjacent Saturday and Monday are explicitly marked ABSENT or fall outside the calendar month boundary.
            </p>
          </div>
        </div>
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Link
          href="/workers"
          className="panel p-5 hover:border-[var(--pine)] transition group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 rounded-[3px] bg-[var(--pine-deep)] text-white flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <ArrowRight className="w-4 h-4 text-[var(--ink-faint)] group-hover:text-[var(--pine)] group-hover:translate-x-1 transition" />
          </div>
          <h3 className="text-base font-semibold text-[var(--ink)] mb-1">
            Worker Registry
          </h3>
          <p className="text-xs text-[var(--ink-muted)] line-clamp-2">
            Enroll workers, update monthly salary scales, and manage active ledger status.
          </p>
        </Link>

        <Link
          href="/attendance"
          className="panel p-5 hover:border-[var(--pine)] transition group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 rounded-[3px] bg-[var(--olive)] text-white flex items-center justify-center">
              <CalendarDays className="w-4 h-4" />
            </div>
            <ArrowRight className="w-4 h-4 text-[var(--ink-faint)] group-hover:text-[var(--olive)] group-hover:translate-x-1 transition" />
          </div>
          <h3 className="text-base font-semibold text-[var(--ink)] mb-1">
            Attendance Matrix
          </h3>
          <p className="text-xs text-[var(--ink-muted)] line-clamp-2">
            Interactive daily roster matrix, rapid bulk mark, and CSV import/export.
          </p>
        </Link>

        <Link
          href="/salary-reports"
          className="panel p-5 hover:border-[var(--pine)] transition group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 rounded-[3px] bg-[var(--gold)] text-white flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
            <ArrowRight className="w-4 h-4 text-[var(--ink-faint)] group-hover:text-[var(--gold)] group-hover:translate-x-1 transition" />
          </div>
          <h3 className="text-base font-semibold text-[var(--ink)] mb-1">
            Salary Calculation
          </h3>
          <p className="text-xs text-[var(--ink-muted)] line-clamp-2">
            Compute payroll breakdowns, audit Sunday pay statuses, and export statements.
          </p>
        </Link>
      </div>

      {/* Public Holidays & Quick Info */}
      <div className="panel">
        <div className="panel-header">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[var(--gold)]" />
            <h2 className="panel-title">Registered Public Holidays</h2>
          </div>
          <Link href="/holidays" className="btn secondary sm text-xs">
            Manage Calendar
          </Link>
        </div>
        <div className="p-0">
          {holidays.length === 0 ? (
            <div className="p-6 text-center text-xs text-[var(--ink-muted)]">
              No public holidays currently registered. Add holidays via the Holidays menu.
            </div>
          ) : (
            <table className="ledger-table">
              <thead>
                <tr>
                  <th>Holiday Date</th>
                  <th>Designation / Occasion</th>
                  <th>Day of Week</th>
                  <th>Payroll Impact</th>
                </tr>
              </thead>
              <tbody>
                {upcomingHolidays.map((h) => {
                  const dateObj = new Date(h.date);
                  return (
                    <tr key={h.id}>
                      <td className="font-mono font-medium">
                        {formatDisplayDate(h.date)}
                      </td>
                      <td className="font-medium text-[var(--ink)]">{h.name}</td>
                      <td className="text-[var(--ink-muted)]">
                        {dateObj.toLocaleDateString("en-US", { weekday: "long" })}
                      </td>
                      <td>
                        <span className="pill green">Paid Holiday (100%)</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
