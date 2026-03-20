"use client";

import { useEffect, useMemo, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { getPlanLimits } from "@/lib/entitlements";
import { getTierForScore } from "@/lib/trustGraphTiers";
import { getStabilityBadge, type StabilityStatus } from "@/lib/assessmentLifecycle";
import Tooltip from "@/components/Tooltip";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Survey = {
  id: string;
  title: string;
  mode: "explorer" | "org";
  status: string;
  created_at: string;
  respondents: number;
  answers: number;
};

type Assessment = {
  id: string;
  name: string;
  version_label: string;
  type: string | null;
  environment: string | null;
  created_at: string;
  latest_score: number | null;
  stability_status: string;
  run_count: number;
  has_in_progress: boolean;
  ibg_status?: string;
};

type Run = {
  id: string;
  version_number: number;
  status: string;
  stability_status: string;
  overall_score: number | null;
  created_at: string;
  completed_at: string | null;
};

type HealthData = {
  health_score: number | null;
  org_base: number | null;
  sys_base: number | null;
};

// ---------------------------------------------------------------------------
// Score ring (small inline version)
// ---------------------------------------------------------------------------

function MiniRing({ score, size = 64, stroke = 5 }: { score: number | null; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = score != null ? Math.max(0, Math.min(100, score)) : 0;
  const offset = circ - (pct / 100) * circ;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border, rgba(0,0,0,0.08))" strokeWidth={stroke} />
      {score != null && (
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--brand, #0066FF)" strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="transition-[stroke-dashoffset] duration-700 ease-out" />
      )}
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central"
        className="fill-current text-gray-900" style={{ fontSize: score != null ? "15px" : "12px", fontWeight: 700 }}>
        {score != null ? score : "--"}
      </text>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

function TabButton({
  active,
  label,
  badge,
  onClick,
}: {
  active: boolean;
  label: string;
  badge?: number | string | null;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${
        active
          ? "text-[var(--foreground,#111)]"
          : "text-[var(--muted-foreground,#6B7280)] hover:text-[var(--foreground,#111)]"
      }`}
    >
      <span className="flex items-center gap-2">
        {label}
        {badge != null && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 font-mono tabular-nums">
            {badge}
          </span>
        )}
      </span>
      {active && (
        <div className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full bg-[var(--brand,#0066FF)]" />
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function TrustGraphPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-current border-t-transparent" />
      </div>
    }>
      <TrustGraphContent />
    </Suspense>
  );
}

function TrustGraphContent() {
  const { profile } = useAuth();
  const limits = useMemo(() => getPlanLimits(profile?.plan), [profile?.plan]);
  const searchParams = useSearchParams();

  // Tab state — default to "overview", respect ?tab= param
  const initialTab = searchParams.get("tab") || "overview";
  const [activeTab, setActiveTab] = useState(initialTab);

  // Health data
  const [health, setHealth] = useState<HealthData | null>(null);

  // TrustOrg data
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [surveysLoading, setSurveysLoading] = useState(true);

  // TrustSys data
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [assessmentsLoading, setAssessmentsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);

  // Create form state (TrustSys)
  const [showSysForm, setShowSysForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formVersion, setFormVersion] = useState("");
  const [formType, setFormType] = useState("");
  const [formEnvironment, setFormEnvironment] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Load health data
  useEffect(() => {
    fetch("/api/dashboard/control-centre")
      .then((r) => r.json())
      .then((d) => {
        if (!d.error) {
          setHealth({
            health_score: d.govern?.health_score ?? null,
            org_base: d.govern?.org_base ?? null,
            sys_base: d.govern?.sys_base ?? null,
          });
        }
      })
      .catch(() => {});
  }, []);

  // Load surveys
  useEffect(() => {
    fetch("/api/my-surveys")
      .then((r) => r.json())
      .then((d) => setSurveys(d.surveys || []))
      .catch(() => {})
      .finally(() => setSurveysLoading(false));
  }, []);

  // Load assessments
  useEffect(() => {
    fetch("/api/trustsys/assessments")
      .then((r) => r.json())
      .then((d) => setAssessments(d.assessments || []))
      .catch(() => {})
      .finally(() => setAssessmentsLoading(false));
  }, []);

  const toggleExpand = useCallback(async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      setRuns([]);
      return;
    }
    setExpandedId(id);
    setRunsLoading(true);
    try {
      const res = await fetch(`/api/trustsys/assessments/${id}`);
      if (res.ok) {
        const d = await res.json();
        setRuns(d.runs || []);
      } else {
        setRuns([]);
      }
    } catch {
      setRuns([]);
    } finally {
      setRunsLoading(false);
    }
  }, [expandedId]);

  async function handleCreateSystem(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFormLoading(true);
    try {
      const res = await fetch("/api/trustsys/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName.trim(),
          version_label: formVersion.trim(),
          type: formType || null,
          environment: formEnvironment || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create assessment");
      setAssessments((prev) => [
        {
          id: data.assessment.id,
          name: data.assessment.name,
          version_label: data.assessment.version_label || "",
          type: data.assessment.type ?? null,
          environment: data.assessment.environment ?? null,
          created_at: data.assessment.created_at,
          latest_score: null,
          stability_status: "provisional",
          run_count: 0,
          has_in_progress: false,
        },
        ...prev,
      ]);
      setFormName(""); setFormVersion(""); setFormType(""); setFormEnvironment("");
      setShowSysForm(false);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to create assessment");
    } finally {
      setFormLoading(false);
    }
  }

  const sysAtCap = !assessmentsLoading && assessments.length >= limits.maxSystems;
  const sysBlocked = limits.maxSystems === 0;
  const surveyAtCap = !surveysLoading && surveys.length >= limits.maxSurveys;

  return (
      <div className="flex flex-col gap-6">
        {/* Page header */}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">TrustGraph</h1>
          <p className="text-sm text-[var(--muted-foreground,#6B7280)] mt-1">
            Your composite governance score — combining organisational readiness and system assessments
          </p>
        </div>

        {/* Score overview strip */}
        <div className="flex items-center gap-6 rounded-xl border border-[var(--border,rgba(0,0,0,0.08))] bg-white p-5">
          <MiniRing score={health?.health_score ?? null} />
          <div className="flex-1 grid grid-cols-2 gap-4">
            <button type="button" onClick={() => setActiveTab("trustorg")}
              className="text-left rounded-lg p-3 hover:bg-gray-50 transition-colors">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground,#6B7280)] mb-1">
                TrustOrg
              </div>
              <div className="text-xl font-semibold font-mono tabular-nums">
                {health?.org_base != null ? health.org_base : "--"}
              </div>
              <div className="text-xs text-[var(--muted-foreground,#6B7280)] mt-0.5">
                {surveys.length} survey{surveys.length !== 1 ? "s" : ""}
              </div>
            </button>
            <button type="button" onClick={() => setActiveTab("trustsys")}
              className="text-left rounded-lg p-3 hover:bg-gray-50 transition-colors">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground,#6B7280)] mb-1">
                TrustSys
              </div>
              <div className="text-xl font-semibold font-mono tabular-nums">
                {health?.sys_base != null ? health.sys_base : "--"}
              </div>
              <div className="text-xs text-[var(--muted-foreground,#6B7280)] mt-0.5">
                {assessments.length} system{assessments.length !== 1 ? "s" : ""}
              </div>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center border-b border-[var(--border,rgba(0,0,0,0.08))]">
          <TabButton active={activeTab === "overview"} label="Overview" onClick={() => setActiveTab("overview")} />
          <TabButton active={activeTab === "trustorg"} label="TrustOrg" badge={surveys.length} onClick={() => setActiveTab("trustorg")} />
          <TabButton active={activeTab === "trustsys"} label="TrustSys" badge={assessments.length} onClick={() => setActiveTab("trustsys")} />
        </div>

        {/* Tab content */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* TrustOrg summary card */}
            <div className="rounded-xl border border-[var(--border,rgba(0,0,0,0.08))] bg-white p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-[var(--foreground,#111)]">TrustOrg</h3>
                <button type="button" onClick={() => setActiveTab("trustorg")}
                  className="text-xs text-[var(--brand,#0066FF)] hover:underline font-medium">
                  View all
                </button>
              </div>
              <p className="text-xs text-[var(--muted-foreground,#6B7280)] mb-4 leading-relaxed">
                Measure organisational trust readiness through governance surveys. Assess awareness, policy adoption, and culture across teams.
              </p>
              {surveysLoading ? (
                <div className="text-xs text-[var(--muted-foreground,#6B7280)]">Loading...</div>
              ) : surveys.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-xs text-[var(--muted-foreground,#6B7280)] mb-3">No surveys yet</p>
                  {!surveyAtCap && (
                    <Link href="/trustorg/new"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--brand,#0066FF)] text-white text-xs font-medium rounded-lg hover:opacity-90 transition-opacity no-underline">
                      Create survey
                    </Link>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {surveys.slice(0, 3).map((s) => (
                    <Link key={s.id} href={`/dashboard/surveys/${s.id}/results`}
                      className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors text-xs no-underline">
                      <span className="font-medium text-[var(--foreground,#111)] truncate">{s.title}</span>
                      <span className="text-[var(--muted-foreground,#6B7280)] shrink-0 ml-2">{s.respondents} resp.</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* TrustSys summary card */}
            <div className="rounded-xl border border-[var(--border,rgba(0,0,0,0.08))] bg-white p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-[var(--foreground,#111)]">TrustSys</h3>
                <button type="button" onClick={() => setActiveTab("trustsys")}
                  className="text-xs text-[var(--brand,#0066FF)] hover:underline font-medium">
                  View all
                </button>
              </div>
              <p className="text-xs text-[var(--muted-foreground,#6B7280)] mb-4 leading-relaxed">
                Assess individual AI systems for trust stability. Score each system against governance dimensions and track improvements.
              </p>
              {assessmentsLoading ? (
                <div className="text-xs text-[var(--muted-foreground,#6B7280)]">Loading...</div>
              ) : assessments.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-xs text-[var(--muted-foreground,#6B7280)] mb-3">
                    {sysBlocked ? "Available on Pro plans" : "No systems yet"}
                  </p>
                  {!sysBlocked && !sysAtCap && (
                    <button type="button" onClick={() => { setActiveTab("trustsys"); setShowSysForm(true); }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--brand,#0066FF)] text-white text-xs font-medium rounded-lg hover:opacity-90 transition-opacity">
                      Create assessment
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {assessments.slice(0, 3).map((a) => {
                    const tier = a.latest_score !== null ? getTierForScore(a.latest_score) : null;
                    return (
                      <div key={a.id}
                        className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors text-xs">
                        <span className="font-medium text-[var(--foreground,#111)] truncate">{a.name}</span>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          {tier ? (
                            <span className={`px-2 py-0.5 rounded-full font-medium ${tier.bgClass} ${tier.colorClass}`}>
                              {a.latest_score}
                            </span>
                          ) : (
                            <span className="text-[var(--muted-foreground,#6B7280)]">—</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "trustorg" && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-[var(--foreground,#111)]">TrustOrg Surveys</h2>
                <p className="text-xs text-[var(--muted-foreground,#6B7280)] mt-0.5">
                  Measure and track organisational trust readiness
                </p>
              </div>
              {!surveyAtCap && (
                <Link href="/trustorg/new"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--brand,#0066FF)] text-white text-xs font-medium rounded-lg hover:opacity-90 transition-opacity no-underline">
                  <PlusIcon /> Create survey
                </Link>
              )}
            </div>

            {surveysLoading ? (
              <LoadingSpinner />
            ) : surveys.length === 0 ? (
              <EmptyState message="No surveys yet" action={!surveyAtCap ? { label: "Create survey", href: "/trustorg/new" } : undefined} />
            ) : (
              <div className="border border-[var(--border,rgba(0,0,0,0.08))] rounded-xl overflow-hidden bg-white">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-[var(--border,rgba(0,0,0,0.08))] text-left">
                      <th className="px-4 py-3 font-medium text-[var(--muted-foreground,#6B7280)] text-xs">Survey</th>
                      <th className="px-4 py-3 font-medium text-[var(--muted-foreground,#6B7280)] text-xs hidden sm:table-cell">Mode</th>
                      <th className="px-4 py-3 font-medium text-[var(--muted-foreground,#6B7280)] text-xs hidden md:table-cell">Respondents</th>
                      <th className="px-4 py-3 font-medium text-[var(--muted-foreground,#6B7280)] text-xs hidden md:table-cell">Created</th>
                      <th className="px-4 py-3 font-medium text-[var(--muted-foreground,#6B7280)] text-xs text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {surveys.map((survey) => (
                      <tr key={survey.id} className="border-b border-[var(--border,rgba(0,0,0,0.06))] last:border-0 hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-medium text-[var(--foreground,#111)]">{survey.title}</div>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            survey.mode === "explorer" ? "bg-blue-50 text-blue-700" : "bg-green-50 text-green-700"
                          }`}>
                            {survey.mode === "explorer" ? "Explorer" : "Org"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[var(--muted-foreground,#6B7280)] hidden md:table-cell">{survey.respondents}</td>
                        <td className="px-4 py-3 text-[var(--muted-foreground,#6B7280)] hidden md:table-cell">
                          {new Date(survey.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Link href={`/dashboard/surveys/${survey.id}`}
                              className="text-xs px-2 py-1 rounded border border-[var(--border,rgba(0,0,0,0.08))] text-[var(--muted-foreground,#6B7280)] hover:text-[var(--foreground,#111)] transition-colors no-underline">
                              Manage
                            </Link>
                            <Link href={`/dashboard/surveys/${survey.id}/results`}
                              className="text-xs px-2 py-1 rounded bg-[var(--brand,#0066FF)] text-white hover:opacity-90 transition-opacity no-underline">
                              Results
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === "trustsys" && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-[var(--foreground,#111)]">TrustSys Assessments</h2>
                <p className="text-xs text-[var(--muted-foreground,#6B7280)] mt-0.5">
                  Assess and monitor AI/system trust stability
                </p>
              </div>
              {!sysBlocked && !sysAtCap && !showSysForm && (
                <button type="button" onClick={() => setShowSysForm(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--brand,#0066FF)] text-white text-xs font-medium rounded-lg hover:opacity-90 transition-opacity">
                  <PlusIcon /> Create assessment
                </button>
              )}
            </div>

            {/* Create form */}
            {showSysForm && (
              <form onSubmit={handleCreateSystem} className="border border-[var(--border,rgba(0,0,0,0.08))] rounded-xl p-4 max-w-md space-y-3 mb-6 bg-white">
                <div>
                  <label htmlFor="sys-name" className="block text-sm font-medium text-[var(--foreground,#111)] mb-1">System name</label>
                  <input id="sys-name" type="text" required value={formName} onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Customer AI Chatbot"
                    className="w-full px-3 py-2 border border-[var(--border,rgba(0,0,0,0.08))] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand,#0066FF)] focus:border-transparent" />
                </div>
                <div>
                  <label htmlFor="sys-version" className="block text-sm font-medium text-[var(--foreground,#111)] mb-1">
                    Version label <span className="text-[var(--muted-foreground,#6B7280)] font-normal">(optional)</span>
                  </label>
                  <input id="sys-version" type="text" value={formVersion} onChange={(e) => setFormVersion(e.target.value)}
                    placeholder="e.g. v1.0"
                    className="w-full px-3 py-2 border border-[var(--border,rgba(0,0,0,0.08))] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand,#0066FF)] focus:border-transparent" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="sys-type" className="block text-sm font-medium text-[var(--foreground,#111)] mb-1">
                      Type <span className="text-[var(--muted-foreground,#6B7280)] font-normal">(optional)</span>
                    </label>
                    <select id="sys-type" value={formType} onChange={(e) => setFormType(e.target.value)}
                      className="w-full px-3 py-2 border border-[var(--border,rgba(0,0,0,0.08))] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand,#0066FF)] focus:border-transparent bg-white">
                      <option value="">Select type</option>
                      <option value="rag_app">RAG app</option>
                      <option value="agent">Agent</option>
                      <option value="classifier">Classifier</option>
                      <option value="workflow">Workflow</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="sys-env" className="block text-sm font-medium text-[var(--foreground,#111)] mb-1">
                      Environment <span className="text-[var(--muted-foreground,#6B7280)] font-normal">(optional)</span>
                    </label>
                    <select id="sys-env" value={formEnvironment} onChange={(e) => setFormEnvironment(e.target.value)}
                      className="w-full px-3 py-2 border border-[var(--border,rgba(0,0,0,0.08))] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand,#0066FF)] focus:border-transparent bg-white">
                      <option value="">Select environment</option>
                      <option value="prod">Production</option>
                      <option value="staging">Staging</option>
                      <option value="pilot">Pilot</option>
                    </select>
                  </div>
                </div>
                {formError && <p className="text-sm text-red-600">{formError}</p>}
                <div className="flex items-center gap-2">
                  <button type="submit" disabled={formLoading}
                    className="px-4 py-2 bg-[var(--brand,#0066FF)] text-white font-medium rounded-lg hover:opacity-90 transition-opacity text-sm disabled:opacity-50">
                    {formLoading ? "Creating..." : "Create"}
                  </button>
                  <button type="button" onClick={() => { setShowSysForm(false); setFormError(null); }}
                    className="px-4 py-2 text-[var(--muted-foreground,#6B7280)] hover:text-[var(--foreground,#111)] transition-colors text-sm">
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {assessmentsLoading ? (
              <LoadingSpinner />
            ) : assessments.length === 0 ? (
              <EmptyState
                message={sysBlocked ? "Systems assessment is available on Pro plans." : "No systems yet"}
                action={!sysBlocked && !sysAtCap ? { label: "Create assessment", onClick: () => setShowSysForm(true) } : undefined}
              />
            ) : (
              <div className="space-y-4">
                {assessments.map((a) => {
                  const isExpanded = expandedId === a.id;
                  const tier = a.latest_score !== null ? getTierForScore(a.latest_score) : null;
                  const stability = getStabilityBadge((a.stability_status as StabilityStatus) || "provisional");

                  return (
                    <div key={a.id} className="border border-[var(--border,rgba(0,0,0,0.08))] rounded-xl overflow-hidden transition-shadow hover:shadow-md bg-white">
                      <button type="button" onClick={() => toggleExpand(a.id)}
                        className="w-full text-left px-5 py-4 flex items-center gap-4 hover:bg-gray-50/50 transition-colors">
                        <svg className={`w-4 h-4 text-[var(--muted-foreground,#6B7280)] flex-shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
                          fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-[var(--foreground,#111)] truncate">
                            {a.name}
                            {a.version_label && <span className="text-[var(--muted-foreground,#6B7280)] font-normal ml-2 text-xs">{a.version_label}</span>}
                          </div>
                          <div className="text-xs text-[var(--muted-foreground,#6B7280)] mt-0.5">
                            {a.run_count} run{a.run_count !== 1 ? "s" : ""} · Created {new Date(a.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          {a.ibg_status === "active" ? (
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-800">IBG</span>
                          ) : a.ibg_status === "draft" ? (
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-800">IBG Draft</span>
                          ) : null}
                          {tier ? (
                            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${tier.bgClass} ${tier.colorClass}`}>{a.latest_score}</span>
                          ) : (
                            <span className="text-xs text-[var(--muted-foreground,#6B7280)]">No score</span>
                          )}
                          <Tooltip content={stability.tooltip}>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${stability.className}`}>{stability.label}</span>
                          </Tooltip>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                          <Link href={`/trustsys/${a.id}/ibg`}
                            className="text-xs px-3 py-1.5 rounded-lg border border-[var(--border,rgba(0,0,0,0.08))] text-[var(--foreground,#111)] hover:bg-gray-100 transition-colors font-medium no-underline">
                            {a.ibg_status === "active" || a.ibg_status === "draft" ? "View IBG" : "Define IBG"}
                          </Link>
                          <Link href={`/trustsys/${a.id}/assess`}
                            className="text-xs px-3 py-1.5 rounded-lg bg-[var(--brand,#0066FF)] text-white hover:opacity-90 transition-opacity font-medium no-underline">
                            {a.has_in_progress ? "Continue" : "Assess"}
                          </Link>
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="border-t border-[var(--border,rgba(0,0,0,0.08))] bg-gray-50/50 px-5 py-4">
                          {runsLoading ? (
                            <LoadingSpinner small />
                          ) : runs.length === 0 ? (
                            <p className="text-sm text-[var(--muted-foreground,#6B7280)] py-2">No completed runs yet.</p>
                          ) : (
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-left text-xs text-[var(--muted-foreground,#6B7280)] border-b border-[var(--border,rgba(0,0,0,0.06))]">
                                  <th className="pb-2 font-medium">Run</th>
                                  <th className="pb-2 font-medium">Score</th>
                                  <th className="pb-2 font-medium hidden sm:table-cell">Status</th>
                                  <th className="pb-2 font-medium hidden md:table-cell">Stability</th>
                                  <th className="pb-2 font-medium hidden md:table-cell">Date</th>
                                  <th className="pb-2 font-medium text-right">View</th>
                                </tr>
                              </thead>
                              <tbody>
                                {runs.map((r) => {
                                  const runTier = r.overall_score !== null ? getTierForScore(r.overall_score) : null;
                                  const runStab = getStabilityBadge((r.stability_status as StabilityStatus) || "provisional");
                                  return (
                                    <tr key={r.id} className="border-b border-[var(--border,rgba(0,0,0,0.04))] last:border-0">
                                      <td className="py-2.5 font-medium text-[var(--foreground,#111)]">v{r.version_number}</td>
                                      <td className="py-2.5">
                                        {runTier ? (
                                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${runTier.bgClass} ${runTier.colorClass}`}>{r.overall_score}</span>
                                        ) : <span className="text-[var(--muted-foreground,#6B7280)]">&mdash;</span>}
                                      </td>
                                      <td className="py-2.5 hidden sm:table-cell">
                                        <span className={`text-xs capitalize ${r.status === "completed" ? "text-green-700" : r.status === "in_progress" ? "text-blue-700" : "text-gray-500"}`}>
                                          {r.status.replace("_", " ")}
                                        </span>
                                      </td>
                                      <td className="py-2.5 hidden md:table-cell">
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${runStab.className}`}>{runStab.label}</span>
                                      </td>
                                      <td className="py-2.5 text-[var(--muted-foreground,#6B7280)] hidden md:table-cell">
                                        {new Date(r.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                                      </td>
                                      <td className="py-2.5 text-right">
                                        {r.status === "completed" ? (
                                          <Link href={`/trustsys/${a.id}/results/${r.id}`}
                                            className="text-xs text-[var(--brand,#0066FF)] hover:underline font-medium no-underline">
                                            View results
                                          </Link>
                                        ) : <span className="text-xs text-[var(--muted-foreground,#6B7280)]">&mdash;</span>}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
  );
}

// ---------------------------------------------------------------------------
// Shared small components
// ---------------------------------------------------------------------------

function PlusIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}

function LoadingSpinner({ small }: { small?: boolean }) {
  return (
    <div className={`flex items-center gap-2 text-sm text-[var(--muted-foreground,#6B7280)] ${small ? "py-2" : "py-8"}`}>
      <div className={`${small ? "w-3 h-3" : "w-4 h-4"} border-2 border-[var(--brand,#0066FF)] border-t-transparent rounded-full animate-spin`} />
      Loading...
    </div>
  );
}

function EmptyState({ message, action }: { message: string; action?: { label: string; href?: string; onClick?: () => void } }) {
  return (
    <div className="border border-[var(--border,rgba(0,0,0,0.08))] rounded-xl p-8 text-center bg-white">
      <p className="text-sm text-[var(--muted-foreground,#6B7280)] mb-4">{message}</p>
      {action && (
        action.href ? (
          <Link href={action.href}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[var(--brand,#0066FF)] text-white font-medium rounded-lg hover:opacity-90 transition-opacity text-sm no-underline">
            {action.label}
          </Link>
        ) : (
          <button type="button" onClick={action.onClick}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[var(--brand,#0066FF)] text-white font-medium rounded-lg hover:opacity-90 transition-opacity text-sm">
            {action.label}
          </button>
        )
      )}
    </div>
  );
}
