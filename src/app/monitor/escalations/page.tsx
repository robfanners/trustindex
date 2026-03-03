"use client";

import { useCallback, useEffect, useState } from "react";
import TierGate from "@/components/TierGate";

type Escalation = {
  id: string;
  organisation_id: string;
  severity: string;
  resolved: boolean;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  trigger_type: string | null;
  trigger_detail: string | null;
};

const severityBadge: Record<string, string> = {
  low: "bg-blue-100 text-blue-800",
  medium: "bg-amber-100 text-amber-800",
  high: "bg-red-100 text-red-800",
  critical: "bg-red-200 text-red-900",
};

export default function EscalationsPage() {
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [severity, setSeverity] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [page, setPage] = useState(1);
  const perPage = 20;

  const fetchEscalations = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        per_page: String(perPage),
      });
      if (severity) params.set("severity", severity);
      if (status === "open") params.set("resolved", "false");
      if (status === "resolved") params.set("resolved", "true");
      const res = await fetch(`/api/trustgraph/escalations?${params}`);
      if (res.ok) {
        const data = await res.json();
        setEscalations(data.escalations ?? []);
        setTotal(data.total ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, [severity, status, page]);

  useEffect(() => {
    fetchEscalations();
  }, [fetchEscalations]);

  const resolveEscalation = async (escalationId: string) => {
    setResolvingId(escalationId);
    try {
      const res = await fetch("/api/trustgraph/escalations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ escalation_id: escalationId }),
      });
      if (res.ok) {
        await fetchEscalations();
      }
    } finally {
      setResolvingId(null);
    }
  };

  const totalPages = Math.ceil(total / perPage);

  return (
    <TierGate requiredTier="Assure" featureLabel="Escalations">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-brand/10 text-brand">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4m0 4h.01" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Escalations</h1>
            <p className="text-sm text-muted-foreground">Auto-triggered when governance thresholds are breached</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <select
            value={severity}
            onChange={(e) => {
              setSeverity(e.target.value);
              setPage(1);
            }}
            className="px-3 py-1.5 rounded-lg border border-border bg-background text-sm"
          >
            <option value="">All severities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="px-3 py-1.5 rounded-lg border border-border bg-background text-sm"
          >
            <option value="">All statuses</option>
            <option value="open">Open</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>

        {/* Content */}
        {loading ? (
          <div className="text-sm text-muted-foreground py-8 text-center">Loading escalations...</div>
        ) : escalations.length === 0 ? (
          <div className="border border-dashed border-border rounded-xl p-12 text-center">
            <p className="text-sm text-muted-foreground">No escalations found</p>
          </div>
        ) : (
          <>
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Date</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Severity</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Status</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Resolved At</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {escalations.map((esc) => (
                    <tr key={esc.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">{new Date(esc.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            severityBadge[esc.severity] ?? "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {esc.severity.charAt(0).toUpperCase() + esc.severity.slice(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {esc.resolved ? (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-800">
                            Resolved
                          </span>
                        ) : (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                            Open
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {esc.resolved_at ? new Date(esc.resolved_at).toLocaleDateString() : "\u2014"}
                      </td>
                      <td className="px-4 py-3">
                        {!esc.resolved && (
                          <button
                            onClick={() => resolveEscalation(esc.id)}
                            disabled={resolvingId === esc.id}
                            className="px-2.5 py-1 text-xs font-medium rounded border border-border hover:bg-muted/50 transition-colors disabled:opacity-40"
                          >
                            {resolvingId === esc.id ? "Resolving..." : "Resolve"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{total} escalations total</span>
                <div className="flex gap-2">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="px-3 py-1 rounded border border-border disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <span className="px-3 py-1 text-muted-foreground">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="px-3 py-1 rounded border border-border disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </TierGate>
  );
}
