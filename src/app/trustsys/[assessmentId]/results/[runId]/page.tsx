"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import AuthenticatedShell from "@/components/AuthenticatedShell";
import RequireAuth from "@/components/RequireAuth";
import { useAuth } from "@/context/AuthContext";
import { canExportResults } from "@/lib/entitlements";
import { SYSTEM_DIMENSIONS } from "@/lib/systemQuestionBank";
import type { RiskFlag } from "@/lib/systemScoring";
import { getTierForScore } from "@/lib/trustGraphTiers";
import {
  getStabilityBadge,
  calculateDrift,
  type DriftResult,
  type StabilityStatus,
} from "@/lib/assessmentLifecycle";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
} from "recharts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RunSummary = {
  id: string;
  version_number: number;
  status: string;
  stability_status: StabilityStatus;
  overall_score: number | null;
  dimension_scores: Record<string, number> | null;
  risk_flags: RiskFlag[] | null;
  confidence_factor: number | null;
  drift_from_previous: number | null;
  drift_flag: boolean;
  variance_last_3: number | null;
  assessor_id: string | null;
  created_at: string;
  completed_at: string | null;
};

type Assessment = {
  id: string;
  name: string;
  version_label: string | null;
  type: string | null;
  environment: string | null;
  autonomy_level: number;
  criticality_level: number;
  reassessment_frequency_days: number | null;
  created_at: string;
};

// ---------------------------------------------------------------------------
// Page wrapper
// ---------------------------------------------------------------------------

export default function TrustSysResultsPage() {
  return (
    <RequireAuth>
      <AuthenticatedShell>
        <ResultsContent />
      </AuthenticatedShell>
    </RequireAuth>
  );
}

// ---------------------------------------------------------------------------
// Main content
// ---------------------------------------------------------------------------

function ResultsContent() {
  const params = useParams<{ assessmentId: string; runId: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  const exportAllowed = canExportResults(profile?.plan);

  const assessmentId = params?.assessmentId;
  const runId = params?.runId;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [allRuns, setAllRuns] = useState<RunSummary[]>([]);
  const [currentRun, setCurrentRun] = useState<RunSummary | null>(null);
  const [recommendations, setRecommendations] = useState<
    { dimension: string; control: string; priority: string; recommendation: string }[]
  >([]);
  const [acceptedRecs, setAcceptedRecs] = useState<Set<number>>(new Set());
  const [acceptingRec, setAcceptingRec] = useState<number | null>(null);

  // Load assessment + all runs
  useEffect(() => {
    if (!assessmentId || !runId) return;
    (async () => {
      try {
        const res = await fetch(`/api/trustsys/assessments/${assessmentId}`);
        if (!res.ok) throw new Error("Failed to load assessment");
        const data = await res.json();

        setAssessment(data.assessment);
        setAllRuns(data.runs || []);

        const run = (data.runs || []).find(
          (r: RunSummary) => r.id === runId
        );
        if (!run) {
          setError("Run not found");
          return;
        }
        setCurrentRun(run);

        // Load recommendations from legacy table
        const recRes = await fetch(`/api/systems/runs/${runId}`);
        if (recRes.ok) {
          const recData = await recRes.json();
          setRecommendations(recData.recommendations || []);
        }
      } catch {
        setError("Failed to load results.");
      } finally {
        setLoading(false);
      }
    })();
  }, [assessmentId, runId]);

  // Compute drift against previous version
  const drift: DriftResult | null = useMemo(() => {
    if (!currentRun || !allRuns.length) return null;
    const completedRuns = allRuns
      .filter((r) => r.status === "completed" && r.overall_score !== null)
      .sort((a, b) => a.version_number - b.version_number);

    const currentIdx = completedRuns.findIndex((r) => r.id === currentRun.id);
    if (currentIdx <= 0) return null;

    const previousRun = completedRuns[currentIdx - 1];
    return calculateDrift(
      currentRun.overall_score ?? 0,
      previousRun.overall_score
    );
  }, [currentRun, allRuns]);

  // Version selector handler
  const handleVersionChange = useCallback(
    (selectedRunId: string) => {
      router.push(`/trustsys/${assessmentId}/results/${selectedRunId}`);
    },
    [assessmentId, router]
  );

  // Accept recommendation as action
  const acceptRecommendation = useCallback(
    async (idx: number) => {
      const rec = recommendations[idx];
      if (!rec || !currentRun) return;

      setAcceptingRec(idx);
      try {
        const res = await fetch("/api/actions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: `${rec.dimension}: ${rec.control}`,
            description: rec.recommendation,
            severity: rec.priority === "high" ? "high" : "medium",
            linked_run_id: currentRun.id,
            linked_run_type: "sys",
            linked_dimension: rec.dimension,
            source_recommendation: rec.recommendation,
          }),
        });
        if (res.ok) {
          setAcceptedRecs((prev) => new Set([...prev, idx]));
        }
      } catch {
        // silent — user can retry
      } finally {
        setAcceptingRec(null);
      }
    },
    [recommendations, currentRun]
  );

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
        <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        Loading results...
      </div>
    );
  }

  if (error || !currentRun || !assessment) {
    return (
      <div className="space-y-4">
        <div className="text-sm text-destructive">
          {error || "Results not available"}
        </div>
        <Link href="/trustsys" className="text-sm text-brand hover:underline">
          Back to assessments
        </Link>
      </div>
    );
  }

  const overall = currentRun.overall_score ?? 0;
  const dimScores = currentRun.dimension_scores ?? {};
  const riskFlags = (currentRun.risk_flags ?? []) as RiskFlag[];
  const tier = getTierForScore(overall);
  const stabilityBadge = getStabilityBadge(
    currentRun.stability_status || "provisional"
  );

  const completedRuns = allRuns
    .filter((r) => r.status === "completed")
    .sort((a, b) => b.version_number - a.version_number);

  const radarData = SYSTEM_DIMENSIONS.map((dim) => ({
    dimension: dim,
    score: dimScores[dim] ?? 0,
  }));

  return (
    <div className="max-w-4xl space-y-8">
      {/* Header with version selector */}
      <header className="space-y-3">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              {assessment.name}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Assessment results
              {currentRun.completed_at && (
                <>
                  {" "}
                  &middot;{" "}
                  {new Date(currentRun.completed_at).toLocaleDateString(
                    "en-GB",
                    { day: "numeric", month: "short", year: "numeric" }
                  )}
                </>
              )}
            </p>
          </div>

          {/* Version selector */}
          {completedRuns.length > 1 && (
            <div className="flex items-center gap-2">
              <label
                htmlFor="version-select"
                className="text-xs text-muted-foreground"
              >
                Version:
              </label>
              <select
                id="version-select"
                value={currentRun.id}
                onChange={(e) => handleVersionChange(e.target.value)}
                className="border border-border rounded px-2 py-1 text-sm bg-card focus:outline-none focus:border-brand"
              >
                {completedRuns.map((r) => (
                  <option key={r.id} value={r.id}>
                    v{r.version_number}
                    {r.overall_score !== null ? ` — ${r.overall_score}/100` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Status badges row */}
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`text-xs px-2.5 py-1 rounded-full font-medium ${tier.bgClass} ${tier.colorClass}`}
          >
            {tier.label}
          </span>
          <span
            className={`text-xs px-2.5 py-1 rounded-full font-medium ${stabilityBadge.className}`}
            title={stabilityBadge.tooltip}
          >
            {stabilityBadge.label}
          </span>
          <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-muted text-muted-foreground">
            v{currentRun.version_number}
          </span>
        </div>
      </header>

      {/* Score hero with drift */}
      <div className="border border-border rounded-xl p-6">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-sm text-muted-foreground">Overall Score</div>
            <div className="text-5xl font-bold">{overall}</div>
          </div>
          <div className="text-right space-y-1">
            <div className={`text-lg font-semibold ${tier.colorClass}`}>
              {tier.label}
            </div>
            {/* Drift indicator */}
            {drift && drift.delta !== 0 && (
              <div
                className={`text-sm font-medium ${
                  drift.direction === "improved"
                    ? "text-success"
                    : drift.direction === "declined"
                      ? "text-destructive"
                      : "text-muted-foreground"
                }`}
              >
                {drift.delta > 0 ? "+" : ""}
                {drift.delta} vs previous
                {drift.hasDrift && (
                  <span
                    className={`ml-1.5 text-xs px-1.5 py-0.5 rounded ${
                      drift.severity === "significant"
                        ? "bg-destructive/10 text-destructive"
                        : "bg-warning/10 text-warning"
                    }`}
                  >
                    Drift
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Stability + confidence info */}
        {currentRun.variance_last_3 !== null && (
          <div className="mt-4 pt-4 border-t border-border text-xs text-muted-foreground">
            Variance (last 3 runs): {currentRun.variance_last_3}
            {currentRun.confidence_factor !== null &&
              currentRun.confidence_factor < 1 && (
                <span className="ml-4">
                  Confidence factor: {Math.round(currentRun.confidence_factor * 100)}%
                </span>
              )}
          </div>
        )}
      </div>

      {/* Radar + Dimensions */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="border border-border rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">Radar</h2>
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer>
              <RadarChart
                data={radarData}
                margin={{ top: 30, right: 60, bottom: 30, left: 60 }}
              >
                <PolarGrid />
                <PolarAngleAxis
                  dataKey="dimension"
                  tick={{ fontSize: 11, fontWeight: 600, fill: "#4b5563" }}
                />
                <Radar dataKey="score" />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="border border-border rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">Dimensions</h2>
          <div className="space-y-3">
            {SYSTEM_DIMENSIONS.map((dim) => {
              const score = dimScores[dim] ?? 0;
              const dimTier = getTierForScore(score);
              return (
                <div
                  key={dim}
                  className="flex items-center justify-between border border-border rounded-lg p-3"
                >
                  <div className="font-medium text-sm">{dim}</div>
                  <div className={`text-sm font-semibold ${dimTier.colorClass}`}>
                    {score}/100
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Risk flags */}
      {riskFlags.length > 0 && (
        <div className="border border-border rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">Risk Flags</h2>
          <div className="space-y-3">
            {riskFlags.map((flag) => (
              <div
                key={flag.code}
                className="border border-destructive/20 bg-destructive/5 rounded-lg p-4"
              >
                <div className="font-medium text-sm text-destructive">
                  {flag.label}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {flag.description}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Recommendations</h2>
            {acceptedRecs.size > 0 && (
              <Link
                href="/actions"
                className="text-xs text-brand hover:underline"
              >
                View {acceptedRecs.size} accepted action{acceptedRecs.size !== 1 ? "s" : ""} &rarr;
              </Link>
            )}
          </div>
          <div className="space-y-3">
            {recommendations.map((rec, i) => (
              <div
                key={i}
                className={`border rounded-lg p-4 flex gap-3 ${
                  acceptedRecs.has(i)
                    ? "border-success/30 bg-success/5"
                    : "border-border"
                }`}
              >
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium h-fit shrink-0 ${
                    rec.priority === "high"
                      ? "bg-destructive/10 text-destructive"
                      : "bg-warning/10 text-warning"
                  }`}
                >
                  {rec.priority}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">
                    {rec.dimension} &middot; {rec.control}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {rec.recommendation}
                  </div>
                </div>
                <div className="shrink-0 self-center">
                  {acceptedRecs.has(i) ? (
                    <span className="text-xs text-success font-medium flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Action created
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => acceptRecommendation(i)}
                      disabled={acceptingRec === i}
                      className="text-xs px-2.5 py-1 rounded border border-brand text-brand hover:bg-brand hover:text-white transition-colors disabled:opacity-50 whitespace-nowrap"
                    >
                      {acceptingRec === i ? "Creating..." : "Accept as Action"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link
          href={`/trustsys/${assessmentId}/assess`}
          className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand/90 transition-colors"
        >
          Re-Assess
        </Link>
        <Link
          href="/trustsys"
          className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:border-foreground transition-colors"
        >
          Back to assessments
        </Link>
        {exportAllowed && (
          <button
            type="button"
            className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:border-foreground transition-colors"
            onClick={() => {
              if (!currentRun || !assessment) return;

              const dimScoresLocal = currentRun.dimension_scores ?? {};
              const flagsLocal = (currentRun.risk_flags ?? []) as RiskFlag[];

              const rows: string[][] = [
                ["TrustSys Assessment Export"],
                ["Assessment", assessment.name],
                ["Version", `v${currentRun.version_number}`],
                ["Status", currentRun.status],
                ["Overall Score", String(currentRun.overall_score ?? "N/A")],
                ["Stability", currentRun.stability_status || "provisional"],
                ["Completed", currentRun.completed_at ? new Date(currentRun.completed_at).toLocaleDateString("en-GB") : "N/A"],
                [],
                ["Dimension Scores"],
                ["Dimension", "Score"],
                ...SYSTEM_DIMENSIONS.map((dim) => [dim, String(dimScoresLocal[dim] ?? 0)]),
                [],
                ["Risk Flags"],
                ["Code", "Label", "Description"],
                ...flagsLocal.map((f) => [f.code, f.label, f.description]),
                [],
                ["Recommendations"],
                ["Dimension", "Control", "Priority", "Recommendation"],
                ...recommendations.map((r) => [r.dimension, r.control, r.priority, r.recommendation]),
              ];

              const csv = rows
                .map((row) =>
                  row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
                )
                .join("\n");

              const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `trustsys_${assessment.name.replace(/\s+/g, "_")}_v${currentRun.version_number}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            Export CSV
          </button>
        )}
      </div>
    </div>
  );
}
