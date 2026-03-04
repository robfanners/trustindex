"use client";

import { useCallback, useEffect, useState } from "react";
import TierGate from "@/components/TierGate";

type DriftEvent = {
  id: string;
  run_id: string;
  run_type: "org" | "sys";
  delta_score: number;
  drift_flag: boolean;
  created_at: string;
};

export default function DriftPage() {
  const [events, setEvents] = useState<DriftEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runType, setRunType] = useState<string>("");
  const [days, setDays] = useState(90);
  const [page, setPage] = useState(1);
  const perPage = 20;

  const fetchDrift = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        days: String(days),
        page: String(page),
        per_page: String(perPage),
      });
      if (runType) params.set("run_type", runType);
      const res = await fetch(`/api/trustgraph/drift?${params}`);
      if (res.ok) {
        const data = await res.json();
        setEvents(data.drift_events ?? []);
        setTotal(data.total ?? 0);
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "Failed to load drift events");
      }
    } finally {
      setLoading(false);
    }
  }, [runType, days, page]);

  useEffect(() => {
    fetchDrift();
  }, [fetchDrift]);

  const totalPages = Math.ceil(total / perPage);

  return (
    <TierGate requiredTier="Assure" featureLabel="Drift & Alerts">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-brand/10 text-brand">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <polyline strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Drift & Alerts</h1>
            <p className="text-sm text-muted-foreground">Score changes detected across assessments</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <select
            value={runType}
            onChange={(e) => {
              setRunType(e.target.value);
              setPage(1);
            }}
            className="px-3 py-1.5 rounded-lg border border-border bg-background text-sm"
          >
            <option value="">All types</option>
            <option value="org">TrustOrg</option>
            <option value="sys">TrustSys</option>
          </select>
          <select
            value={days}
            onChange={(e) => {
              setDays(Number(e.target.value));
              setPage(1);
            }}
            className="px-3 py-1.5 rounded-lg border border-border bg-background text-sm"
          >
            <option value={30}>Last 30 days</option>
            <option value={60}>Last 60 days</option>
            <option value={90}>Last 90 days</option>
            <option value={180}>Last 180 days</option>
            <option value={365}>Last year</option>
          </select>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
            {error}
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="text-sm text-muted-foreground py-8 text-center">Loading drift events...</div>
        ) : events.length === 0 ? (
          <div className="border border-dashed border-border rounded-xl p-12 text-center">
            <p className="text-sm text-muted-foreground">No drift events detected in this period</p>
          </div>
        ) : (
          <>
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Date</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Type</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Score Change</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {events.map((ev) => (
                    <tr key={ev.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">{new Date(ev.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            ev.run_type === "org" ? "bg-blue-100 text-blue-800" : "bg-purple-100 text-purple-800"
                          }`}
                        >
                          {ev.run_type === "org" ? "TrustOrg" : "TrustSys"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={ev.delta_score > 0 ? "text-green-600" : "text-red-600"}>
                          {ev.delta_score > 0 ? "+" : ""}
                          {ev.delta_score.toFixed(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {ev.drift_flag ? (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-800">
                            Drift detected
                          </span>
                        ) : (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-800">
                            Normal
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{total} events total</span>
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
