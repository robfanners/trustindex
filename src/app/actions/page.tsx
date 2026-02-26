"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AuthenticatedShell from "@/components/AuthenticatedShell";
import RequireAuth from "@/components/RequireAuth";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Action = {
  id: string;
  title: string;
  description: string | null;
  severity: "low" | "medium" | "high" | "critical";
  status: "open" | "in_progress" | "blocked" | "done";
  owner_id: string | null;
  due_date: string | null;
  linked_run_id: string | null;
  linked_run_type: "org" | "sys" | null;
  dimension_id: string | null;
  evidence: Record<string, unknown> | null;
  evidence_url: string | null;
  created_at: string;
  updated_at: string;
};

type Filters = {
  status: string;
  severity: string;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "blocked", label: "Blocked" },
  { value: "done", label: "Done" },
];

const SEVERITY_OPTIONS = [
  { value: "", label: "All severities" },
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const SEVERITY_STYLE: Record<string, string> = {
  critical: "bg-destructive/10 text-destructive",
  high: "bg-warning/10 text-warning",
  medium: "bg-brand/10 text-brand",
  low: "bg-muted text-muted-foreground",
};

const STATUS_STYLE: Record<string, string> = {
  open: "bg-blue-50 text-blue-700",
  in_progress: "bg-amber-50 text-amber-700",
  blocked: "bg-destructive/10 text-destructive",
  done: "bg-success/10 text-success",
};

const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  in_progress: "In Progress",
  blocked: "Blocked",
  done: "Done",
};

const NEXT_STATUS: Record<string, string> = {
  open: "in_progress",
  in_progress: "done",
  blocked: "in_progress",
};

const NEXT_STATUS_LABEL: Record<string, string> = {
  open: "Start",
  in_progress: "Complete",
  blocked: "Unblock",
};

// ---------------------------------------------------------------------------
// Actions Page
// ---------------------------------------------------------------------------

export default function ActionsPage() {
  return (
    <RequireAuth>
      <AuthenticatedShell>
        <ActionsContent />
      </AuthenticatedShell>
    </RequireAuth>
  );
}

function ActionsContent() {
  const [actions, setActions] = useState<Action[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState<Filters>({ status: "", severity: "" });
  const [transitioning, setTransitioning] = useState<string | null>(null);

  // Detail panel state
  const [selectedAction, setSelectedAction] = useState<Action | null>(null);
  const [updates, setUpdates] = useState<
    { id: string; update_type: string; new_value: Record<string, unknown> | null; updated_at: string }[]
  >([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  // Fetch actions
  const fetchActions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.status) params.set("status", filters.status);
      if (filters.severity) params.set("severity", filters.severity);

      const res = await fetch(`/api/actions?${params.toString()}`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Failed to load actions");
      }
      const data = await res.json();
      setActions(data.actions || []);
      setTotal(data.total ?? 0);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load actions");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchActions();
  }, [fetchActions]);

  // Transition status
  const handleTransition = async (action: Action) => {
    const nextStatus = NEXT_STATUS[action.status];
    if (!nextStatus) return;

    setTransitioning(action.id);
    try {
      const res = await fetch(`/api/actions/${action.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) throw new Error("Failed to update");
      const data = await res.json();
      setActions((prev) =>
        prev.map((a) => (a.id === action.id ? data.action : a))
      );
      if (selectedAction?.id === action.id) {
        setSelectedAction(data.action);
        loadUpdates(action.id);
      }
    } catch {
      // silent fail — user can retry
    } finally {
      setTransitioning(null);
    }
  };

  // Load action detail + updates
  const loadDetail = async (action: Action) => {
    setSelectedAction(action);
    setDetailLoading(true);
    setNoteText("");
    try {
      const res = await fetch(`/api/actions/${action.id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedAction(data.action);
        setUpdates(data.updates || []);
      }
    } catch {
      // silent
    } finally {
      setDetailLoading(false);
    }
  };

  const loadUpdates = async (actionId: string) => {
    const res = await fetch(`/api/actions/${actionId}/updates`);
    if (res.ok) {
      const data = await res.json();
      setUpdates(data.updates || []);
    }
  };

  // Add note
  const handleAddNote = async () => {
    if (!selectedAction || !noteText.trim()) return;
    setAddingNote(true);
    try {
      const res = await fetch(`/api/actions/${selectedAction.id}/updates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "note", content: noteText.trim() }),
      });
      if (res.ok) {
        setNoteText("");
        loadUpdates(selectedAction.id);
      }
    } catch {
      // silent
    } finally {
      setAddingNote(false);
    }
  };

  // Stats
  const openCount = actions.filter((a) => a.status === "open").length;
  const inProgressCount = actions.filter((a) => a.status === "in_progress").length;
  const criticalCount = actions.filter(
    (a) => a.severity === "critical" && a.status !== "done"
  ).length;
  const overdueCount = actions.filter(
    (a) => a.due_date && new Date(a.due_date) < new Date() && a.status !== "done"
  ).length;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Actions</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Track, assign, and resolve trust governance actions
        </p>
      </div>

      {/* Summary stats */}
      {!loading && actions.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatCard label="Open" value={openCount} />
          <StatCard label="In Progress" value={inProgressCount} />
          <StatCard
            label="Critical"
            value={criticalCount}
            highlight={criticalCount > 0}
          />
          <StatCard
            label="Overdue"
            value={overdueCount}
            highlight={overdueCount > 0}
          />
        </div>
      )}

      {/* Filters */}
      {!loading && total > 0 && (
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <select
            value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
            className="border border-border rounded-lg px-3 py-1.5 text-sm bg-card focus:outline-none focus:border-brand"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <select
            value={filters.severity}
            onChange={(e) =>
              setFilters((f) => ({ ...f, severity: e.target.value }))
            }
            className="border border-border rounded-lg px-3 py-1.5 text-sm bg-card focus:outline-none focus:border-brand"
          >
            {SEVERITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <span className="text-xs text-muted-foreground ml-auto">
            {total} action{total !== 1 ? "s" : ""}
          </span>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
          <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          Loading actions...
        </div>
      )}

      {/* Error */}
      {error && <div className="text-sm text-destructive py-4">{error}</div>}

      {/* Empty state */}
      {!loading && !error && actions.length === 0 && total === 0 && (
        <EmptyState hasFilters={!!(filters.status || filters.severity)} />
      )}

      {/* Filtered empty */}
      {!loading && !error && actions.length === 0 && total > 0 && (
        <div className="border border-border rounded-xl p-8 text-center">
          <p className="text-sm text-muted-foreground mb-3">
            No actions match the current filters.
          </p>
          <button
            type="button"
            onClick={() => setFilters({ status: "", severity: "" })}
            className="text-sm text-brand hover:underline"
          >
            Clear filters
          </button>
        </div>
      )}

      {/* Actions list + detail panel */}
      {!loading && !error && actions.length > 0 && (
        <div className="flex gap-6">
          {/* Table */}
          <div className={`border border-border rounded-xl overflow-hidden ${selectedAction ? "flex-1 min-w-0" : "w-full"}`}>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-border text-left">
                  <th className="px-4 py-3 font-medium text-muted-foreground">
                    Action
                  </th>
                  <th className="px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">
                    Severity
                  </th>
                  <th className="px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">
                    Status
                  </th>
                  <th className="px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">
                    Due
                  </th>
                  <th className="px-4 py-3 font-medium text-muted-foreground text-right">
                    Progress
                  </th>
                </tr>
              </thead>
              <tbody>
                {actions.map((action) => (
                  <tr
                    key={action.id}
                    className={`border-b border-border last:border-0 hover:bg-gray-50 transition-colors cursor-pointer ${
                      selectedAction?.id === action.id
                        ? "bg-brand/5"
                        : ""
                    }`}
                    onClick={() => loadDetail(action)}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground truncate max-w-[240px]">
                        {action.title}
                      </div>
                      {action.description && (
                        <div className="text-xs text-muted-foreground mt-0.5 truncate max-w-[240px]">
                          {action.description}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground sm:hidden mt-0.5">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${SEVERITY_STYLE[action.severity]}`}>
                          {action.severity}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${SEVERITY_STYLE[action.severity]}`}
                      >
                        {action.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[action.status]}`}
                      >
                        {STATUS_LABEL[action.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">
                      {action.due_date ? (
                        <span
                          className={
                            new Date(action.due_date) < new Date() &&
                            action.status !== "done"
                              ? "text-destructive font-medium"
                              : ""
                          }
                        >
                          {new Date(action.due_date).toLocaleDateString(
                            "en-GB",
                            { day: "numeric", month: "short" }
                          )}
                        </span>
                      ) : (
                        <span>&mdash;</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {action.status !== "done" &&
                        NEXT_STATUS[action.status] && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTransition(action);
                            }}
                            disabled={transitioning === action.id}
                            className="text-xs px-2.5 py-1 rounded bg-brand text-white hover:bg-brand/90 transition-colors disabled:opacity-50"
                          >
                            {transitioning === action.id
                              ? "..."
                              : NEXT_STATUS_LABEL[action.status]}
                          </button>
                        )}
                      {action.status === "done" && (
                        <span className="text-xs text-success font-medium">
                          Done
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Detail panel */}
          {selectedAction && (
            <div className="w-80 shrink-0 border border-border rounded-xl p-4 hidden lg:block max-h-[calc(100vh-200px)] overflow-y-auto">
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-sm font-semibold text-foreground leading-tight">
                  {selectedAction.title}
                </h3>
                <button
                  type="button"
                  onClick={() => setSelectedAction(null)}
                  className="text-muted-foreground hover:text-foreground text-xs ml-2 shrink-0"
                >
                  Close
                </button>
              </div>

              {selectedAction.description && (
                <p className="text-xs text-muted-foreground mb-3">
                  {selectedAction.description}
                </p>
              )}

              {/* Badges */}
              <div className="flex items-center gap-1.5 flex-wrap mb-4">
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${SEVERITY_STYLE[selectedAction.severity]}`}
                >
                  {selectedAction.severity}
                </span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[selectedAction.status]}`}
                >
                  {STATUS_LABEL[selectedAction.status]}
                </span>
                {selectedAction.due_date && (
                  <span className="text-[10px] text-muted-foreground">
                    Due{" "}
                    {new Date(selectedAction.due_date).toLocaleDateString(
                      "en-GB",
                      { day: "numeric", month: "short" }
                    )}
                  </span>
                )}
              </div>

              {/* Source link */}
              {selectedAction.linked_run_id &&
                selectedAction.linked_run_type === "sys" && (
                  <div className="text-xs text-muted-foreground mb-4">
                    From{" "}
                    <span className="text-brand">TrustSys assessment run</span>
                  </div>
                )}
              {selectedAction.linked_run_id &&
                selectedAction.linked_run_type === "org" && (
                  <div className="text-xs text-muted-foreground mb-4">
                    From{" "}
                    <span className="text-brand">TrustOrg survey run</span>
                  </div>
                )}

              {/* Source recommendation */}
              {selectedAction.evidence &&
                (selectedAction.evidence as Record<string, unknown>).source ===
                  "recommendation" && (
                  <div className="border border-border rounded-lg p-3 mb-4 bg-muted/50">
                    <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
                      Original Recommendation
                    </div>
                    <div className="text-xs text-foreground">
                      {String(
                        (
                          selectedAction.evidence as Record<string, unknown>
                        ).recommendation || ""
                      )}
                    </div>
                  </div>
                )}

              {/* Quick transition */}
              {selectedAction.status !== "done" &&
                NEXT_STATUS[selectedAction.status] && (
                  <button
                    type="button"
                    onClick={() => handleTransition(selectedAction)}
                    disabled={transitioning === selectedAction.id}
                    className="w-full mb-4 px-3 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand/90 transition-colors disabled:opacity-50"
                  >
                    {transitioning === selectedAction.id
                      ? "Updating..."
                      : `Mark as ${STATUS_LABEL[NEXT_STATUS[selectedAction.status]]}`}
                  </button>
                )}

              {/* Add note */}
              <div className="mb-4">
                <div className="text-xs font-medium text-muted-foreground mb-1.5">
                  Add note
                </div>
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Evidence, progress notes..."
                  rows={2}
                  className="w-full border border-border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand resize-none placeholder:text-muted-foreground/60"
                />
                <button
                  type="button"
                  onClick={handleAddNote}
                  disabled={addingNote || !noteText.trim()}
                  className="mt-1 text-xs px-2.5 py-1 rounded bg-muted text-foreground hover:bg-muted/80 transition-colors disabled:opacity-50"
                >
                  {addingNote ? "Saving..." : "Save note"}
                </button>
              </div>

              {/* Audit trail */}
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-2">
                  Activity
                </div>
                {detailLoading && (
                  <div className="text-xs text-muted-foreground">
                    Loading...
                  </div>
                )}
                {!detailLoading && updates.length === 0 && (
                  <div className="text-xs text-muted-foreground">
                    No activity yet.
                  </div>
                )}
                <div className="space-y-2">
                  {updates.map((u) => (
                    <div
                      key={u.id}
                      className="border-l-2 border-border pl-2.5 py-1"
                    >
                      <div className="text-[10px] text-muted-foreground">
                        {formatUpdateType(u.update_type)}
                        <span className="ml-1.5">
                          {new Date(u.updated_at).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      {u.new_value &&
                        typeof u.new_value === "object" &&
                        "content" in u.new_value && (
                          <div className="text-xs text-foreground mt-0.5">
                            {String(u.new_value.content)}
                          </div>
                        )}
                      {u.new_value &&
                        typeof u.new_value === "object" &&
                        "value" in u.new_value && (
                          <div className="text-xs text-foreground mt-0.5">
                            {String(u.new_value.value)}
                          </div>
                        )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div className="border border-border rounded-lg px-4 py-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={`text-xl font-bold ${
          highlight ? "text-destructive" : "text-foreground"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="border border-border rounded-xl p-8 text-center">
      <div className="w-12 h-12 rounded-full bg-brand/10 flex items-center justify-center mx-auto mb-4">
        <svg
          className="w-6 h-6 text-brand"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
      <h2 className="text-lg font-medium text-foreground mb-2">
        {hasFilters ? "No matching actions" : "No actions yet"}
      </h2>
      <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
        Actions are created from assessment recommendations. Complete a TrustOrg
        survey or TrustSys assessment to generate actionable recommendations.
      </p>
      <div className="flex items-center justify-center gap-3">
        <Link
          href="/trustorg"
          className="text-sm px-4 py-2 rounded-lg border border-border text-foreground hover:bg-muted transition-colors"
        >
          TrustOrg Surveys
        </Link>
        <Link
          href="/trustsys"
          className="text-sm px-4 py-2 rounded-lg bg-brand text-white hover:bg-brand/90 transition-colors"
        >
          TrustSys Assessments
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatUpdateType(type: string): string {
  if (type === "created") return "Created";
  if (type === "note_added") return "Note added";
  if (type === "evidence_added") return "Evidence added";
  if (type.startsWith("field_change:")) {
    const field = type.replace("field_change:", "");
    const labels: Record<string, string> = {
      status: "Status changed",
      severity: "Severity changed",
      owner_id: "Owner changed",
      due_date: "Due date changed",
      title: "Title updated",
      description: "Description updated",
      evidence_url: "Evidence URL updated",
      evidence: "Evidence updated",
    };
    return labels[field] || `${field} changed`;
  }
  return type;
}
