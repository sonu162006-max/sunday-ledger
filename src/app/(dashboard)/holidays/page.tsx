"use client";

import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  Landmark,
  Plus,
  Trash2,
  AlertCircle,
  Check,
  ShieldAlert,
  Calendar,
  Sparkles,
} from "lucide-react";
import { formatDisplayDate } from "@/src/lib/formatters";

interface Holiday {
  id: string;
  date: string;
  name: string;
  createdAt: string;
}

export default function HolidaysPage() {
  const { data: session } = useSession();
  const userRole = (session?.user as { role?: string })?.role || "VIEWER";
  const isAdmin = userRole === "ADMIN";

  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Add Form State
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchHolidays = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/holidays");
      if (res.ok) {
        const data = await res.json();
        setHolidays(data);
      } else {
        setErrorMsg("Failed to load holidays calendar.");
      }
    } catch {
      setErrorMsg("Network error loading holidays.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHolidays();
  }, []);

  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setErrorMsg("");
    setSuccessMsg("");

    if (!date || !name.trim()) {
      setErrorMsg("Please provide both a valid date and holiday name.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          name: name.trim(),
        }),
      });

      if (res.ok) {
        setSuccessMsg(`Holiday "${name}" on ${date} successfully registered.`);
        setDate("");
        setName("");
        fetchHolidays();
      } else {
        const err = await res.json();
        setErrorMsg(err.error || "Failed to create holiday.");
      }
    } catch {
      setErrorMsg("Network error adding holiday.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteHoliday = async (id: string, holidayName: string, holidayDate: string) => {
    if (!isAdmin) return;
    if (!confirm(`Are you sure you want to remove the holiday "${holidayName}" (${holidayDate})?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/holidays/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setSuccessMsg(`Holiday "${holidayName}" removed.`);
        fetchHolidays();
      } else {
        const err = await res.json();
        setErrorMsg(err.error || "Failed to delete holiday.");
      }
    } catch {
      setErrorMsg("Network error removing holiday.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--ink)] tracking-tight">
          Holidays Calendar
        </h1>
        <p className="text-sm text-[var(--ink-muted)] mt-1">
          Sole source of truth for paid public and statutory holidays.
        </p>
      </div>

      {/* Role Notice */}
      {!isAdmin && (
        <div className="note info flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-[var(--pine)] shrink-0" />
          <span>
            <strong>View-Only Notice:</strong> Only administrators can declare or remove public holidays.
          </span>
        </div>
      )}

      {/* Feedback Messages */}
      {errorMsg && (
        <div className="note flex items-center justify-between !bg-[var(--brick-soft)] !text-[var(--brick)] !border-[var(--brick)]">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg("")} className="text-xs font-bold">×</button>
        </div>
      )}

      {successMsg && (
        <div className="note flex items-center justify-between !bg-[var(--olive-soft)] !text-[var(--olive)] !border-[var(--olive)]">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg("")} className="text-xs font-bold">×</button>
        </div>
      )}

      {/* Sunday Bridge Rule Note */}
      <div className="note">
        <div className="flex items-start gap-3">
          <Sparkles className="w-4.5 h-4.5 text-[var(--gold)] shrink-0 mt-0.5" />
          <div className="text-xs text-[#5C4010] leading-relaxed">
            <strong className="text-[#442D07] block text-sm mb-1">
              Holiday Adjacency Impact on Sunday Pay
            </strong>
            When a registered holiday falls on a <strong>Saturday</strong> or <strong>Monday</strong>,
            it is treated as <em>Present</em> for Sunday entitlement. Hence, an employee adjacent to a holiday Saturday/Monday
            remains entitled to Sunday pay even if their other adjacent day is absent.
          </div>
        </div>
      </div>

      {/* Add Holiday Form (Admin Only) */}
      {isAdmin && (
        <div className="panel">
          <div className="panel-header">
            <div className="flex items-center gap-2">
              <Plus className="w-4 h-4 text-[var(--pine)]" />
              <h2 className="panel-title">Register Public Holiday</h2>
            </div>
          </div>
          <form onSubmit={handleAddHoliday} className="panel-body">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold uppercase text-[var(--ink-muted)]">
                    Holiday Date *
                  </label>
                  {date && (
                    <span className="text-[0.68rem] font-mono text-[var(--pine)] font-semibold">
                      {formatDisplayDate(date)}
                    </span>
                  )}
                </div>
                <input
                  type="date"
                  id="add-holiday-date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="input w-full"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-[var(--ink-muted)] mb-1">
                  Occasion / Holiday Name *
                </label>
                <input
                  type="text"
                  id="add-holiday-name"
                  placeholder="e.g. Mid-month Holiday, Diwali, Republic Day"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input w-full"
                  required
                />
              </div>

              <div>
                <button
                  type="submit"
                  id="add-holiday-submit"
                  disabled={submitting}
                  className="btn w-full"
                >
                  <Plus className="w-4 h-4" />
                  <span>{submitting ? "Registering..." : "Add Public Holiday"}</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Holidays List Table */}
      <div className="panel">
        <div className="panel-header">
          <div className="flex items-center gap-2">
            <Landmark className="w-4 h-4 text-[var(--pine)]" />
            <h2 className="panel-title">Official Holiday Register ({holidays.length})</h2>
          </div>
        </div>

        <div className="p-0 overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center text-xs text-[var(--ink-muted)]">
              Loading holidays calendar...
            </div>
          ) : holidays.length === 0 ? (
            <div className="p-8 text-center text-xs text-[var(--ink-muted)]">
              No holidays declared yet. Use the form above to add holidays.
            </div>
          ) : (
            <table className="ledger-table">
              <thead>
                <tr>
                  <th>Holiday Date</th>
                  <th>Occasion Name</th>
                  <th>Day of Week</th>
                  <th>Payroll Classification</th>
                  {isAdmin && <th className="text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {holidays.map((h) => {
                  const dateStr = typeof h.date === "string" ? h.date.split("T")[0] : "";
                  const [y, m, d] = dateStr.split("-").map(Number);
                  const dateObj = new Date(Date.UTC(y, m - 1, d));
                  const dowStr = dateObj.toLocaleDateString("en-US", {
                    weekday: "long",
                    timeZone: "UTC",
                  });

                  return (
                    <tr key={h.id} id={`holiday-row-${h.id}`}>
                      <td className="font-mono font-semibold text-[var(--ink)]">
                        {formatDisplayDate(h.date)}
                      </td>
                      <td className="font-medium text-[var(--ink)]">
                        {h.name}
                      </td>
                      <td className="text-[var(--ink-muted)]">
                        {dowStr}
                      </td>
                      <td>
                        <span className="pill gold">
                          Paid Holiday (100%)
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="text-right">
                          <button
                            onClick={() => handleDeleteHoliday(h.id, h.name, dateStr)}
                            className="btn danger sm"
                            title="Remove holiday"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      )}
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
