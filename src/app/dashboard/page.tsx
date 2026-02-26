"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import AuthenticatedShell from "@/components/AuthenticatedShell";
import RequireAuth from "@/components/RequireAuth";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DashboardTab = "overview" | "trustorg" | "trustsys";

const TABS: { id: DashboardTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "trustorg", label: "TrustOrg" },
  { id: "trustsys", label: "TrustSys" },
];

// ---------------------------------------------------------------------------
// Root page
// ---------------------------------------------------------------------------

export default function DashboardHome() {
  return (
    <RequireAuth>
      <DashboardContent />
    </RequireAuth>
  );
}

// ---------------------------------------------------------------------------
// Hash-based tab state
// ---------------------------------------------------------------------------

function useHashTab(): [DashboardTab, (tab: DashboardTab) => void] {
  const [tab, setTabState] = useState<DashboardTab>("overview");

  useEffect(() => {
    function readHash() {
      const hash = window.location.hash.replace("#", "") as DashboardTab;
      if (TABS.some((t) => t.id === hash)) {
        setTabState(hash);
      }
    }
    readHash();
    window.addEventListener("hashchange", readHash);
    return () => window.removeEventListener("hashchange", readHash);
  }, []);

  const setTab = useCallback((next: DashboardTab) => {
    setTabState(next);
    window.history.replaceState(null, "", `#${next}`);
  }, []);

  return [tab, setTab];
}

// ---------------------------------------------------------------------------
// Dashboard Control Tower
// ---------------------------------------------------------------------------

function DashboardContent() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useHashTab();

  return (
    <AuthenticatedShell>
      <div>
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-foreground">
            TrustGraph Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {user?.email
              ? `Welcome, ${user.email.split("@")[0]}`
              : "Your trust governance control tower"}
          </p>
        </div>

        {/* Tab bar — lens switcher */}
        <div className="border-b border-border mb-8">
          <nav className="flex gap-6" aria-label="Dashboard tabs">
            {TABS.map((tab) => (
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

        {/* Tab content — client-side switching, no navigation */}
        {activeTab === "overview" && <OverviewTab />}
        {activeTab === "trustorg" && <TrustOrgTab />}
        {activeTab === "trustsys" && <TrustSysTab />}
      </div>
    </AuthenticatedShell>
  );
}

// ---------------------------------------------------------------------------
// Health data type
// ---------------------------------------------------------------------------

type HealthData = {
  health_score: number;
  base_health: number;
  org_base: number;
  sys_base: number;
  p_rel: number;
  p_act: number;
  p_drift: number;
  p_exp: number;
  open_actions: number;
  overdue_actions: number;
  critical_overdue_actions: number;
  computed_at?: string;
};

function getHealthBand(score: number): { label: string; color: string; bgColor: string } {
  if (score >= 80) return { label: "Healthy", color: "text-success", bgColor: "bg-success/10" };
  if (score >= 65) return { label: "Watch", color: "text-warning", bgColor: "bg-warning/10" };
  if (score >= 50) return { label: "At Risk", color: "text-orange-600", bgColor: "bg-orange-50" };
  return { label: "Critical", color: "text-destructive", bgColor: "bg-destructive/10" };
}

// ---------------------------------------------------------------------------
// Overview tab — Control Tower summary (live data)
// ---------------------------------------------------------------------------

type Escalation = {
  id: string;
  severity: "low" | "medium" | "high" | "critical";
  reason: string;
  entity_type: string;
  entity_id: string;
  resolved: boolean;
  created_at: string;
};

type ReassessmentPolicy = {
  id: string;
  target_id: string;
  run_type: "org" | "sys";
  frequency_days: number;
  next_due: string | null;
  last_completed: string | null;
  is_overdue: boolean;
  days_until_due: number | null;
};

const SEVERITY_STYLES: Record<string, { bg: string; text: string }> = {
  critical: { bg: "bg-destructive/10", text: "text-destructive" },
  high: { bg: "bg-orange-50", text: "text-orange-600" },
  medium: { bg: "bg-warning/10", text: "text-warning" },
  low: { bg: "bg-muted", text: "text-muted-foreground" },
};

function OverviewTab() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [escalationCount, setEscalationCount] = useState(0);
  const [policies, setPolicies] = useState<ReassessmentPolicy[]>([]);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [healthRes, escRes, polRes] = await Promise.allSettled([
          fetch("/api/trustgraph/health"),
          fetch("/api/trustgraph/escalations?resolved=false&per_page=10"),
          fetch("/api/trustgraph/reassessment-policies"),
        ]);

        if (healthRes.status === "fulfilled" && healthRes.value.ok) {
          const data = await healthRes.value.json();
          setHealth(data.health || null);
        }

        if (escRes.status === "fulfilled" && escRes.value.ok) {
          const data = await escRes.value.json();
          setEscalations(data.escalations || []);
          setEscalationCount(data.total ?? 0);
        }

        if (polRes.status === "fulfilled" && polRes.value.ok) {
          const data = await polRes.value.json();
          setPolicies(data.policies || []);
        }
      } catch {
        // silent — will show placeholder state
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const resolveEscalation = async (id: string) => {
    setResolvingId(id);
    try {
      const res = await fetch("/api/trustgraph/escalations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ escalation_id: id }),
      });
      if (res.ok) {
        setEscalations((prev) => prev.filter((e) => e.id !== id));
        setEscalationCount((prev) => Math.max(0, prev - 1));
      }
    } catch {
      // silent
    } finally {
      setResolvingId(null);
    }
  };

  const overduePolicies = policies.filter((p) => p.is_overdue);
  const upcomingPolicies = policies
    .filter((p) => !p.is_overdue && p.days_until_due !== null && p.days_until_due <= 30)
    .sort((a, b) => (a.days_until_due ?? 999) - (b.days_until_due ?? 999));

  const band = health ? getHealthBand(health.health_score) : null;

  // Determine top penalty drivers (for explainability)
  const drivers = health
    ? [
        { label: "Relational mismatch", value: health.p_rel, weight: 0.35 },
        { label: "Action backlog", value: health.p_act, weight: 0.30 },
        { label: "Drift", value: health.p_drift, weight: 0.20 },
        { label: "Expiry", value: health.p_exp, weight: 0.25 },
      ]
        .filter((d) => d.value > 0)
        .sort((a, b) => b.value * b.weight - a.value * a.weight)
    : [];

  return (
    <div className="space-y-6">
      {/* TrustGraph Health Score cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <HealthScoreCard
          title="TrustGraph Health"
          description="Composite relational score"
          score={health?.health_score ?? null}
          band={band}
          loading={loading}
        />
        <HealthScoreCard
          title="TrustOrg Health"
          description="Organisational trust readiness"
          score={health?.org_base ?? null}
          loading={loading}
        />
        <HealthScoreCard
          title="TrustSys Health"
          description="System trust stability"
          score={health?.sys_base ?? null}
          loading={loading}
        />
      </div>

      {/* Penalty drivers (visible when health is loaded and has penalties) */}
      {health && drivers.length > 0 && (
        <div className="border border-border rounded-xl p-6">
          <h3 className="text-sm font-medium text-foreground mb-3">
            Health Score Drivers
          </h3>
          <p className="text-xs text-muted-foreground mb-4">
            Factors reducing the composite score from the base of{" "}
            <span className="font-medium">{health.base_health.toFixed(1)}</span>
          </p>
          <div className="space-y-3">
            {drivers.map((d) => {
              const impact = Math.round(d.value * d.weight * 100);
              return (
                <div key={d.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-foreground">{d.label}</span>
                    <span className="text-xs text-muted-foreground">
                      -{impact}% impact
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-destructive/60 rounded-full transition-all"
                      style={{ width: `${Math.min(100, d.value * 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Alerts & flags */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <AlertCard
          title="Open Actions"
          count={health?.open_actions ?? 0}
        />
        <AlertCard
          title="Overdue Actions"
          count={health?.overdue_actions ?? 0}
        />
        <AlertCard
          title="Critical Overdue"
          count={health?.critical_overdue_actions ?? 0}
        />
        <AlertCard
          title="Escalations"
          count={escalationCount}
        />
        <AlertCard
          title="Overdue Reassess."
          count={overduePolicies.length}
        />
        <AlertCard
          title="Relational Risk"
          count={health && health.p_rel > 0.25 ? 1 : 0}
        />
      </div>

      {/* Escalation Flags */}
      {escalations.length > 0 && (
        <div className="border border-destructive/30 rounded-xl p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-foreground">
              Escalation Flags
              <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium">
                {escalationCount}
              </span>
            </h3>
          </div>
          <div className="space-y-2">
            {escalations.map((esc) => {
              const style = SEVERITY_STYLES[esc.severity] || SEVERITY_STYLES.low;
              return (
                <div
                  key={esc.id}
                  className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded ${style.bg} ${style.text}`}
                    >
                      {esc.severity}
                    </span>
                    <span className="text-sm text-foreground truncate">
                      {esc.reason}
                    </span>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {new Date(esc.created_at).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => resolveEscalation(esc.id)}
                    disabled={resolvingId === esc.id}
                    className="text-[10px] px-2 py-1 rounded border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors whitespace-nowrap disabled:opacity-50"
                  >
                    {resolvingId === esc.id ? "..." : "Resolve"}
                  </button>
                </div>
              );
            })}
          </div>
          {escalationCount > escalations.length && (
            <p className="text-xs text-muted-foreground mt-3">
              Showing {escalations.length} of {escalationCount} unresolved escalations
            </p>
          )}
        </div>
      )}

      {/* Reassessment Due Alerts */}
      {(overduePolicies.length > 0 || upcomingPolicies.length > 0) && (
        <div className={`border rounded-xl p-6 ${
          overduePolicies.length > 0 ? "border-warning/50" : "border-border"
        }`}>
          <h3 className="text-sm font-medium text-foreground mb-3">
            Reassessment Schedule
          </h3>

          {overduePolicies.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-medium text-destructive mb-2">Overdue</p>
              <div className="space-y-1.5">
                {overduePolicies.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-destructive/5"
                  >
                    <div className="flex items-center gap-2 text-sm">
                      <span className={`text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded ${
                        p.run_type === "sys"
                          ? "bg-brand/10 text-brand"
                          : "bg-success/10 text-success"
                      }`}>
                        {p.run_type === "sys" ? "SYS" : "ORG"}
                      </span>
                      <span className="text-foreground">
                        {Math.abs(p.days_until_due ?? 0)} days overdue
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      Due {p.next_due
                        ? new Date(p.next_due).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                          })
                        : "—"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {upcomingPolicies.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Due within 30 days
              </p>
              <div className="space-y-1.5">
                {upcomingPolicies.slice(0, 5).map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-2 text-sm">
                      <span className={`text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded ${
                        p.run_type === "sys"
                          ? "bg-brand/10 text-brand"
                          : "bg-success/10 text-success"
                      }`}>
                        {p.run_type === "sys" ? "SYS" : "ORG"}
                      </span>
                      <span className="text-foreground">
                        {p.days_until_due} day{p.days_until_due !== 1 ? "s" : ""} remaining
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      Due {p.next_due
                        ? new Date(p.next_due).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                          })
                        : "—"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quick links */}
      <div className="border border-border rounded-xl p-6">
        <h3 className="text-sm font-medium text-foreground mb-3">Quick actions</h3>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/trustorg/new"
            className="text-xs px-3 py-1.5 rounded-lg bg-brand text-white hover:bg-brand/90 transition-colors"
          >
            New TrustOrg Survey
          </Link>
          <Link
            href="/trustsys"
            className="text-xs px-3 py-1.5 rounded-lg border border-border text-foreground hover:bg-muted transition-colors"
          >
            View TrustSys Assessments
          </Link>
          <Link
            href="/actions"
            className="text-xs px-3 py-1.5 rounded-lg border border-border text-foreground hover:bg-muted transition-colors"
          >
            View Actions
          </Link>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TrustOrg tab — org survey summary within dashboard
// ---------------------------------------------------------------------------

function TrustOrgTab() {
  const [loading, setLoading] = useState(true);
  const [surveys, setSurveys] = useState<Array<{
    id: string;
    title: string;
    mode: string;
    status: string;
    created_at: string;
    respondents: number;
  }>>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/my-surveys");
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error || "Failed to load surveys");
        }
        const d = await res.json();
        setSurveys(d.surveys || []);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground">TrustOrg Surveys</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Organisational trust readiness assessments
          </p>
        </div>
        <Link
          href="/trustorg"
          className="text-sm text-brand hover:text-brand/80 transition-colors"
        >
          View all &rarr;
        </Link>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
          <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          Loading surveys...
        </div>
      )}

      {error && <div className="text-sm text-destructive py-4">{error}</div>}

      {!loading && !error && surveys.length === 0 && (
        <div className="border border-border rounded-xl p-8 text-center">
          <div className="text-muted-foreground mb-2">No surveys yet</div>
          <p className="text-sm text-muted-foreground mb-4">
            Create your first TrustOrg survey to start measuring organisational trust.
          </p>
          <Link
            href="/trustorg/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand text-white font-medium rounded-lg hover:bg-brand/90 transition-colors text-sm"
          >
            Create survey
          </Link>
        </div>
      )}

      {!loading && !error && surveys.length > 0 && (
        <div className="border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-border text-left">
                <th className="px-4 py-3 font-medium text-muted-foreground">Survey</th>
                <th className="px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Mode</th>
                <th className="px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Respondents</th>
                <th className="px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Created</th>
                <th className="px-4 py-3 font-medium text-muted-foreground text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {surveys.slice(0, 5).map((survey) => (
                <tr key={survey.id} className="border-b border-border last:border-0 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{survey.title}</div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      survey.mode === "explorer"
                        ? "bg-brand/10 text-brand"
                        : "bg-success/10 text-success"
                    }`}>
                      {survey.mode === "explorer" ? "Explorer" : "Org"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                    {survey.respondents}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                    {new Date(survey.created_at).toLocaleDateString("en-GB", {
                      day: "numeric", month: "short", year: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/dashboard/surveys/${survey.id}/results`}
                      className="text-xs px-2 py-1 rounded bg-brand text-white hover:bg-brand/90 transition-colors"
                    >
                      Results
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {surveys.length > 5 && (
            <div className="px-4 py-3 border-t border-border bg-gray-50">
              <Link href="/trustorg" className="text-sm text-brand hover:text-brand/80">
                View all {surveys.length} surveys &rarr;
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Trend placeholders */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border border-border rounded-xl p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Score Trend</h3>
          <div className="h-32 flex items-center justify-center text-xs text-muted-foreground">
            Trend chart available after multiple assessments
          </div>
        </div>
        <div className="border border-border rounded-xl p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Participation Analytics</h3>
          <div className="h-32 flex items-center justify-center text-xs text-muted-foreground">
            Participation data available after survey completion
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TrustSys tab — system assessment summary within dashboard
// ---------------------------------------------------------------------------

function TrustSysTab() {
  const [loading, setLoading] = useState(true);
  const [assessments, setAssessments] = useState<Array<{
    id: string;
    name: string;
    version_label: string;
    latest_score: number | null;
    stability_status: string;
    run_count: number;
    has_in_progress: boolean;
    created_at: string;
  }>>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/trustsys/assessments");
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error || "Failed to load assessments");
        }
        const d = await res.json();
        setAssessments(d.assessments || []);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground">TrustSys Assessments</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            AI/system trust stability assessments
          </p>
        </div>
        <Link
          href="/trustsys"
          className="text-sm text-brand hover:text-brand/80 transition-colors"
        >
          View all &rarr;
        </Link>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
          <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          Loading assessments...
        </div>
      )}

      {error && <div className="text-sm text-destructive py-4">{error}</div>}

      {!loading && !error && assessments.length === 0 && (
        <div className="border border-border rounded-xl p-8 text-center">
          <div className="text-muted-foreground mb-2">No system assessments yet</div>
          <p className="text-sm text-muted-foreground mb-4">
            Register a system and run your first TrustSys assessment.
          </p>
          <Link
            href="/trustsys"
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand text-white font-medium rounded-lg hover:bg-brand/90 transition-colors text-sm"
          >
            Go to TrustSys
          </Link>
        </div>
      )}

      {!loading && !error && assessments.length > 0 && (
        <div className="border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-border text-left">
                <th className="px-4 py-3 font-medium text-muted-foreground">System</th>
                <th className="px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Score</th>
                <th className="px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Runs</th>
                <th className="px-4 py-3 font-medium text-muted-foreground text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {assessments.slice(0, 5).map((a) => (
                <tr key={a.id} className="border-b border-border last:border-0 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{a.name}</div>
                    {a.version_label && (
                      <div className="text-xs text-muted-foreground mt-0.5">{a.version_label}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    {a.latest_score !== null ? (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-brand/10 text-brand">
                        {a.latest_score}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">&mdash;</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                    {a.run_count}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {a.run_count > 0 && (
                        <Link
                          href="/trustsys"
                          className="text-xs px-2 py-1 rounded border border-border text-foreground hover:bg-gray-100 transition-colors"
                        >
                          Results
                        </Link>
                      )}
                      <Link
                        href={`/trustsys/${a.id}/assess`}
                        className="text-xs px-2 py-1 rounded bg-brand text-white hover:bg-brand/90 transition-colors"
                      >
                        {a.has_in_progress ? "Continue" : "Assess"}
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {assessments.length > 5 && (
            <div className="px-4 py-3 border-t border-border bg-gray-50">
              <Link href="/trustsys" className="text-sm text-brand hover:text-brand/80">
                View all {assessments.length} systems &rarr;
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Stability & drift placeholders */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border border-border rounded-xl p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Stability Tracking</h3>
          <div className="h-32 flex items-center justify-center text-xs text-muted-foreground">
            Stability data available after 3+ assessments per system
          </div>
        </div>
        <div className="border border-border rounded-xl p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Cross-System Comparison</h3>
          <div className="h-32 flex items-center justify-center text-xs text-muted-foreground">
            Comparison available with 2+ assessed systems
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared card components
// ---------------------------------------------------------------------------

function HealthScoreCard({
  title,
  description,
  score,
  band,
  loading,
}: {
  title: string;
  description: string;
  score: number | null;
  band?: { label: string; color: string; bgColor: string } | null;
  loading?: boolean;
}) {
  const displayScore = score !== null ? score.toFixed(1) : null;
  const scoreBand = band || (score !== null ? getHealthBand(score) : null);

  return (
    <div className="border border-border rounded-xl p-6">
      <div className="text-sm font-medium text-muted-foreground">{title}</div>
      <div className="mt-2 flex items-end gap-2">
        {loading ? (
          <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        ) : displayScore !== null ? (
          <>
            <div className="text-3xl font-bold text-foreground">{displayScore}</div>
            {scoreBand && (
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium mb-1 ${scoreBand.bgColor} ${scoreBand.color}`}
              >
                {scoreBand.label}
              </span>
            )}
          </>
        ) : (
          <div className="text-3xl font-bold text-muted-foreground/30">&mdash;</div>
        )}
      </div>
      <div className="text-xs text-muted-foreground mt-1">{description}</div>
    </div>
  );
}

function AlertCard({ title, count }: { title: string; count: number }) {
  return (
    <div className="border border-border rounded-xl p-4">
      <div className="text-xs font-medium text-muted-foreground">{title}</div>
      <div className={`text-2xl font-bold mt-1 ${
        count > 0 ? "text-destructive" : "text-muted-foreground/30"
      }`}>
        {count}
      </div>
    </div>
  );
}
