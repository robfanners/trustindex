"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import AuthenticatedShell from "@/components/AuthenticatedShell";
import RequireAuth from "@/components/RequireAuth";
import { getPlanLimits } from "@/lib/entitlements";
import { getTierForScore } from "@/lib/trustGraphTiers";
import { getStabilityBadge, type StabilityStatus } from "@/lib/assessmentLifecycle";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// TrustSys Assessments — expandable card layout
// ---------------------------------------------------------------------------

export default function TrustSysPage() {
  return (
    <RequireAuth>
      <TrustSysContent />
    </RequireAuth>
  );
}

function TrustSysContent() {
  const { profile } = useAuth();
  const limits = useMemo(() => getPlanLimits(profile?.plan), [profile?.plan]);

  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Expanded card & its run history
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);

  // Create form state
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formVersion, setFormVersion] = useState("");
  const [formType, setFormType] = useState("");
  const [formEnvironment, setFormEnvironment] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Load assessments from v2 API
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
        setError(e instanceof Error ? e.message : "Failed to load assessments");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Toggle expand / collapse and fetch runs
  const toggleExpand = useCallback(
    async (id: string) => {
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
    },
    [expandedId]
  );

  const atCap = !loading && assessments.length >= limits.maxSystems;
  const approachingCap =
    !loading && !atCap && isFinite(limits.maxSystems) && assessments.length === limits.maxSystems - 1;
  const blocked = limits.maxSystems === 0;

  async function handleCreate(e: React.FormEvent) {
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
      setFormName("");
      setFormVersion("");
      setFormType("");
      setFormEnvironment("");
      setShowForm(false);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to create assessment");
    } finally {
      setFormLoading(false);
    }
  }

  return (
    <AuthenticatedShell>
      <div>
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-foreground">TrustSys Assessments</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Assess and monitor AI/system trust stability
          </p>
        </div>

        {/* Create system action */}
        <div className="mb-8">
          {blocked ? (
            <div>
              <span className="inline-flex items-center gap-2 px-4 py-2 bg-gray-300 text-gray-500 font-medium rounded-lg cursor-not-allowed text-sm" aria-disabled="true">
                <PlusIcon />
                Create system assessment
              </span>
              <p className="text-sm text-muted-foreground mt-2">
                Systems assessment is available on Pro plans.{" "}
                <a href="/upgrade" className="text-brand underline hover:text-foreground transition-colors">Upgrade</a>
              </p>
            </div>
          ) : atCap ? (
            <div>
              <span className="inline-flex items-center gap-2 px-4 py-2 bg-gray-300 text-gray-500 font-medium rounded-lg cursor-not-allowed text-sm" aria-disabled="true">
                <PlusIcon />
                Create system assessment
              </span>
              <p className="text-sm text-destructive mt-2">
                You&apos;ve reached your plan limit of {limits.maxSystems} system{limits.maxSystems !== 1 ? "s" : ""}.{" "}
                <a href="/upgrade" className="underline hover:text-foreground transition-colors">Upgrade to continue</a>.
              </p>
            </div>
          ) : showForm ? (
            <form onSubmit={handleCreate} className="border border-border rounded-xl p-4 max-w-md space-y-3">
              <div>
                <label htmlFor="sys-name" className="block text-sm font-medium text-foreground mb-1">System name</label>
                <input id="sys-name" type="text" required value={formName} onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Customer AI Chatbot"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent placeholder:text-muted-foreground/60" />
              </div>
              <div>
                <label htmlFor="sys-version" className="block text-sm font-medium text-foreground mb-1">
                  Version label <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <input id="sys-version" type="text" value={formVersion} onChange={(e) => setFormVersion(e.target.value)}
                  placeholder="e.g. v1.0"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent placeholder:text-muted-foreground/60" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="sys-type" className="block text-sm font-medium text-foreground mb-1">
                    Type <span className="text-muted-foreground font-normal">(optional)</span>
                  </label>
                  <select id="sys-type" value={formType} onChange={(e) => setFormType(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent bg-white">
                    <option value="">Select type</option>
                    <option value="rag_app">RAG app</option>
                    <option value="agent">Agent</option>
                    <option value="classifier">Classifier</option>
                    <option value="workflow">Workflow</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="sys-env" className="block text-sm font-medium text-foreground mb-1">
                    Environment <span className="text-muted-foreground font-normal">(optional)</span>
                  </label>
                  <select id="sys-env" value={formEnvironment} onChange={(e) => setFormEnvironment(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent bg-white">
                    <option value="">Select environment</option>
                    <option value="prod">Production</option>
                    <option value="staging">Staging</option>
                    <option value="pilot">Pilot</option>
                  </select>
                </div>
              </div>
              {formError && <p className="text-sm text-destructive">{formError}</p>}
              <div className="flex items-center gap-2">
                <button type="submit" disabled={formLoading}
                  className="px-4 py-2 bg-brand text-white font-medium rounded-lg hover:bg-brand/90 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                  {formLoading ? "Creating..." : "Create"}
                </button>
                <button type="button" onClick={() => { setShowForm(false); setFormError(null); }}
                  className="px-4 py-2 text-muted-foreground hover:text-foreground transition-colors text-sm">
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div>
              <button type="button" onClick={() => setShowForm(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-brand text-white font-medium rounded-lg hover:bg-brand/90 transition-colors text-sm">
                <PlusIcon />
                Create system assessment
              </button>
              {approachingCap && (
                <p className="text-xs text-muted-foreground mt-2">
                  {assessments.length} of {limits.maxSystems} systems used
                </p>
              )}
            </div>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
            <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
            Loading assessments...
          </div>
        )}

        {error && <div className="text-sm text-destructive py-4">{error}</div>}

        {/* Empty state */}
        {!loading && !error && assessments.length === 0 && (
          <div className="border border-border rounded-xl p-8 text-center">
            <div className="text-muted-foreground mb-2">No systems yet</div>
            <p className="text-sm text-muted-foreground mb-4">
              {blocked
                ? "Systems assessment is available on Pro plans."
                : "Create your first system assessment to get started."}
            </p>
            {!blocked && !atCap && (
              <button type="button" onClick={() => setShowForm(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-brand text-white font-medium rounded-lg hover:bg-brand/90 transition-colors text-sm">
                Create system assessment
              </button>
            )}
          </div>
        )}

        {/* Assessment cards */}
        {!loading && !error && assessments.length > 0 && (
          <div className="space-y-4">
            {assessments.map((a) => {
              const isExpanded = expandedId === a.id;
              const tier = a.latest_score !== null ? getTierForScore(a.latest_score) : null;
              const stability = getStabilityBadge(
                (a.stability_status as StabilityStatus) || "provisional"
              );

              return (
                <div
                  key={a.id}
                  className="border border-border rounded-xl overflow-hidden transition-shadow hover:shadow-md"
                >
                  {/* Card header — always visible */}
                  <button
                    type="button"
                    onClick={() => toggleExpand(a.id)}
                    className="w-full text-left px-5 py-4 flex items-center gap-4 hover:bg-gray-50/50 transition-colors"
                  >
                    {/* Chevron */}
                    <svg
                      className={`w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>

                    {/* System info */}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-foreground truncate">
                        {a.name}
                        {a.version_label && (
                          <span className="text-muted-foreground font-normal ml-2 text-xs">
                            {a.version_label}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {a.run_count} run{a.run_count !== 1 ? "s" : ""} · Created{" "}
                        {new Date(a.created_at).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </div>
                    </div>

                    {/* Score badge */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {tier ? (
                        <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${tier.bgClass} ${tier.colorClass}`}>
                          {a.latest_score}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">No score</span>
                      )}
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${stability.className}`}
                        title={stability.tooltip}
                      >
                        {stability.label}
                      </span>
                    </div>

                    {/* Action buttons — stop propagation so clicks don't toggle expand */}
                    <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                      {a.run_count > 0 && (
                        <button
                          type="button"
                          onClick={() => toggleExpand(a.id)}
                          className="text-xs px-3 py-1.5 rounded-lg border border-border text-foreground hover:bg-gray-100 transition-colors font-medium"
                        >
                          {isExpanded ? "Hide runs" : "Results"}
                        </button>
                      )}
                      <Link
                        href={`/trustsys/${a.id}/assess`}
                        className="text-xs px-3 py-1.5 rounded-lg bg-brand text-white hover:bg-brand/90 transition-colors font-medium"
                      >
                        {a.has_in_progress ? "Continue" : "Assess"}
                      </Link>
                    </div>
                  </button>

                  {/* Expanded: run history */}
                  {isExpanded && (
                    <div className="border-t border-border bg-gray-50/50 px-5 py-4">
                      {runsLoading ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                          <div className="w-3 h-3 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                          Loading run history...
                        </div>
                      ) : runs.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-2">
                          No completed runs yet. Start an assessment to generate scores.
                        </p>
                      ) : (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-xs text-muted-foreground border-b border-border/60">
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
                              const runStab = getStabilityBadge(
                                (r.stability_status as StabilityStatus) || "provisional"
                              );
                              return (
                                <tr key={r.id} className="border-b border-border/40 last:border-0">
                                  <td className="py-2.5 font-medium text-foreground">
                                    v{r.version_number}
                                  </td>
                                  <td className="py-2.5">
                                    {runTier ? (
                                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${runTier.bgClass} ${runTier.colorClass}`}>
                                        {r.overall_score}
                                      </span>
                                    ) : (
                                      <span className="text-muted-foreground">&mdash;</span>
                                    )}
                                  </td>
                                  <td className="py-2.5 hidden sm:table-cell">
                                    <span className={`text-xs capitalize ${r.status === "completed" ? "text-success" : r.status === "in_progress" ? "text-brand" : "text-muted-foreground"}`}>
                                      {r.status.replace("_", " ")}
                                    </span>
                                  </td>
                                  <td className="py-2.5 hidden md:table-cell">
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${runStab.className}`}>
                                      {runStab.label}
                                    </span>
                                  </td>
                                  <td className="py-2.5 text-muted-foreground hidden md:table-cell">
                                    {new Date(r.created_at).toLocaleDateString("en-GB", {
                                      day: "numeric",
                                      month: "short",
                                      year: "numeric",
                                    })}
                                  </td>
                                  <td className="py-2.5 text-right">
                                    {r.status === "completed" ? (
                                      <Link
                                        href={`/trustsys/${a.id}/results/${r.id}`}
                                        className="text-xs text-brand hover:text-brand/80 font-medium underline"
                                      >
                                        View results
                                      </Link>
                                    ) : (
                                      <span className="text-xs text-muted-foreground">&mdash;</span>
                                    )}
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
    </AuthenticatedShell>
  );
}

function PlusIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}
