"use client";

import { useCallback, useEffect, useState } from "react";
import AuthenticatedShell from "@/components/AuthenticatedShell";
import RequireAuth from "@/components/RequireAuth";
import { useAuth } from "@/context/AuthContext";
import { canAccessReport, accessibleReports } from "@/lib/reportAuth";
import type { ReportType } from "@/lib/reportAuth";
import { exportElementToPdf } from "@/lib/pdfExport";
import {
  CHART_COLORS,
  SEVERITY_COLORS,
  STATUS_COLORS,
  TOOLTIP_STYLE,
  CHART_HEIGHT,
} from "@/lib/reportChartConfig";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ReportTab = "board" | "history" | "actions" | "risk" | "audit";

type TabDef = {
  id: ReportTab;
  label: string;
  report: ReportType;
};

const ALL_TABS: TabDef[] = [
  { id: "board", label: "Board Summary", report: "board_summary" },
  { id: "history", label: "Assessment History", report: "assessment_history" },
  { id: "actions", label: "Action Completion", report: "action_completion" },
  { id: "risk", label: "Risk & Escalation", report: "risk_escalation" },
  { id: "audit", label: "Full Audit", report: "full_audit" },
];

// Default date range: last 90 days
function defaultFrom() {
  const d = new Date();
  d.setDate(d.getDate() - 90);
  return d.toISOString().split("T")[0];
}
function defaultTo() {
  return new Date().toISOString().split("T")[0];
}

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

export default function ReportsPage() {
  return (
    <RequireAuth>
      <AuthenticatedShell>
        <ReportsContent />
      </AuthenticatedShell>
    </RequireAuth>
  );
}

// ---------------------------------------------------------------------------
// Reports Content
// ---------------------------------------------------------------------------

function ReportsContent() {
  const { profile } = useAuth();
  const role = profile?.role ?? null;
  const tabs = ALL_TABS.filter((t) => canAccessReport(role, t.report));
  const permitted = accessibleReports(role);

  const [activeTab, setActiveTab] = useState<ReportTab>(
    tabs[0]?.id ?? "board"
  );

  // Shared date range state
  const [dateFrom, setDateFrom] = useState(defaultFrom);
  const [dateTo, setDateTo] = useState(defaultTo);

  // If no role or no tabs accessible
  if (permitted.length === 0) {
    return (
      <div>
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-foreground">Reports</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Trust governance analytics and reporting
          </p>
        </div>
        <div className="border border-border rounded-xl p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-6 h-6 text-muted-foreground"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <h2 className="text-lg font-medium text-foreground mb-2">
            Reports require a role assignment
          </h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Contact your administrator to assign you a role (exec, operator,
            risk, or admin) to access reports.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Reports</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Trust governance analytics and reporting
        </p>
      </div>

      {/* Tab bar */}
      <div className="border-b border-border mb-6">
        <nav className="flex gap-6" aria-label="Report tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === tab.id
                  ? "border-brand text-brand"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Shared date range filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <label className="text-xs font-medium text-muted-foreground">
          From
        </label>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="px-3 py-1.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent bg-white"
        />
        <label className="text-xs font-medium text-muted-foreground">To</label>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="px-3 py-1.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent bg-white"
        />
      </div>

      {/* Active tab content */}
      {activeTab === "board" && (
        <BoardSummaryReport dateFrom={dateFrom} dateTo={dateTo} />
      )}
      {activeTab === "history" && (
        <AssessmentHistoryReport dateFrom={dateFrom} dateTo={dateTo} />
      )}
      {activeTab === "actions" && (
        <ActionCompletionReport dateFrom={dateFrom} dateTo={dateTo} />
      )}
      {activeTab === "risk" && (
        <RiskEscalationReport dateFrom={dateFrom} dateTo={dateTo} />
      )}
      {activeTab === "audit" && (
        <FullAuditExport dateFrom={dateFrom} dateTo={dateTo} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  alert,
}: {
  label: string;
  value: string | number;
  alert?: boolean;
}) {
  return (
    <div className="border border-border rounded-xl p-4">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div
        className={`text-2xl font-bold mt-1 ${
          alert ? "text-destructive" : "text-foreground"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function getHealthBand(score: number) {
  if (score >= 80)
    return {
      label: "Healthy",
      color: "text-success",
      bgColor: "bg-success/10",
    };
  if (score >= 65)
    return {
      label: "Watch",
      color: "text-warning",
      bgColor: "bg-warning/10",
    };
  if (score >= 50)
    return {
      label: "At Risk",
      color: "text-orange-600",
      bgColor: "bg-orange-50",
    };
  return {
    label: "Critical",
    color: "text-destructive",
    bgColor: "bg-destructive/10",
  };
}

function Spinner({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
      <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      {text}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="border border-border rounded-xl p-8 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 1: Board Summary Report
// ---------------------------------------------------------------------------

type SummaryData = {
  health_score: number | null;
  org_base: number | null;
  sys_base: number | null;
  base_health: number | null;
  penalties: {
    p_rel: number;
    p_act: number;
    p_drift: number;
    p_exp: number;
  } | null;
  actions: {
    total: number;
    open: number;
    in_progress: number;
    done: number;
    critical_open: number;
    overdue: number;
  };
  escalations: {
    total: number;
    unresolved: number;
    by_severity: Record<string, number>;
  };
  drift: { events_in_period: number; avg_delta: number; max_delta: number };
};

function BoardSummaryReport({
  dateFrom,
  dateTo,
}: {
  dateFrom: string;
  dateTo: string;
}) {
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/reports/summary?from=${dateFrom}&to=${dateTo}`
      );
      if (res.ok) {
        const json = await res.json();
        setData(json.summary ?? null);
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) return <Spinner text="Loading board summary..." />;
  if (!data) return <EmptyState message="No data available for this period." />;

  const band =
    data.health_score !== null ? getHealthBand(data.health_score) : null;

  const penaltyBars = data.penalties
    ? [
        {
          name: "Relational",
          value: Math.round(data.penalties.p_rel * 100),
          weight: 35,
        },
        {
          name: "Actions",
          value: Math.round(data.penalties.p_act * 100),
          weight: 30,
        },
        {
          name: "Drift",
          value: Math.round(data.penalties.p_drift * 100),
          weight: 20,
        },
        {
          name: "Expiry",
          value: Math.round(data.penalties.p_exp * 100),
          weight: 25,
        },
      ].filter((p) => p.value > 0)
    : [];

  return (
    <div className="space-y-6">
      {/* Health score hero */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border border-border rounded-xl p-6">
          <div className="text-sm font-medium text-muted-foreground">
            TrustGraph Health
          </div>
          <div className="mt-2 flex items-end gap-2">
            {data.health_score !== null ? (
              <>
                <div className="text-4xl font-bold text-foreground">
                  {data.health_score.toFixed(1)}
                </div>
                {band && (
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium mb-1 ${band.bgColor} ${band.color}`}
                  >
                    {band.label}
                  </span>
                )}
              </>
            ) : (
              <div className="text-3xl font-bold text-muted-foreground/30">
                &mdash;
              </div>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Composite relational score
          </div>
        </div>

        <div className="border border-border rounded-xl p-6">
          <div className="text-sm font-medium text-muted-foreground">
            TrustOrg Score
          </div>
          <div className="text-3xl font-bold text-foreground mt-2">
            {data.org_base !== null ? data.org_base.toFixed(1) : "\u2014"}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Organisational trust readiness
          </div>
        </div>

        <div className="border border-border rounded-xl p-6">
          <div className="text-sm font-medium text-muted-foreground">
            TrustSys Score
          </div>
          <div className="text-3xl font-bold text-foreground mt-2">
            {data.sys_base !== null ? data.sys_base.toFixed(1) : "\u2014"}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            System trust stability
          </div>
        </div>
      </div>

      {/* Penalty drivers chart */}
      {penaltyBars.length > 0 && (
        <div className="border border-border rounded-xl p-6">
          <h3 className="text-sm font-medium text-foreground mb-1">
            Penalty Drivers
          </h3>
          <p className="text-xs text-muted-foreground mb-4">
            Factors reducing the health score from base of{" "}
            <span className="font-medium">
              {data.base_health?.toFixed(1) ?? "—"}
            </span>
          </p>
          <ResponsiveContainer width="100%" height={penaltyBars.length * 50 + 20}>
            <BarChart data={penaltyBars} layout="vertical" margin={{ left: 80, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={80} />
              <Tooltip
                {...TOOLTIP_STYLE}
                formatter={(value: number | undefined) => [`${value ?? 0}%`, "Penalty"]}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={24}>
                {penaltyBars.map((_, i) => (
                  <Cell
                    key={i}
                    fill={
                      penaltyBars[i].value > 30
                        ? CHART_COLORS.destructive
                        : penaltyBars[i].value > 15
                          ? CHART_COLORS.warning
                          : CHART_COLORS.brand
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="Total Actions" value={data.actions.total} />
        <StatCard label="Open" value={data.actions.open} alert={data.actions.open > 0} />
        <StatCard
          label="Critical Open"
          value={data.actions.critical_open}
          alert={data.actions.critical_open > 0}
        />
        <StatCard
          label="Overdue"
          value={data.actions.overdue}
          alert={data.actions.overdue > 0}
        />
        <StatCard
          label="Escalations"
          value={data.escalations.unresolved}
          alert={data.escalations.unresolved > 0}
        />
        <StatCard label="Drift Events" value={data.drift.events_in_period} />
      </div>

      {/* Escalation severity breakdown */}
      {data.escalations.total > 0 && (
        <div className="border border-border rounded-xl p-6">
          <h3 className="text-sm font-medium text-foreground mb-3">
            Escalations by Severity
          </h3>
          <div className="flex gap-3">
            {Object.entries(data.escalations.by_severity).map(
              ([sev, count]) =>
                count > 0 && (
                  <div
                    key={sev}
                    className="flex items-center gap-1.5 text-sm"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{
                        backgroundColor:
                          SEVERITY_COLORS[sev] ?? CHART_COLORS.muted,
                      }}
                    />
                    <span className="capitalize text-foreground">{sev}</span>
                    <span className="text-muted-foreground font-medium">
                      {count}
                    </span>
                  </div>
                )
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 2: Assessment History & Delta Report
// ---------------------------------------------------------------------------

type HistoryRun = {
  id: string;
  version_number: number;
  score: number | null;
  dimension_scores: Record<string, number> | null;
  stability_status: string | null;
  drift_from_previous: number | null;
  completed_at: string | null;
  system_name?: string;
  survey_title?: string;
};

type DimensionRef = { id: string; name: string; type: string; weight: number };

function AssessmentHistoryReport({
  dateFrom,
  dateTo,
}: {
  dateFrom: string;
  dateTo: string;
}) {
  const [orgRuns, setOrgRuns] = useState<HistoryRun[]>([]);
  const [sysRuns, setSysRuns] = useState<HistoryRun[]>([]);
  const [dimensions, setDimensions] = useState<DimensionRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [runType, setRunType] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ from: dateFrom, to: dateTo });
      if (runType) params.set("run_type", runType);

      const res = await fetch(`/api/reports/assessment-history?${params}`);
      if (res.ok) {
        const json = await res.json();
        setOrgRuns(json.history?.org_runs ?? []);
        setSysRuns(json.history?.sys_runs ?? []);
        setDimensions(json.history?.dimensions ?? []);
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, runType]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) return <Spinner text="Loading assessment history..." />;

  const allRuns = [
    ...orgRuns.map((r) => ({ ...r, type: "org" as const })),
    ...sysRuns.map((r) => ({ ...r, type: "sys" as const })),
  ].sort(
    (a, b) =>
      new Date(a.completed_at ?? 0).getTime() -
      new Date(b.completed_at ?? 0).getTime()
  );

  if (allRuns.length === 0) {
    return (
      <div className="space-y-4">
        <FilterRow runType={runType} setRunType={setRunType} />
        <EmptyState message="No completed assessments in this period." />
      </div>
    );
  }

  // Chart data: score over time
  const scoreTimeline = allRuns.map((r) => ({
    date: r.completed_at
      ? new Date(r.completed_at).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
        })
      : "",
    org: r.type === "org" ? r.score : null,
    sys: r.type === "sys" ? r.score : null,
    label: r.type === "org" ? r.survey_title : r.system_name,
  }));

  // Radar data from latest runs
  const latestSys = sysRuns[sysRuns.length - 1];
  const prevSys = sysRuns.length > 1 ? sysRuns[sysRuns.length - 2] : null;
  const sysDims = dimensions.filter((d) => d.type === "sys");

  const radarData = sysDims.map((dim) => ({
    dimension: dim.name.replace(/ & /g, " &\n"),
    current: latestSys?.dimension_scores?.[dim.name] ?? 0,
    previous: prevSys?.dimension_scores?.[dim.name] ?? 0,
  }));

  return (
    <div className="space-y-6">
      <FilterRow runType={runType} setRunType={setRunType} />

      {/* Score over time line chart */}
      <div className="border border-border rounded-xl p-6">
        <h3 className="text-sm font-medium text-foreground mb-4">
          Score Over Time
        </h3>
        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
          <LineChart data={scoreTimeline}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
            <Tooltip {...TOOLTIP_STYLE} />
            <Legend />
            <Line
              type="monotone"
              dataKey="org"
              name="TrustOrg"
              stroke={CHART_COLORS.success}
              strokeWidth={2}
              dot={{ r: 4 }}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="sys"
              name="TrustSys"
              stroke={CHART_COLORS.brand}
              strokeWidth={2}
              dot={{ r: 4 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Dimension radar comparison (sys) */}
      {radarData.length > 0 && latestSys && (
        <div className="border border-border rounded-xl p-6">
          <h3 className="text-sm font-medium text-foreground mb-1">
            Dimension Comparison — TrustSys
          </h3>
          <p className="text-xs text-muted-foreground mb-4">
            Latest run vs previous run
          </p>
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            <RadarChart data={radarData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 10 }} />
              <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
              <Radar
                name="Current"
                dataKey="current"
                stroke={CHART_COLORS.brand}
                fill={CHART_COLORS.brand}
                fillOpacity={0.2}
              />
              {prevSys && (
                <Radar
                  name="Previous"
                  dataKey="previous"
                  stroke={CHART_COLORS.muted}
                  fill={CHART_COLORS.muted}
                  fillOpacity={0.1}
                />
              )}
              <Legend />
              <Tooltip {...TOOLTIP_STYLE} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Run detail table */}
      <div className="border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-border text-left">
              <th className="px-4 py-3 font-medium text-muted-foreground">
                Date
              </th>
              <th className="px-4 py-3 font-medium text-muted-foreground">
                Type
              </th>
              <th className="px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">
                Name
              </th>
              <th className="px-4 py-3 font-medium text-muted-foreground">
                Score
              </th>
              <th className="px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">
                Delta
              </th>
              <th className="px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">
                Stability
              </th>
              <th className="px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">
                Version
              </th>
            </tr>
          </thead>
          <tbody>
            {allRuns.map((run) => (
              <tr
                key={run.id}
                className="border-b border-border last:border-0 hover:bg-gray-50 transition-colors"
              >
                <td className="px-4 py-3">
                  {run.completed_at
                    ? new Date(run.completed_at).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })
                    : "\u2014"}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded ${
                      run.type === "sys"
                        ? "bg-brand/10 text-brand"
                        : "bg-success/10 text-success"
                    }`}
                  >
                    {run.type === "sys" ? "SYS" : "ORG"}
                  </span>
                </td>
                <td className="px-4 py-3 hidden sm:table-cell text-foreground truncate max-w-[200px]">
                  {run.type === "sys" ? run.system_name : run.survey_title}
                </td>
                <td className="px-4 py-3 font-medium text-foreground">
                  {run.score !== null ? run.score.toFixed(1) : "\u2014"}
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  {run.drift_from_previous !== null ? (
                    <span
                      className={
                        run.drift_from_previous > 0
                          ? "text-success"
                          : run.drift_from_previous < -10
                            ? "text-destructive"
                            : "text-muted-foreground"
                      }
                    >
                      {run.drift_from_previous > 0 ? "+" : ""}
                      {run.drift_from_previous.toFixed(1)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">\u2014</span>
                  )}
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  {run.stability_status ? (
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        run.stability_status === "stable"
                          ? "bg-success/10 text-success"
                          : "bg-warning/10 text-warning"
                      }`}
                    >
                      {run.stability_status === "stable"
                        ? "Stable"
                        : "Provisional"}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">\u2014</span>
                  )}
                </td>
                <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">
                  v{run.version_number}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FilterRow({
  runType,
  setRunType,
}: {
  runType: string;
  setRunType: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="text-xs font-medium text-muted-foreground">
        Run type
      </label>
      <select
        value={runType}
        onChange={(e) => setRunType(e.target.value)}
        className="px-3 py-1.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent bg-white"
      >
        <option value="">All</option>
        <option value="org">TrustOrg</option>
        <option value="sys">TrustSys</option>
      </select>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 3: Action Completion Report
// ---------------------------------------------------------------------------

type ActionAnalytics = {
  totals: {
    total: number;
    open: number;
    in_progress: number;
    blocked: number;
    done: number;
    overdue: number;
    unassigned: number;
    avg_days_to_close: number;
  };
  by_severity: Record<
    string,
    { total: number; open: number; done: number }
  >;
  time_series: { week: string; created: number; resolved: number }[];
};

function ActionCompletionReport({
  dateFrom,
  dateTo,
}: {
  dateFrom: string;
  dateTo: string;
}) {
  const [data, setData] = useState<ActionAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [severity, setSeverity] = useState("");
  const [runType, setRunType] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ from: dateFrom, to: dateTo });
      if (severity) params.set("severity", severity);
      if (runType) params.set("run_type", runType);

      const res = await fetch(`/api/reports/action-analytics?${params}`);
      if (res.ok) {
        const json = await res.json();
        setData(json.analytics ?? null);
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, severity, runType]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) return <Spinner text="Loading action analytics..." />;
  if (!data) return <EmptyState message="No action data for this period." />;

  // Severity donut data
  const donutData = Object.entries(data.by_severity)
    .filter(([, v]) => v.total > 0)
    .map(([sev, v]) => ({
      name: sev.charAt(0).toUpperCase() + sev.slice(1),
      value: v.total,
      fill: SEVERITY_COLORS[sev] ?? CHART_COLORS.muted,
    }));

  // Status donut data
  const statusDonut = [
    { name: "Open", value: data.totals.open, fill: STATUS_COLORS.open },
    {
      name: "In Progress",
      value: data.totals.in_progress,
      fill: STATUS_COLORS.in_progress,
    },
    {
      name: "Blocked",
      value: data.totals.blocked,
      fill: STATUS_COLORS.blocked,
    },
    { name: "Done", value: data.totals.done, fill: STATUS_COLORS.done },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-xs font-medium text-muted-foreground">
          Severity
        </label>
        <select
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
          className="px-3 py-1.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent bg-white"
        >
          <option value="">All</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <label className="text-xs font-medium text-muted-foreground">
          Run type
        </label>
        <select
          value={runType}
          onChange={(e) => setRunType(e.target.value)}
          className="px-3 py-1.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent bg-white"
        >
          <option value="">All</option>
          <option value="org">TrustOrg</option>
          <option value="sys">TrustSys</option>
        </select>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard label="Total Actions" value={data.totals.total} />
        <StatCard label="Resolved" value={data.totals.done} />
        <StatCard
          label="Avg Days to Close"
          value={data.totals.avg_days_to_close}
        />
        <StatCard
          label="Unassigned"
          value={data.totals.unassigned}
          alert={data.totals.unassigned > 0}
        />
        <StatCard
          label="Overdue"
          value={data.totals.overdue}
          alert={data.totals.overdue > 0}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Created vs Resolved timeline */}
        {data.time_series.length > 0 && (
          <div className="border border-border rounded-xl p-6">
            <h3 className="text-sm font-medium text-foreground mb-4">
              Created vs Resolved (Weekly)
            </h3>
            <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
              <BarChart data={data.time_series}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Legend />
                <Bar
                  dataKey="created"
                  name="Created"
                  fill={CHART_COLORS.warning}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                />
                <Bar
                  dataKey="resolved"
                  name="Resolved"
                  fill={CHART_COLORS.success}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Severity donut + Status donut */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {donutData.length > 0 && (
            <div className="border border-border rounded-xl p-6">
              <h3 className="text-sm font-medium text-foreground mb-4">
                By Severity
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={donutData}
                    innerRadius={50}
                    outerRadius={80}
                    dataKey="value"
                    paddingAngle={2}
                  >
                    {donutData.map((d, i) => (
                      <Cell key={i} fill={d.fill} />
                    ))}
                  </Pie>
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    iconSize={8}
                    formatter={(value) => (
                      <span className="text-xs text-foreground">{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {statusDonut.length > 0 && (
            <div className="border border-border rounded-xl p-6">
              <h3 className="text-sm font-medium text-foreground mb-4">
                By Status
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={statusDonut}
                    innerRadius={50}
                    outerRadius={80}
                    dataKey="value"
                    paddingAngle={2}
                  >
                    {statusDonut.map((d, i) => (
                      <Cell key={i} fill={d.fill} />
                    ))}
                  </Pie>
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    iconSize={8}
                    formatter={(value) => (
                      <span className="text-xs text-foreground">{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 4: Risk & Escalation Report
// ---------------------------------------------------------------------------

type EscalationRow = {
  id: string;
  severity: string;
  reason: string;
  resolved: boolean;
  resolved_at: string | null;
  created_at: string;
};

function RiskEscalationReport({
  dateFrom,
  dateTo,
}: {
  dateFrom: string;
  dateTo: string;
}) {
  const [escalations, setEscalations] = useState<EscalationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [severity, setSeverity] = useState("");
  const [resolved, setResolved] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Use existing escalations endpoint
      const params = new URLSearchParams({ per_page: "200" });
      if (severity) params.set("severity", severity);
      if (resolved) params.set("resolved", resolved);

      const res = await fetch(`/api/trustgraph/escalations?${params}`);
      if (res.ok) {
        const json = await res.json();
        // Client-side date filter (escalations API doesn't have date params)
        const all: EscalationRow[] = json.escalations ?? [];
        const filtered = all.filter((e) => {
          const d = new Date(e.created_at);
          return d >= new Date(dateFrom) && d <= new Date(dateTo + "T23:59:59");
        });
        setEscalations(filtered);
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, severity, resolved]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) return <Spinner text="Loading escalation data..." />;

  const total = escalations.length;
  const resolvedCount = escalations.filter((e) => e.resolved).length;
  const unresolvedCount = total - resolvedCount;
  const resolutionRate = total > 0 ? Math.round((resolvedCount / total) * 100) : 0;

  // Severity distribution
  const severityDist = ["critical", "high", "medium", "low"].map((sev) => ({
    name: sev.charAt(0).toUpperCase() + sev.slice(1),
    value: escalations.filter((e) => e.severity === sev).length,
    fill: SEVERITY_COLORS[sev],
  })).filter((d) => d.value > 0);

  // Monthly timeline
  const monthMap = new Map<string, { created: number; resolved: number }>();
  for (const e of escalations) {
    const month = new Date(e.created_at).toLocaleDateString("en-GB", {
      month: "short",
      year: "2-digit",
    });
    const entry = monthMap.get(month) || { created: 0, resolved: 0 };
    entry.created++;
    if (e.resolved) entry.resolved++;
    monthMap.set(month, entry);
  }
  const timeline = Array.from(monthMap.entries()).map(([month, data]) => ({
    month,
    ...data,
  }));

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-xs font-medium text-muted-foreground">
          Severity
        </label>
        <select
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
          className="px-3 py-1.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent bg-white"
        >
          <option value="">All</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <label className="text-xs font-medium text-muted-foreground">
          Status
        </label>
        <select
          value={resolved}
          onChange={(e) => setResolved(e.target.value)}
          className="px-3 py-1.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent bg-white"
        >
          <option value="">All</option>
          <option value="false">Unresolved</option>
          <option value="true">Resolved</option>
        </select>
      </div>

      {total === 0 ? (
        <EmptyState message="No escalations found for this period." />
      ) : (
        <>
          {/* Resolution rate + stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="Total" value={total} />
            <StatCard
              label="Unresolved"
              value={unresolvedCount}
              alert={unresolvedCount > 0}
            />
            <StatCard label="Resolved" value={resolvedCount} />
            <div className="border border-border rounded-xl p-4">
              <div className="text-xs font-medium text-muted-foreground">
                Resolution Rate
              </div>
              <div className="text-2xl font-bold text-foreground mt-1">
                {resolutionRate}%
              </div>
              <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-success rounded-full transition-all"
                  style={{ width: `${resolutionRate}%` }}
                />
              </div>
            </div>
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Timeline */}
            {timeline.length > 0 && (
              <div className="border border-border rounded-xl p-6">
                <h3 className="text-sm font-medium text-foreground mb-4">
                  Escalation Timeline
                </h3>
                <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
                  <AreaChart data={timeline}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip {...TOOLTIP_STYLE} />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="created"
                      name="Created"
                      stroke={CHART_COLORS.destructive}
                      fill={CHART_COLORS.destructive}
                      fillOpacity={0.15}
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="resolved"
                      name="Resolved"
                      stroke={CHART_COLORS.success}
                      fill={CHART_COLORS.success}
                      fillOpacity={0.15}
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Severity distribution */}
            {severityDist.length > 0 && (
              <div className="border border-border rounded-xl p-6">
                <h3 className="text-sm font-medium text-foreground mb-4">
                  Severity Distribution
                </h3>
                <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
                  <BarChart data={severityDist} layout="vertical" margin={{ left: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={60} />
                    <Tooltip {...TOOLTIP_STYLE} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={24}>
                      {severityDist.map((d, i) => (
                        <Cell key={i} fill={d.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Escalation table */}
          <div className="border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-border text-left">
                  <th className="px-4 py-3 font-medium text-muted-foreground">
                    Date
                  </th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">
                    Severity
                  </th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">
                    Reason
                  </th>
                  <th className="px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {escalations.slice(0, 20).map((esc) => (
                  <tr
                    key={esc.id}
                    className="border-b border-border last:border-0 hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {new Date(esc.created_at).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-full mr-2"
                        style={{
                          backgroundColor:
                            SEVERITY_COLORS[esc.severity] ?? CHART_COLORS.muted,
                        }}
                      />
                      <span className="capitalize text-foreground text-xs">
                        {esc.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-foreground truncate max-w-[300px]">
                      {esc.reason}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          esc.resolved
                            ? "bg-success/10 text-success"
                            : "bg-destructive/10 text-destructive"
                        }`}
                      >
                        {esc.resolved ? "Resolved" : "Open"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {escalations.length > 20 && (
              <div className="px-4 py-3 border-t border-border bg-gray-50 text-xs text-muted-foreground">
                Showing 20 of {escalations.length} escalations
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 5: Full Audit Export
// ---------------------------------------------------------------------------

function FullAuditExport({
  dateFrom,
  dateTo,
}: {
  dateFrom: string;
  dateTo: string;
}) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Aggregate all data for audit
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [runs, setRuns] = useState<HistoryRun[]>([]);
  const [escalations, setEscalations] = useState<EscalationRow[]>([]);

  // Section collapse state
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["summary", "assessments", "escalations"])
  );

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [sumRes, histRes, escRes] = await Promise.allSettled([
          fetch(`/api/reports/summary?from=${dateFrom}&to=${dateTo}`),
          fetch(
            `/api/reports/assessment-history?from=${dateFrom}&to=${dateTo}`
          ),
          fetch("/api/trustgraph/escalations?per_page=200"),
        ]);

        if (sumRes.status === "fulfilled" && sumRes.value.ok) {
          const d = await sumRes.value.json();
          setSummary(d.summary ?? null);
        }

        if (histRes.status === "fulfilled" && histRes.value.ok) {
          const d = await histRes.value.json();
          const allRuns = [
            ...(d.history?.org_runs ?? []).map(
              (r: HistoryRun) => ({ ...r, type: "org" })
            ),
            ...(d.history?.sys_runs ?? []).map(
              (r: HistoryRun) => ({ ...r, type: "sys" })
            ),
          ];
          setRuns(allRuns);
        }

        if (escRes.status === "fulfilled" && escRes.value.ok) {
          const d = await escRes.value.json();
          const all: EscalationRow[] = d.escalations ?? [];
          setEscalations(
            all.filter((e) => {
              const dt = new Date(e.created_at);
              return (
                dt >= new Date(dateFrom) &&
                dt <= new Date(dateTo + "T23:59:59")
              );
            })
          );
        }
      } catch {
        /* silent */
      } finally {
        setLoading(false);
      }
    })();
  }, [dateFrom, dateTo]);

  const handleExport = async () => {
    setExporting(true);
    // Expand all sections for the export
    setExpandedSections(
      new Set(["summary", "assessments", "escalations"])
    );
    // Wait for re-render
    await new Promise((r) => setTimeout(r, 200));
    try {
      await exportElementToPdf(
        "audit-export-content",
        `trustgraph-audit-${dateFrom}-to-${dateTo}.pdf`
      );
    } catch {
      /* silent */
    } finally {
      setExporting(false);
    }
  };

  if (loading) return <Spinner text="Loading audit data..." />;

  return (
    <div className="space-y-6">
      {/* Export button */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Comprehensive audit export for {dateFrom} to {dateTo}
        </p>
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="text-sm px-4 py-2 rounded-lg bg-brand text-white hover:bg-brand/90 transition-colors disabled:opacity-50"
        >
          {exporting ? "Exporting..." : "Export PDF"}
        </button>
      </div>

      {/* Exportable content */}
      <div id="audit-export-content" className="space-y-4">
        {/* Header */}
        <div className="border border-border rounded-xl p-6 bg-white">
          <h2 className="text-lg font-semibold text-foreground">
            TrustGraph Audit Report
          </h2>
          <div className="mt-2 grid grid-cols-2 gap-4 text-sm text-muted-foreground">
            <div>
              Period: {dateFrom} to {dateTo}
            </div>
            <div>
              Generated:{" "}
              {new Date().toLocaleString("en-GB", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </div>
            <div>Generated by: {profile?.email ?? "—"}</div>
            <div>Organisation: {profile?.company_name ?? "—"}</div>
          </div>
        </div>

        {/* Summary section */}
        <AuditSection
          title="Health Summary"
          id="summary"
          expanded={expandedSections.has("summary")}
          onToggle={() => toggleSection("summary")}
        >
          {summary ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div>
                <div className="text-muted-foreground">Health Score</div>
                <div className="font-semibold text-foreground">
                  {summary.health_score?.toFixed(1) ?? "—"}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Org Base</div>
                <div className="font-semibold text-foreground">
                  {summary.org_base?.toFixed(1) ?? "—"}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Sys Base</div>
                <div className="font-semibold text-foreground">
                  {summary.sys_base?.toFixed(1) ?? "—"}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Drift Events</div>
                <div className="font-semibold text-foreground">
                  {summary.drift.events_in_period}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Open Actions</div>
                <div className="font-semibold text-foreground">
                  {summary.actions.open}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Overdue Actions</div>
                <div className="font-semibold text-foreground">
                  {summary.actions.overdue}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Escalations</div>
                <div className="font-semibold text-foreground">
                  {summary.escalations.total}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Unresolved Esc.</div>
                <div className="font-semibold text-foreground">
                  {summary.escalations.unresolved}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No health data available.
            </p>
          )}
        </AuditSection>

        {/* Assessment history section */}
        <AuditSection
          title={`Assessment Runs (${runs.length})`}
          id="assessments"
          expanded={expandedSections.has("assessments")}
          onToggle={() => toggleSection("assessments")}
        >
          {runs.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-border">
                    <th className="pb-2 font-medium text-muted-foreground pr-4">
                      Date
                    </th>
                    <th className="pb-2 font-medium text-muted-foreground pr-4">
                      Type
                    </th>
                    <th className="pb-2 font-medium text-muted-foreground pr-4">
                      Score
                    </th>
                    <th className="pb-2 font-medium text-muted-foreground pr-4">
                      Delta
                    </th>
                    <th className="pb-2 font-medium text-muted-foreground">
                      Stability
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((r) => (
                    <tr key={r.id} className="border-b border-border/50">
                      <td className="py-2 pr-4 text-muted-foreground">
                        {r.completed_at
                          ? new Date(r.completed_at).toLocaleDateString(
                              "en-GB"
                            )
                          : "—"}
                      </td>
                      <td className="py-2 pr-4 uppercase text-xs font-medium">
                        {(r as HistoryRun & { type?: string }).type ?? "—"}
                      </td>
                      <td className="py-2 pr-4 font-medium">
                        {r.score?.toFixed(1) ?? "—"}
                      </td>
                      <td className="py-2 pr-4">
                        {r.drift_from_previous?.toFixed(1) ?? "—"}
                      </td>
                      <td className="py-2">
                        {r.stability_status ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No completed runs in this period.
            </p>
          )}
        </AuditSection>

        {/* Escalations section */}
        <AuditSection
          title={`Escalations (${escalations.length})`}
          id="escalations"
          expanded={expandedSections.has("escalations")}
          onToggle={() => toggleSection("escalations")}
        >
          {escalations.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-border">
                    <th className="pb-2 font-medium text-muted-foreground pr-4">
                      Date
                    </th>
                    <th className="pb-2 font-medium text-muted-foreground pr-4">
                      Severity
                    </th>
                    <th className="pb-2 font-medium text-muted-foreground pr-4">
                      Reason
                    </th>
                    <th className="pb-2 font-medium text-muted-foreground">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {escalations.map((e) => (
                    <tr key={e.id} className="border-b border-border/50">
                      <td className="py-2 pr-4 text-muted-foreground">
                        {new Date(e.created_at).toLocaleDateString("en-GB")}
                      </td>
                      <td className="py-2 pr-4 capitalize">{e.severity}</td>
                      <td className="py-2 pr-4">{e.reason}</td>
                      <td className="py-2">
                        {e.resolved ? "Resolved" : "Open"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No escalations in this period.
            </p>
          )}
        </AuditSection>
      </div>
    </div>
  );
}

function AuditSection({
  title,
  id,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  id: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-border rounded-xl overflow-hidden bg-white">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 transition-colors"
        aria-expanded={expanded}
        aria-controls={`audit-${id}`}
      >
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        <svg
          className={`w-4 h-4 text-muted-foreground transition-transform ${
            expanded ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
      {expanded && (
        <div id={`audit-${id}`} className="px-6 pb-6">
          {children}
        </div>
      )}
    </div>
  );
}
