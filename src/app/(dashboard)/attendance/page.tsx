"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import Papa from "papaparse";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Save,
  CheckCircle,
  Download,
  Upload,
  AlertCircle,
  ShieldAlert,
  Info,
  Search,
} from "lucide-react";
import { formatDisplayDate } from "@/src/lib/formatters";

interface Worker {
  id: string;
  name: string;
  monthlySalary: number | string;
  isActive: boolean;
}

interface Holiday {
  id: string;
  date: string;
  name: string;
}

interface AttendanceRecord {
  id?: string;
  workerId: string;
  date: string; // ISO string or YYYY-MM-DD
  status: "PRESENT" | "ABSENT";
}

const DOW_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default function AttendancePage() {
  const { data: session } = useSession();
  const userRole = (session?.user as { role?: string })?.role || "VIEWER";
  const isAdmin = userRole === "ADMIN";

  // Selected Year & Month (1-based month: 1 = Jan, 10 = Oct)
  const [year, setYear] = useState<number>(2026);
  const [month, setMonth] = useState<number>(10); // Default to October 2026

  const [workers, setWorkers] = useState<Worker[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, "PRESENT" | "ABSENT">>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Search & Pagination State for high scale
  const [workerSearch, setWorkerSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  const filteredWorkers = useMemo(() => {
    return workers.filter((w) =>
      w.name.toLowerCase().includes(workerSearch.toLowerCase())
    );
  }, [workers, workerSearch]);

  const totalPages = Math.max(1, Math.ceil(filteredWorkers.length / pageSize));
  const paginatedWorkers = useMemo(() => {
    return filteredWorkers.slice(
      (currentPage - 1) * pageSize,
      currentPage * pageSize
    );
  }, [filteredWorkers, currentPage, pageSize]);

  const daysInMonth = useMemo(() => new Date(year, month, 0).getDate(), [year, month]);

  const pad2 = (n: number) => String(n).padStart(2, "0");
  const getDateStr = (d: number) => `${year}-${pad2(month)}-${pad2(d)}`;

  // Set of holiday dates for fast lookup: "YYYY-MM-DD"
  const holidaySet = useMemo(() => {
    const set = new Set<string>();
    holidays.forEach((h) => {
      const dStr = typeof h.date === "string" ? h.date.split("T")[0] : "";
      if (dStr) set.add(dStr);
    });
    return set;
  }, [holidays]);

  // Load Workers, Holidays, and Month Attendance
  const loadMonthData = async () => {
    try {
      setLoading(true);
      setStatusMsg(null);
      setHasUnsavedChanges(false);

      const [wRes, hRes, aRes] = await Promise.all([
        fetch("/api/workers"),
        fetch("/api/holidays"),
        fetch(`/api/attendance?year=${year}&month=${month}`),
      ]);

      if (wRes.ok) {
        const wData = await wRes.json();
        setWorkers(wData.filter((w: Worker) => w.isActive));
      }
      if (hRes.ok) {
        setHolidays(await hRes.json());
      }
      if (aRes.ok) {
        const aData: AttendanceRecord[] = await aRes.json();
        const map: Record<string, "PRESENT" | "ABSENT"> = {};
        aData.forEach((rec) => {
          const datePart = rec.date.split("T")[0];
          map[`${rec.workerId}_${datePart}`] = rec.status;
        });
        setAttendanceMap(map);
      }
    } catch {
      setStatusMsg({ type: "error", text: "Failed to load attendance records." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMonthData();
  }, [year, month]);

  // Navigate Month
  const handlePrevMonth = () => {
    if (hasUnsavedChanges && !confirm("You have unsaved changes. Discard and change month?")) {
      return;
    }
    if (month === 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (hasUnsavedChanges && !confirm("You have unsaved changes. Discard and change month?")) {
      return;
    }
    if (month === 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  // Toggle Cell Attendance (P -> A -> P)
  const handleToggle = (workerId: string, day: number) => {
    if (!isAdmin) return;
    const dateStr = getDateStr(day);
    const key = `${workerId}_${dateStr}`;
    // Current status: default is PRESENT if not in map
    const currentStatus = attendanceMap[key] || "PRESENT";
    const nextStatus = currentStatus === "PRESENT" ? "ABSENT" : "PRESENT";

    setAttendanceMap((prev) => ({
      ...prev,
      [key]: nextStatus,
    }));
    setHasUnsavedChanges(true);
  };

  // Mark All Present for the current month
  const handleMarkAllPresent = () => {
    if (!isAdmin) return;
    const newMap = { ...attendanceMap };
    workers.forEach((w) => {
      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = getDateStr(d);
        newMap[`${w.id}_${dateStr}`] = "PRESENT";
      }
    });
    setAttendanceMap(newMap);
    setHasUnsavedChanges(true);
  };

  // Save changes to backend
  const handleSaveChanges = async () => {
    if (!isAdmin) return;
    try {
      setSaving(true);
      setStatusMsg(null);

      // Build records payload for current month
      const recordsToSave: { workerId: string; date: string; status: "PRESENT" | "ABSENT" }[] = [];
      workers.forEach((w) => {
        for (let d = 1; d <= daysInMonth; d++) {
          const dateStr = getDateStr(d);
          const key = `${w.id}_${dateStr}`;
          const status = attendanceMap[key] || "PRESENT";
          recordsToSave.push({
            workerId: w.id,
            date: dateStr,
            status,
          });
        }
      });

      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ records: recordsToSave }),
      });

      if (res.ok) {
        setHasUnsavedChanges(false);
        setStatusMsg({
          type: "success",
          text: `Saved attendance records for ${MONTH_NAMES[month - 1]} ${year} (${recordsToSave.length} entries).`,
        });
      } else {
        const err = await res.json();
        setStatusMsg({ type: "error", text: err.error || "Failed to save attendance." });
      }
    } catch {
      setStatusMsg({ type: "error", text: "Network error saving attendance." });
    } finally {
      setSaving(false);
    }
  };

  // CSV Template Export
  const handleDownloadTemplate = () => {
    const rows = workers.map((w) => ({
      workerId: w.id,
      workerName: w.name,
      date: getDateStr(1),
      status: "PRESENT",
    }));
    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `attendance_template_${year}_${pad2(month)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // CSV Bulk Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isAdmin) return;
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data as Array<{
          workerId?: string;
          date?: string;
          status?: string;
        }>;

        const newMap = { ...attendanceMap };
        let validRows = 0;

        rows.forEach((r) => {
          if (r.workerId && r.date && r.status) {
            const st = r.status.toUpperCase();
            if (st === "PRESENT" || st === "ABSENT") {
              newMap[`${r.workerId}_${r.date}`] = st as "PRESENT" | "ABSENT";
              validRows++;
            }
          }
        });

        if (validRows > 0) {
          setAttendanceMap(newMap);
          setHasUnsavedChanges(true);
          setStatusMsg({
            type: "success",
            text: `Imported ${validRows} records from CSV. Click 'Save Roster' to commit.`,
          });
        } else {
          setStatusMsg({ type: "error", text: "No valid attendance rows found in CSV." });
        }
        e.target.value = "";
      },
      error: (err) => {
        setStatusMsg({ type: "error", text: `CSV Parse error: ${err.message}` });
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Controls Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--ink)] tracking-tight">
            Attendance Roster Matrix
          </h1>
          <p className="text-sm text-[var(--ink-muted)] mt-1">
            Official monthly register. Unmarked cells default to Present (P).
          </p>
        </div>

        {/* Month Selector & Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Month Switcher */}
          <div className="inline-flex items-center bg-white border border-[var(--hairline-strong)] rounded-[3px] overflow-hidden">
            <button
              onClick={handlePrevMonth}
              id="prev-month-btn"
              className="p-1.5 hover:bg-[var(--paper-panel)] text-[var(--ink-muted)] transition"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span
              id="current-month-display"
              className="px-3 py-1 font-serif text-sm font-semibold text-[var(--ink)] tracking-wide min-w-[140px] text-center"
            >
              {MONTH_NAMES[month - 1]} {year}
            </span>
            <button
              onClick={handleNextMonth}
              id="next-month-btn"
              className="p-1.5 hover:bg-[var(--paper-panel)] text-[var(--ink-muted)] transition"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* CSV Download */}
          <button
            onClick={handleDownloadTemplate}
            id="download-att-template-btn"
            className="btn secondary sm"
            title="Download CSV template"
          >
            <Download className="w-3.5 h-3.5 text-[var(--ink-muted)]" />
            <span>Template</span>
          </button>

          {/* Admin Action Buttons */}
          {isAdmin && (
            <>
              <label
                htmlFor="att-csv-upload"
                className="btn secondary sm cursor-pointer"
                title="Import Attendance CSV"
              >
                <Upload className="w-3.5 h-3.5 text-[var(--ink-muted)]" />
                <span>Import CSV</span>
                <input
                  id="att-csv-upload"
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </label>

              <button
                onClick={handleMarkAllPresent}
                id="mark-all-present-btn"
                className="btn secondary sm"
                title="Set all days to Present for this month"
              >
                <CheckCircle className="w-3.5 h-3.5 text-[var(--olive)]" />
                <span>Mark All Present</span>
              </button>

              <button
                onClick={handleSaveChanges}
                id="save-attendance-btn"
                disabled={saving || !hasUnsavedChanges}
                className="btn sm"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{saving ? "Saving..." : hasUnsavedChanges ? "Save Changes *" : "Saved"}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Role Notice */}
      {!isAdmin && (
        <div className="note info flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-[var(--pine)] shrink-0" />
          <span>
            <strong>View-Only Mode:</strong> Only administrators can edit or save attendance records.
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

      {/* Legend & Guide & Worker Search */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-3 bg-white border border-[var(--hairline)] rounded-[3px] text-xs">
        <div className="flex flex-wrap items-center gap-4 text-[var(--ink-muted)]">
          <span className="font-semibold text-[var(--ink)]">Legend:</span>
          <div className="flex items-center gap-1.5">
            <span className="day-cell-btn present w-5 h-5 text-[0.65rem]">P</span>
            <span>Present (Paid)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="day-cell-btn absent w-5 h-5 text-[0.65rem]">A</span>
            <span>Absent (Unpaid)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="day-cell-btn holiday w-5 h-5 text-[0.65rem]">H</span>
            <span>Public Holiday</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="day-cell-btn sunday paid w-5 h-5 text-[0.65rem]">S</span>
            <span>Paid Sunday</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="day-cell-btn sunday unpaid w-5 h-5 text-[0.65rem]">S</span>
            <span className="text-[var(--brick)] font-medium">Unpaid Sunday</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-52">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-[var(--ink-muted)]" />
            <input
              type="text"
              id="att-search-workers"
              placeholder="Search workers..."
              value={workerSearch}
              onChange={(e) => {
                setWorkerSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="input w-full pl-8 py-1 text-xs"
            />
          </div>
          <div className="text-[var(--ink-muted)] hidden md:flex items-center gap-1">
            <Info className="w-3.5 h-3.5 text-[var(--gold)]" />
            <span>Click cell to toggle <strong>P / A</strong></span>
          </div>
        </div>
      </div>

      {/* Interactive Matrix Table */}
      <div className="att-container">
        {loading ? (
          <div className="p-12 text-center text-xs text-[var(--ink-muted)]">
            Loading {MONTH_NAMES[month - 1]} {year} attendance ledger...
          </div>
        ) : filteredWorkers.length === 0 ? (
          <div className="p-12 text-center text-xs text-[var(--ink-muted)]">
            {workerSearch ? "No workers match your search." : "No active workers found. Please enroll workers first."}
          </div>
        ) : (
          <>
            <table className="att-table">
              <thead>
                <tr>
                  <th className="sticky-col">Worker Name</th>
                  {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
                    const dObj = new Date(year, month - 1, d);
                    const dow = dObj.getDay();
                    const isSun = dow === 0;
                    const dateStr = getDateStr(d);
                    const isHol = holidaySet.has(dateStr);

                    return (
                      <th
                        key={d}
                        className={`${isSun ? "dow-sun font-bold" : ""} ${isHol ? "dow-hol" : ""}`}
                      >
                        <div className="text-[0.68rem] text-[var(--ink-muted)]">
                          {DOW_LABELS[dow]}
                        </div>
                        <div className="text-xs font-mono font-semibold text-[var(--ink)]">
                          {d}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {paginatedWorkers.map((worker) => (
                  <tr key={worker.id} id={`att-row-${worker.id}`}>
                    {/* Sticky Worker Column */}
                    <td className="sticky-col">
                      <div className="font-medium text-[var(--ink)] truncate max-w-[180px]">
                        {worker.name}
                      </div>
                      <div className="text-[0.65rem] text-[var(--ink-muted)] font-mono">
                        ₹{Number(worker.monthlySalary).toLocaleString("en-IN")}/mo
                      </div>
                    </td>

                    {/* Day Cells */}
                    {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
                      const dObj = new Date(year, month - 1, d);
                      const dow = dObj.getDay();
                      const isSun = dow === 0;
                      const dateStr = getDateStr(d);
                      const isHol = holidaySet.has(dateStr);
                      const key = `${worker.id}_${dateStr}`;
                      const status = attendanceMap[key] || "PRESENT";

                      // Compute Sunday Paid / Unpaid adjudication per salary.ts logic
                      let isSundayPaid = true;
                      let sundayReason = "";
                      if (isSun && !isHol) {
                        const prevSatDateStr = d - 1 >= 1 ? getDateStr(d - 1) : null;
                        const prevSatPresent = prevSatDateStr !== null && (
                          holidaySet.has(prevSatDateStr) ||
                          attendanceMap[`${worker.id}_${prevSatDateStr}`] !== "ABSENT"
                        );

                        const nextMonDateStr = d + 1 <= daysInMonth ? getDateStr(d + 1) : null;
                        const nextMonPresent = nextMonDateStr !== null && (
                          holidaySet.has(nextMonDateStr) ||
                          attendanceMap[`${worker.id}_${nextMonDateStr}`] !== "ABSENT"
                        );

                        isSundayPaid = prevSatPresent || nextMonPresent;
                        sundayReason = isSundayPaid
                          ? `PAID (Adjacent ${
                              prevSatPresent && nextMonPresent
                                ? "Saturday & Monday"
                                : prevSatPresent
                                ? "Saturday"
                                : "Monday"
                            } present/holiday)`
                          : "UNPAID (Both adjacent Saturday & Monday are absent or outside month)";
                      }

                      return (
                        <td
                          key={d}
                          className={`${isSun ? "dow-sun" : ""} ${isHol ? "dow-hol" : ""}`}
                        >
                          {isHol ? (
                            <div
                              className="day-cell-btn holiday"
                              title={`Public Holiday: ${formatDisplayDate(dateStr)}`}
                            >
                              H
                            </div>
                          ) : isSun ? (
                            <div
                              className={`day-cell-btn sunday ${isSundayPaid ? "paid" : "unpaid"}`}
                              id={`cell-${worker.name.replace(/\s+/g, "").toLowerCase()}-${d}-${isSundayPaid ? "paid" : "unpaid"}`}
                              title={`Sunday (${formatDisplayDate(dateStr)}): ${sundayReason}`}
                            >
                              S
                            </div>
                          ) : (
                            <button
                              type="button"
                              id={`cell-${worker.name.replace(/\s+/g, "").toLowerCase()}-${d}`}
                              disabled={!isAdmin}
                              onClick={() => handleToggle(worker.id, d)}
                              className={`day-cell-btn ${
                                status === "ABSENT" ? "absent" : "present"
                              }`}
                              title={`Day ${d} (${formatDisplayDate(dateStr)}) [${status}]: Click to toggle`}
                            >
                              {status === "ABSENT" ? "A" : "P"}
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>

            {totalPages > 1 && (
              <div className="p-3 border-t border-[var(--hairline)] bg-[var(--paper)] flex items-center justify-between text-xs text-[var(--ink-muted)]">
                <div>
                  Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filteredWorkers.length)} of {filteredWorkers.length} workers
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    id="att-prev-page-btn"
                    className="btn secondary sm"
                  >
                    Previous
                  </button>
                  <span className="px-2 font-medium">Page {currentPage} of {totalPages}</span>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    id="att-next-page-btn"
                    className="btn secondary sm"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
