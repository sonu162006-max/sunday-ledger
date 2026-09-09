"use client";

import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Papa from "papaparse";
import {
  Users,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Download,
  Upload,
  Search,
  AlertCircle,
  ShieldAlert,
} from "lucide-react";
import { formatDisplayDate } from "@/src/lib/formatters";

interface Worker {
  id: string;
  name: string;
  monthlySalary: number | string;
  isActive: boolean;
  joinDate: string;
  createdAt: string;
}

export default function WorkersPage() {
  const { data: session } = useSession();
  const userRole = (session?.user as { role?: string })?.role || "VIEWER";
  const isAdmin = userRole === "ADMIN";

  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Add Worker Form State
  const [name, setName] = useState("");
  const [salary, setSalary] = useState("");
  const [joinDate, setJoinDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [submitting, setSubmitting] = useState(false);

  // Edit Row State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editSalary, setEditSalary] = useState("");
  const [editActive, setEditActive] = useState(true);

  const fetchWorkers = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/workers");
      if (res.ok) {
        const data = await res.json();
        setWorkers(data);
      } else {
        setErrorMsg("Failed to load worker records.");
      }
    } catch {
      setErrorMsg("Network error loading workers.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkers();
  }, []);

  // Add Worker Submit
  const handleAddWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setErrorMsg("");
    setSuccessMsg("");

    const salaryNum = parseFloat(salary);
    if (!name.trim() || isNaN(salaryNum) || salaryNum < 0 || !joinDate) {
      setErrorMsg("Please provide a valid worker name, positive salary, and join date.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/workers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          monthlySalary: salaryNum,
          joinDate,
          isActive: true,
        }),
      });

      if (res.ok) {
        setSuccessMsg(`Worker "${name}" successfully enrolled.`);
        setName("");
        setSalary("");
        fetchWorkers();
      } else {
        const err = await res.json();
        setErrorMsg(err.error || "Failed to create worker.");
      }
    } catch {
      setErrorMsg("Network error adding worker.");
    } finally {
      setSubmitting(false);
    }
  };

  // Start Edit
  const handleStartEdit = (w: Worker) => {
    setEditingId(w.id);
    setEditName(w.name);
    setEditSalary(String(w.monthlySalary));
    setEditActive(w.isActive);
  };

  // Save Edit
  const handleSaveEdit = async (id: string) => {
    if (!isAdmin) return;
    const salaryNum = parseFloat(editSalary);
    if (!editName.trim() || isNaN(salaryNum) || salaryNum < 0) {
      setErrorMsg("Invalid name or monthly salary.");
      return;
    }

    try {
      const res = await fetch(`/api/workers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          monthlySalary: salaryNum,
          isActive: editActive,
        }),
      });

      if (res.ok) {
        setEditingId(null);
        setSuccessMsg("Worker record updated successfully.");
        fetchWorkers();
      } else {
        const err = await res.json();
        setErrorMsg(err.error || "Failed to update worker.");
      }
    } catch {
      setErrorMsg("Network error updating worker.");
    }
  };

  // Delete Worker
  const handleDeleteWorker = async (id: string, workerName: string) => {
    if (!isAdmin) return;
    if (!confirm(`Are you sure you want to delete worker "${workerName}"? All associated attendance records and report line items will cascade delete.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/workers/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setSuccessMsg(`Worker "${workerName}" deleted.`);
        fetchWorkers();
      } else {
        const err = await res.json();
        setErrorMsg(err.error || "Failed to delete worker.");
      }
    } catch {
      setErrorMsg("Network error deleting worker.");
    }
  };

  // CSV Template Download
  const handleDownloadTemplate = () => {
    const sampleData = [
      { name: "John Doe", monthlySalary: 30000, joinDate: "2026-01-15", isActive: true },
      { name: "Jane Smith", monthlySalary: 45000, joinDate: "2026-02-01", isActive: true },
    ];
    const csv = Papa.unparse(sampleData);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "workers_template.csv");
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
      complete: async (results) => {
        const rows = results.data as Array<{
          name?: string;
          monthlySalary?: string | number;
          joinDate?: string;
          isActive?: string | boolean;
        }>;

        const workersToUpload = [];
        for (const row of rows) {
          if (!row.name || !row.monthlySalary) continue;
          const salaryNum = parseFloat(String(row.monthlySalary));
          if (isNaN(salaryNum) || salaryNum < 0) continue;
          const jDate = row.joinDate || new Date().toISOString().split("T")[0];
          const active = row.isActive === undefined ? true : String(row.isActive).toLowerCase() !== "false";
          workersToUpload.push({
            name: row.name.trim(),
            monthlySalary: salaryNum,
            joinDate: jDate,
            isActive: active,
          });
        }

        if (workersToUpload.length === 0) {
          setErrorMsg("No valid worker records found in CSV.");
          return;
        }

        try {
          const res = await fetch("/api/workers/bulk", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ workers: workersToUpload }),
          });

          if (res.ok) {
            const data = await res.json();
            setSuccessMsg(`Bulk Import complete: Successfully enrolled ${data.count} workers.`);
            fetchWorkers();
          } else {
            const err = await res.json();
            setErrorMsg(err.error || "Failed to bulk upload workers.");
          }
        } catch {
          setErrorMsg("Network error during bulk worker upload.");
        } finally {
          e.target.value = "";
        }
      },
      error: (err) => {
        setErrorMsg(`Failed to parse CSV: ${err.message}`);
      },
    });
  };

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  const filteredWorkers = workers.filter((w) =>
    w.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filteredWorkers.length / pageSize));
  const paginatedWorkers = filteredWorkers.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--ink)] tracking-tight">
            Worker Registry
          </h1>
          <p className="text-sm text-[var(--ink-muted)] mt-1">
            Maintain active staff, monthly wage scales, and enrollment history.
          </p>
        </div>

        {/* CSV Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadTemplate}
            id="download-template-btn"
            className="btn secondary sm"
            title="Download blank CSV template"
          >
            <Download className="w-3.5 h-3.5 text-[var(--ink-muted)]" />
            <span>CSV Template</span>
          </button>

          {isAdmin && (
            <label
              htmlFor="csv-upload-input"
              className="btn secondary sm cursor-pointer"
              title="Upload CSV to bulk import workers"
            >
              <Upload className="w-3.5 h-3.5 text-[var(--ink-muted)]" />
              <span>Bulk Import</span>
              <input
                id="csv-upload-input"
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileUpload}
              />
            </label>
          )}
        </div>
      </div>

      {/* View-Only Mode Warning for Viewer */}
      {!isAdmin && (
        <div className="note info flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-[var(--pine)] shrink-0" />
          <span>
            <strong>View-Only Notice:</strong> You are logged in with <em>Viewer</em> privileges. Adding, editing, and deleting workers requires an Administrator role.
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

      {/* Add Worker Inline Card (Admin Only) */}
      {isAdmin && (
        <div className="panel">
          <div className="panel-header">
            <div className="flex items-center gap-2">
              <Plus className="w-4 h-4 text-[var(--pine)]" />
              <h2 className="panel-title">Enroll New Worker</h2>
            </div>
          </div>
          <form onSubmit={handleAddWorker} className="panel-body">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <div>
                <label className="block text-xs font-semibold uppercase text-[var(--ink-muted)] mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  id="add-worker-name"
                  placeholder="e.g. Alice Sharma"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input w-full"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-[var(--ink-muted)] mb-1">
                  Monthly Salary (₹) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  id="add-worker-salary"
                  placeholder="e.g. 30000"
                  value={salary}
                  onChange={(e) => setSalary(e.target.value)}
                  className="input w-full"
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold uppercase text-[var(--ink-muted)]">
                    Joining Date *
                  </label>
                  {joinDate && (
                    <span className="text-[0.68rem] font-mono text-[var(--pine)] font-semibold">
                      {formatDisplayDate(joinDate)}
                    </span>
                  )}
                </div>
                <input
                  type="date"
                  id="add-worker-join-date"
                  value={joinDate}
                  onChange={(e) => setJoinDate(e.target.value)}
                  className="input w-full"
                  required
                />
              </div>

              <div>
                <button
                  type="submit"
                  id="add-worker-submit"
                  disabled={submitting}
                  className="btn w-full"
                >
                  <Plus className="w-4 h-4" />
                  <span>{submitting ? "Enrolling..." : "Enroll Worker"}</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Search & Worker Roster Table */}
      <div className="panel">
        <div className="panel-header">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[var(--pine)]" />
            <h2 className="panel-title">Active Ledger Directory ({filteredWorkers.length})</h2>
          </div>
          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[var(--ink-muted)]" />
            <input
              type="text"
              id="search-workers"
              placeholder="Filter by worker name..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="input w-full pl-8 text-xs"
            />
          </div>
        </div>

        <div className="p-0 overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center text-xs text-[var(--ink-muted)]">
              Loading worker registry...
            </div>
          ) : filteredWorkers.length === 0 ? (
            <div className="p-8 text-center text-xs text-[var(--ink-muted)]">
              {searchQuery ? "No workers match your search." : "No workers enrolled yet."}
            </div>
          ) : (
            <>
              <table className="ledger-table">
                <thead>
                  <tr>
                    <th>Worker Name</th>
                    <th>Monthly Salary</th>
                    <th>Daily Scale (÷ 30)</th>
                    <th>Joining Date</th>
                    <th>Status</th>
                    {isAdmin && <th className="text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {paginatedWorkers.map((w) => {
                    const isEditing = editingId === w.id;
                    const monthlyNum = Number(w.monthlySalary);
                    const dailyNum = (monthlyNum / 30).toFixed(2);

                    return (
                      <tr key={w.id} id={`worker-row-${w.id}`}>
                        {/* Name */}
                        <td className="font-medium text-[var(--ink)]">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="input text-xs w-48"
                            />
                          ) : (
                            <span>{w.name}</span>
                          )}
                        </td>

                        {/* Monthly Salary */}
                        <td className="font-mono">
                          {isEditing ? (
                            <input
                              type="number"
                              step="0.01"
                              value={editSalary}
                              onChange={(e) => setEditSalary(e.target.value)}
                              className="input text-xs w-32"
                            />
                          ) : (
                            `₹${monthlyNum.toLocaleString("en-IN")}`
                          )}
                        </td>

                        {/* Daily Scale */}
                        <td className="font-mono text-[var(--ink-muted)]">
                          ₹{dailyNum}
                        </td>

                        {/* Joining Date */}
                        <td className="font-mono text-xs text-[var(--ink)]">
                          {formatDisplayDate(w.joinDate)}
                        </td>

                        {/* Status */}
                        <td>
                          {isEditing ? (
                            <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                              <input
                                type="checkbox"
                                checked={editActive}
                                onChange={(e) => setEditActive(e.target.checked)}
                                className="rounded border-[var(--hairline-strong)]"
                              />
                              <span>Active</span>
                            </label>
                          ) : w.isActive ? (
                            <span className="pill green">Active</span>
                          ) : (
                            <span className="pill red">Inactive</span>
                          )}
                        </td>

                        {/* Actions */}
                        {isAdmin && (
                          <td className="text-right">
                            {isEditing ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => handleSaveEdit(w.id)}
                                  className="btn sm bg-[var(--olive)] border-[var(--olive)] hover:bg-[#3d5a44]"
                                  title="Save changes"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setEditingId(null)}
                                  className="btn secondary sm"
                                  title="Cancel"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => handleStartEdit(w)}
                                  className="btn secondary sm"
                                  title="Edit worker"
                                >
                                  <Edit2 className="w-3.5 h-3.5 text-[var(--ink-muted)]" />
                                </button>
                                <button
                                  onClick={() => handleDeleteWorker(w.id, w.name)}
                                  className="btn danger sm"
                                  title="Delete worker (cascades records)"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
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
                      id="workers-prev-page-btn"
                      className="btn secondary sm"
                    >
                      Previous
                    </button>
                    <span className="px-2 font-medium">Page {currentPage} of {totalPages}</span>
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      id="workers-next-page-btn"
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
    </div>
  );
}
