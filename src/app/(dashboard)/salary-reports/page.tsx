"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import Papa from "papaparse";
import {
  Receipt,
  Calculator,
  ChevronLeft,
  ChevronRight,
  Download,
  AlertCircle,
  CheckCircle,
  ShieldAlert,
  Users,
  Coins,
  Calendar,
} from "lucide-react";
import { formatDisplayDate } from "@/src/lib/formatters";

interface Worker {
  id: string;
  name: string;
  monthlySalary: number | string;
}

interface SalaryReportLine {
  id: string;
  workerId: string;
  worker: Worker;
  presentDays: number;
  paidSundays: number;
  paidHolidays: number;
  totalPaidDays: number;
  salaryAmount: number | string;
}

interface SalaryReport {
  id: string;
  month: string;
  totalPayroll: number | string;
  generatedAt: string;
  lines: SalaryReportLine[];
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default function SalaryReportsPage() {
  const { data: session } = useSession();
  const userRole = (session?.user as { role?: string })?.role || "VIEWER";
  const isAdmin = userRole === "ADMIN";

  // Default to October 2026
  const [year, setYear] = useState<number>(2026);
  const [month, setMonth] = useState<number>(10);

  const [report, setReport] = useState<SalaryReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const pad2 = (n: number) => String(n).padStart(2, "0");
  const monthKey = `${year}-${pad2(month)}`;
  const daysInMonth = useMemo(() => new Date(year, month, 0).getDate(), [year, month]);

  // Fetch Existing Report for Month
  const fetchReport = async () => {
    try {
      setLoading(true);
      setStatusMsg(null);
      const res = await fetch(`/api/reports/${monthKey}`);
      if (res.ok) {
        const data = await res.json();
        setReport(data);
      } else if (res.status === 404) {
        setReport(null);
      } else {
        setStatusMsg({ type: "error", text: "Failed to load report for this month." });
      }
    } catch {
      setStatusMsg({ type: "error", text: "Network error loading salary report." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [year, month]);

  // Navigate Month
  const handlePrevMonth = () => {
    if (month === 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (month === 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  // Generate / Recalculate Salary Report
  const handleCalculateSalary = async () => {
    if (!isAdmin) return;
    try {
      setCalculating(true);
      setStatusMsg(null);

      const res = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, month }),
      });

      if (res.ok) {
        const data = await res.json();
        setReport(data);
        setStatusMsg({
          type: "success",
          text: `Salary report for ${MONTH_NAMES[month - 1]} ${year} generated successfully.`,
        });
      } else {
        const err = await res.json();
        setStatusMsg({ type: "error", text: err.error || "Failed to generate report." });
      }
    } catch {
      setStatusMsg({ type: "error", text: "Network error generating salary report." });
    } finally {
      setCalculating(false);
    }
  };

  // Export CSV Statement
  const handleExportCSV = () => {
    if (!report || !report.lines || report.lines.length === 0) return;

    const exportRows = report.lines.map((line) => {
      const monthlyNum = Number(line.worker.monthlySalary);
      const dailyRate = (monthlyNum / 30).toFixed(2);
      const salaryNum = Number(line.salaryAmount);

      return {
        "Worker ID": line.workerId,
        "Worker Name": line.worker.name,
        "Monthly Base Salary (INR)": monthlyNum,
        "Daily Rate (INR)": dailyRate,
        "Present Days (Mon-Sat)": line.presentDays,
        "Paid Sundays": line.paidSundays,
        "Paid Public Holidays": line.paidHolidays,
        "Total Paid Days": line.totalPaidDays,
        "Net Salary Payable (INR)": salaryNum.toFixed(2),
      };
    });

    const csv = Papa.unparse(exportRows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `payroll_statement_${monthKey}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalPayrollNum = report ? Number(report.totalPayroll) : 0;

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--ink)] tracking-tight">
            Monthly Salary Reports
          </h1>
          <p className="text-sm text-[var(--ink-muted)] mt-1">
            Automated payroll settlement with exact Sunday adjacency adjudication.
          </p>
        </div>

        {/* Action Buttons & Month Switcher */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Month Switcher */}
          <div className="inline-flex items-center bg-white border border-[var(--hairline-strong)] rounded-[3px] overflow-hidden">
            <button
              onClick={handlePrevMonth}
              id="report-prev-month-btn"
              className="p-1.5 hover:bg-[var(--paper-panel)] text-[var(--ink-muted)] transition"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span
              id="report-month-display"
              className="px-3 py-1 font-serif text-sm font-semibold text-[var(--ink)] tracking-wide min-w-[140px] text-center"
            >
              {MONTH_NAMES[month - 1]} {year}
            </span>
            <button
              onClick={handleNextMonth}
              id="report-next-month-btn"
              className="p-1.5 hover:bg-[var(--paper-panel)] text-[var(--ink-muted)] transition"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Export CSV Button */}
          {report && (
            <button
              onClick={handleExportCSV}
              id="export-report-csv-btn"
              className="btn secondary sm"
              title="Export statement as CSV"
            >
              <Download className="w-3.5 h-3.5 text-[var(--ink-muted)]" />
              <span>Export CSV</span>
            </button>
          )}

          {/* Calculate Salary Button (Admin Only) */}
          {isAdmin && (
            <button
              onClick={handleCalculateSalary}
              id="calculate-salary-btn"
              disabled={calculating}
              className="btn sm"
            >
              <Calculator className="w-3.5 h-3.5" />
              <span>{calculating ? "Calculating..." : report ? "Recalculate Payroll" : "Calculate Salary"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Role Notice */}
      {!isAdmin && (
        <div className="note info flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-[var(--pine)] shrink-0" />
          <span>
            <strong>View-Only Notice:</strong> Only administrators can trigger payroll calculation and ledger commits.
          </span>
        </div>
      )}

      {/* Status Alert */}
      {statusMsg && (
        <div
          className={`note flex items-center justify-between ${
            statusMsg.type === "success"
              ? "!bg-[var(--olive-soft)] !text-[var(--olive)] !border-[var(--olive)]"
              : "!bg-[var(--brick-soft)] !text-[var(--brick)] !border-[var(--brick)]"
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMsg.type === "success" ? (
              <CheckCircle className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{statusMsg.text}</span>
          </div>
          <button onClick={() => setStatusMsg(null)} className="text-xs font-bold">×</button>
        </div>
      )}

      {/* Top Stat Summary Cards when Report Exists */}
      {report && (
        <div className="stat-row">
          <div className="stat">
            <div className="flex items-center justify-between">
              <span className="label">Total Payroll Disbursed</span>
              <Coins className="w-4 h-4 text-[var(--gold)]" />
            </div>
            <div className="value text-[var(--pine-deep)]">
              ₹{totalPayrollNum.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
            <div className="sub">Net payable for {MONTH_NAMES[month - 1]} {year}</div>
          </div>

          <div className="stat">
            <div className="flex items-center justify-between">
              <span className="label">Total Workers Listed</span>
              <Users className="w-4 h-4 text-[var(--pine)]" />
            </div>
            <div className="value">{report.lines.length}</div>
            <div className="sub">Eligible staff on active roster</div>
          </div>

          <div className="stat">
            <div className="flex items-center justify-between">
              <span className="label">Calendar Month Days</span>
              <Calendar className="w-4 h-4 text-[var(--olive)]" />
            </div>
            <div className="value">{daysInMonth}</div>
            <div className="sub">Daily wage divisor base: 30 days</div>
          </div>

          <div className="stat">
            <div className="flex items-center justify-between">
              <span className="label">Statement Status</span>
              <Receipt className="w-4 h-4 text-[var(--gold-soft)]" />
            </div>
            <div className="value text-base font-serif text-[var(--olive)] mt-1">
              Settled & Audited
            </div>
            <div className="sub font-mono text-[0.68rem]">
              Generated {formatDisplayDate(report.generatedAt)}
            </div>
          </div>
        </div>
      )}

      {/* Report Table Panel */}
      <div className="panel">
        <div className="panel-header">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-[var(--pine)]" />
            <h2 className="panel-title">
              Payroll Statement — {MONTH_NAMES[month - 1]} {year}
            </h2>
          </div>
          {report && (
            <span className="pill green">
              {report.lines.length} Line Items
            </span>
          )}
        </div>

        <div className="p-0 overflow-x-auto">
          {loading ? (
            <div className="p-12 text-center text-xs text-[var(--ink-muted)]">
              Checking records for {MONTH_NAMES[month - 1]} {year}...
            </div>
          ) : !report ? (
            <div className="p-12 text-center">
              <Receipt className="w-8 h-8 text-[var(--hairline-strong)] mx-auto mb-2" />
              <p className="text-sm font-medium text-[var(--ink)] mb-1">
                No salary report calculated yet for {MONTH_NAMES[month - 1]} {year}.
              </p>
              <p className="text-xs text-[var(--ink-muted)] max-w-md mx-auto mb-4">
                Verify worker records and attendance entries, then click &quot;Calculate Salary&quot; to generate the official ledger settlement.
              </p>
              {isAdmin && (
                <button
                  onClick={handleCalculateSalary}
                  disabled={calculating}
                  className="btn"
                >
                  <Calculator className="w-4 h-4" />
                  <span>{calculating ? "Calculating..." : "Calculate Salary Now"}</span>
                </button>
              )}
            </div>
          ) : report.lines.length === 0 ? (
            <div className="p-8 text-center text-xs text-[var(--ink-muted)]">
              No active worker lines in this report.
            </div>
          ) : (
            <table className="ledger-table" id="salary-report-table">
              <thead>
                <tr>
                  <th>Worker Name</th>
                  <th>Monthly Scale</th>
                  <th>Daily Scale</th>
                  <th>Present Days</th>
                  <th>Paid Sundays</th>
                  <th>Paid Holidays</th>
                  <th>Total Paid Days</th>
                  <th className="text-right">Net Salary</th>
                </tr>
              </thead>
              <tbody>
                {report.lines.map((line) => {
                  const monthlyNum = Number(line.worker.monthlySalary);
                  const dailyNum = (monthlyNum / 30).toFixed(2);
                  const salaryNum = Number(line.salaryAmount);

                  return (
                    <tr key={line.id} id={`line-${line.worker.name.replace(/\s+/g, "").toLowerCase()}`}>
                      {/* Worker Name */}
                      <td className="font-medium text-[var(--ink)]">
                        {line.worker.name}
                      </td>

                      {/* Monthly Salary */}
                      <td className="font-mono text-xs">
                        ₹{monthlyNum.toLocaleString("en-IN")}
                      </td>

                      {/* Daily Scale */}
                      <td className="font-mono text-xs text-[var(--ink-muted)]">
                        ₹{dailyNum}
                      </td>

                      {/* Present Days */}
                      <td className="font-mono text-center">
                        <span className="pill green">{line.presentDays}</span>
                      </td>

                      {/* Paid Sundays */}
                      <td className="font-mono text-center">
                        <span className="pill gold">{line.paidSundays}</span>
                      </td>

                      {/* Paid Holidays */}
                      <td className="font-mono text-center">
                        <span className="pill muted">{line.paidHolidays}</span>
                      </td>

                      {/* Total Paid Days */}
                      <td className="font-mono font-bold text-center text-[var(--ink)]">
                        {line.totalPaidDays} / {daysInMonth}
                      </td>

                      {/* Net Salary Payable */}
                      <td className="text-right font-mono font-bold text-sm text-[var(--pine)]">
                        ₹{salaryNum.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={6} className="font-serif text-xs font-bold uppercase tracking-wider text-[var(--ink)]">
                    Total Organizational Payroll Disbursal
                  </td>
                  <td className="font-mono text-center font-bold">
                    {report.lines.reduce((acc, l) => acc + l.totalPaidDays, 0)} days
                  </td>
                  <td className="text-right font-serif font-bold text-base text-[var(--pine-deep)]" id="total-payroll-amount">
                    ₹{totalPayrollNum.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
