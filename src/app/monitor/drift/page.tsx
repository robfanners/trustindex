"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import TierGate from "@/components/TierGate";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import DetailPanel from "@/components/ui/DetailPanel";
import OnboardingTour from "@/components/ui/OnboardingTour";

type DriftEvent = {
  id: string;
  run_id: string;
  run_type: "org" | "sys";
  delta_score: number;
  drift_flag: boolean;
  created_at: string;
};

type ReassessmentItem = {
  target_id: string;
  target_name: string;
  run_type: string;
  frequency_days: number;
  last_completed: string | null;
  next_due: string | null;
  days_until_due: number | null;
  status: "on_track" | "due_soon" | "overdue" | "no_schedule";
};

type DriftSummary = {
  p_drift: number;
  total_policies: number;
  stale_count: number;
  total_assessments: number;
};

const STATUS_BADGE: Record<string, string> = {
  on_track: "bg-green-100 text-green-800",
  due_soon: "bg-amber-100 text-amber-800",
  overdue: "bg-red-100 text-red-800",
  no_schedule: "bg-gray-100 text-gray-600",
};

const STATUS_LABEL: Record<string, string> = {
  on_track: "On track",
  due_soon: "Due soon",
  overdue: "Overdue",
  no_schedule: "No schedule",
};

export default function DriftPage() {
  const [events, setEvents] = useState<DriftEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [reassessment, setReassessment] = useState<ReassessmentItem[]>([]);
  const [summary, setSummary] = useState<DriftSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runType, setRunType] = useState<string>("");
  const [days, setDays] = useState(90);
  const [page, setPage] = useState(1);
  const perPage = 20;
  const [selectedItem, setSelectedItem] = useState<DriftEvent | null>(null);

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
        setReassessment(data.reassessment_status ?? []);
        setSummary(data.drift_summary ?? null);
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "Failed to load drift data");
      }
    } finally {
      setLoading(false);
    }
  }, [runType, days, page]);

  useEffect(() => {
    fetchDrift();
  }, [fetchDrift]);

  const totalPages = Math.ceil(total / perPage);
  const nextDue = reassessment.find((r) => r.next_due && r.status !== "overdue");

  return (
    <TierGate requiredTier="Assure" featureLabel="Drift & Alerts">
      <div className="space-y-6">
        {/* Header */}
        <div data-tour="page-header">
          <PageHeader
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <polyline strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            }
            title="Drift & Alerts"
            description="Score changes across governance assessments — tracking whether your trust posture is improving or degrading"
            workflowHint={[
              { label: "Drift", href: "/monitor/drift" },
              { label: "Dashboard", href: "/dashboard" },
            ]}
          />
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="text-sm text-muted-foreground py-8 text-center">Loading drift data...</div>
        ) : (
          <>
            {/* Summary Cards */}
            {summary && (
              <div data-tour="drift-summary" className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="border border-border rounded-lg p-4">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                    Drift Penalty
                  </p>
                  <p className="text-2xl font-semibold mt-1">
                    <span className={summary.p_drift > 0.1 ? "text-red-600" : summary.p_drift > 0 ? "text-amber-600" : "text-green-600"}>
                      {(summary.p_drift * 100).toFixed(0)}%
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Impact on overall health score
                  </p>
                </div>

                <div className="border border-border rounded-lg p-4">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                    Overdue Assessments
                  </p>
                  <p className="text-2xl font-semibold mt-1">
                    <span className={summary.stale_count > 0 ? "text-red-600" : "text-green-600"}>
                      {summary.stale_count}
                    </span>
                    <span className="text-base font-normal text-muted-foreground">
                      {" "}of {summary.total_policies} {summary.total_policies === 1 ? "policy" : "policies"}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Reassessments past their due date
                  </p>
                </div>

                <div className="border border-border rounded-lg p-4">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                    Next Due
                  </p>
                  <p className="text-2xl font-semibold mt-1">
                    {nextDue?.next_due ? (
                      <span className={nextDue.status === "due_soon" ? "text-amber-600" : ""}>
                        {new Date(nextDue.next_due).toLocaleDateString()}
                      </span>
                    ) : (
                      <span className="text-base font-normal text-muted-foreground">No upcoming</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {nextDue ? `${nextDue.target_name} (${nextDue.run_type === "org" ? "TrustOrg" : "TrustSys"})` : "Set up reassessment policies"}
                  </p>
                </div>
              </div>
            )}

            {/* Reassessment Status Table */}
            {reassessment.length > 0 && (
              <div data-tour="reassessment-status">
                <h2 className="text-base font-semibold mb-3">Reassessment Schedule</h2>
                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Assessment</th>
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Type</th>
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Frequency</th>
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Last Completed</th>
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Next Due</th>
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {reassessment.map((item) => (
                        <tr key={`${item.target_id}-${item.run_type}`} className="hover:bg-muted/50 transition-colors">
                          <td className="px-4 py-3 font-medium">{item.target_name}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                              item.run_type === "org" ? "bg-blue-100 text-blue-800" : "bg-purple-100 text-purple-800"
                            }`}>
                              {item.run_type === "org" ? "TrustOrg" : "TrustSys"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            Every {item.frequency_days} days
                          </td>
                          <td className="px-4 py-3">
                            {item.last_completed
                              ? new Date(item.last_completed).toLocaleDateString()
                              : <span className="text-muted-foreground">Never</span>}
                          </td>
                          <td className="px-4 py-3">
                            {item.next_due
                              ? new Date(item.next_due).toLocaleDateString()
                              : <span className="text-muted-foreground">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_BADGE[item.status]}`}>
                              {STATUS_LABEL[item.status]}
                              {item.days_until_due !== null && item.days_until_due < 0 && ` (${Math.abs(item.days_until_due)}d)`}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Filters for drift events */}
            <div>
              <h2 className="text-base font-semibold mb-3">Score Change History</h2>
              <div className="flex flex-wrap gap-3 mb-4">
                <select
                  value={runType}
                  onChange={(e) => { setRunType(e.target.value); setPage(1); }}
                  className="px-3 py-1.5 rounded-lg border border-border bg-background text-sm"
                >
                  <option value="">All types</option>
                  <option value="org">TrustOrg</option>
                  <option value="sys">TrustSys</option>
                </select>
                <select
                  value={days}
                  onChange={(e) => { setDays(Number(e.target.value)); setPage(1); }}
                  className="px-3 py-1.5 rounded-lg border border-border bg-background text-sm"
                >
                  <option value={30}>Last 30 days</option>
                  <option value={60}>Last 60 days</option>
                  <option value={90}>Last 90 days</option>
                  <option value={180}>Last 180 days</option>
                  <option value={365}>Last year</option>
                </select>
              </div>
            </div>

            {/* Drift Events Table */}
            {events.length === 0 ? (
              <div className="border border-border rounded-lg p-8 text-center">
                <p className="text-sm text-muted-foreground">
                  No score changes detected yet. Drift events are recorded automatically when
                  you complete a second assessment run, allowing comparison with the previous score.
                </p>
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-1 mt-3 text-sm text-brand hover:text-brand/80 font-medium transition-colors"
                >
                  Run an assessment
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            ) : (
              <>
                <div data-tour="drift-table" className="border border-border rounded-lg overflow-hidden">
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
                        <tr key={ev.id} onClick={() => setSelectedItem(ev)} className="cursor-pointer hover:bg-muted/50 transition-colors">
                          <td className="px-4 py-3">{new Date(ev.created_at).toLocaleDateString()}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                              ev.run_type === "org" ? "bg-blue-100 text-blue-800" : "bg-purple-100 text-purple-800"
                            }`}>
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

            {/* Empty state when nothing at all */}
            {reassessment.length === 0 && events.length === 0 && (
              <EmptyState
                icon={
                  <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <polyline strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} points="22 12 18 12 15 21 9 3 6 12 2 12" />
                  </svg>
                }
                title="No drift data yet"
                description="Run governance assessments and set up reassessment policies to start tracking drift. Reassessment schedules ensure your governance posture stays up to date."
                secondaryLabel="Go to Dashboard →"
                secondaryHref="/dashboard"
              />
            )}
          </>
        )}

        {/* Detail Panel */}
        <DetailPanel
          open={!!selectedItem}
          onClose={() => setSelectedItem(null)}
          title="Drift Event"
          subtitle={selectedItem ? (selectedItem.run_type === "org" ? "TrustOrg assessment" : "TrustSys assessment") : undefined}
        >
          {selectedItem && (
            <div className="space-y-6">
              <div>
                <p className="text-muted-foreground text-sm">Run Type</p>
                <p className="mt-1">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    selectedItem.run_type === "org" ? "bg-blue-100 text-blue-800" : "bg-purple-100 text-purple-800"
                  }`}>
                    {selectedItem.run_type === "org" ? "TrustOrg" : "TrustSys"}
                  </span>
                </p>
              </div>

              <div>
                <p className="text-muted-foreground text-sm">Score Change</p>
                <p className={`text-3xl font-semibold mt-1 ${selectedItem.delta_score > 0 ? "text-green-600" : "text-red-600"}`}>
                  {selectedItem.delta_score > 0 ? "+" : ""}{selectedItem.delta_score.toFixed(1)}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Drift Flag</p>
                  <p className="font-medium mt-0.5">
                    {selectedItem.drift_flag ? (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-800">Drift detected</span>
                    ) : (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-800">Normal</span>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Timestamp</p>
                  <p className="font-medium mt-0.5">{new Date(selectedItem.created_at).toLocaleString()}</p>
                </div>
              </div>
            </div>
          )}
        </DetailPanel>

        {/* Onboarding Tour */}
        <OnboardingTour
          tourId="monitor-drift"
          steps={[
            { target: "[data-tour='page-header']", title: "Drift Detection", content: "Monitors how your governance scores change over time. Significant drops trigger alerts." },
            { target: "[data-tour='drift-summary']", title: "Summary", content: "Overview of your drift penalty, overdue assessments, and upcoming due dates." },
            { target: "[data-tour='reassessment-status']", title: "Reassessment Schedule", content: "Shows when each assessment is due for re-evaluation based on your reassessment policies." },
            { target: "[data-tour='drift-table']", title: "Score History", content: "Click any row to see the full score change details. Green means improvement, red means degradation." },
          ]}
        />
      </div>
    </TierGate>
  );
}
