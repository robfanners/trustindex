"use client";

import { useCallback, useEffect, useState } from "react";
import AuthenticatedShell from "@/components/AuthenticatedShell";
import RequireAuth from "@/components/RequireAuth";
import EmptyState from "@/components/ui/EmptyState";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AuditLog = {
  id: string;
  entity_type: string;
  entity_id: string;
  action_type: string;
  performed_by: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  profiles: { email: string; display_name: string | null } | null;
};

type Filters = {
  entityType: string;
  actionType: string;
  startDate: string;
  endDate: string;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ENTITY_TYPES = [
  "signal",
  "escalation",
  "incident",
  "action",
  "attestation",
  "approval",
  "provenance",
  "incident_lock",
  "exchange",
];

const ACTION_TYPES = [
  "created",
  "resolved",
  "status_change",
  "decided",
  "updated",
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AuditTrailPage() {
  return (
    <RequireAuth>
      <AuthenticatedShell>
        <AuditTrailContent />
      </AuthenticatedShell>
    </RequireAuth>
  );
}

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

function AuditTrailContent() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const perPage = 20;

  const [filters, setFilters] = useState<Filters>({
    entityType: "",
    actionType: "",
    startDate: "",
    endDate: "",
  });

  // Fetch logs
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      const offset = (page - 1) * perPage;
      params.set("limit", perPage.toString());
      params.set("offset", offset.toString());
      if (filters.entityType) params.set("entity_type", filters.entityType);
      if (filters.actionType) params.set("action_type", filters.actionType);
      if (filters.startDate) params.set("start_date", filters.startDate);
      if (filters.endDate) params.set("end_date", filters.endDate);

      const res = await fetch(`/api/audit-trail?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to load audit logs");
      }
      const data = await res.json();
      setLogs(data.logs || []);
      setTotal(data.total ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  }, [page, filters, perPage]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Pagination
  const totalPages = Math.ceil(total / perPage);

  // Format date for display
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Format entity type display
  const formatEntityType = (type: string) => {
    return type
      .replace(/_/g, " ")
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  // Format action type display
  const formatActionType = (type: string) => {
    const labels: Record<string, string> = {
      created: "Created",
      resolved: "Resolved",
      status_change: "Status Changed",
      decided: "Decided",
      updated: "Updated",
    };
    return labels[type] || type;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-brand/10 text-brand">
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-semibold">Audit Trail</h1>
          <p className="text-sm text-muted-foreground">
            View all governance actions and changes
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs text-muted-foreground mb-1.5 font-medium">
            Entity Type
          </label>
          <select
            value={filters.entityType}
            onChange={(e) => {
              setFilters((f) => ({ ...f, entityType: e.target.value }));
              setPage(1);
            }}
            className="w-full border border-border rounded-lg px-3 py-1.5 text-sm bg-background focus:outline-none focus:border-brand"
          >
            <option value="">All types</option>
            {ENTITY_TYPES.map((type) => (
              <option key={type} value={type}>
                {formatEntityType(type)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-muted-foreground mb-1.5 font-medium">
            Action Type
          </label>
          <select
            value={filters.actionType}
            onChange={(e) => {
              setFilters((f) => ({ ...f, actionType: e.target.value }));
              setPage(1);
            }}
            className="w-full border border-border rounded-lg px-3 py-1.5 text-sm bg-background focus:outline-none focus:border-brand"
          >
            <option value="">All actions</option>
            {ACTION_TYPES.map((type) => (
              <option key={type} value={type}>
                {formatActionType(type)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-muted-foreground mb-1.5 font-medium">
            From Date
          </label>
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => {
              setFilters((f) => ({ ...f, startDate: e.target.value }));
              setPage(1);
            }}
            className="w-full border border-border rounded-lg px-3 py-1.5 text-sm bg-background focus:outline-none focus:border-brand"
          />
        </div>

        <div>
          <label className="block text-xs text-muted-foreground mb-1.5 font-medium">
            To Date
          </label>
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => {
              setFilters((f) => ({ ...f, endDate: e.target.value }));
              setPage(1);
            }}
            className="w-full border border-border rounded-lg px-3 py-1.5 text-sm bg-background focus:outline-none focus:border-brand"
          />
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
          <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          Loading audit logs...
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="border border-red-200 bg-red-50 rounded-lg p-4 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && logs.length === 0 && (
        <EmptyState
          icon="📋"
          title="No audit logs"
          description="Governance actions and changes will appear here as your organisation evolves."
        />
      )}

      {/* Table */}
      {!loading && !error && logs.length > 0 && (
        <>
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Date & Time
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Actor
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Entity
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Action
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {formatDate(log.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm">
                        {log.profiles?.display_name || log.profiles?.email || "System"}
                      </div>
                      {log.profiles?.email && log.profiles.display_name && (
                        <div className="text-xs text-muted-foreground">
                          {log.profiles.email}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          {formatEntityType(log.entity_type)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-brand/10 text-brand font-medium">
                        {formatActionType(log.action_type)}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-xs text-muted-foreground max-w-xs truncate">
                      {log.metadata && Object.keys(log.metadata).length > 0
                        ? JSON.stringify(log.metadata).substring(0, 60) + "..."
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Showing {(page - 1) * perPage + 1} to{" "}
                {Math.min(page * perPage, total)} of {total} logs
              </span>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(p - 1, 1))}
                  className="px-3 py-1.5 rounded border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                <span className="px-3 py-1.5 text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                  className="px-3 py-1.5 rounded border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
