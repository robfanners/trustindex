"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AuthenticatedShell from "@/components/AuthenticatedShell";
import RequireAuth from "@/components/RequireAuth";

// ---------------------------------------------------------------------------
// TrustSys Assess — bridge page
// ---------------------------------------------------------------------------
// This page resolves a trustsys_assessment to its legacy system_id and either:
//   a) Redirects to the legacy assess page (/systems/[systemId]/assess) if
//      the assessment was migrated from a legacy system, OR
//   b) Creates a new versioned run and loads the assessment inline.
//
// Full inline assess rewrite is Phase 2+ work. For now, this bridges the
// new route structure to the existing working assess flow.
// ---------------------------------------------------------------------------

export default function TrustSysAssessPage() {
  return (
    <RequireAuth>
      <AuthenticatedShell>
        <AssessBridge />
      </AuthenticatedShell>
    </RequireAuth>
  );
}

function AssessBridge() {
  const params = useParams<{ assessmentId: string }>();
  const router = useRouter();
  const assessmentId = params?.assessmentId;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assessment, setAssessment] = useState<{
    id: string;
    name: string;
    legacy_system_id?: string;
  } | null>(null);
  const [runs, setRuns] = useState<
    { id: string; version_number: number; status: string; overall_score: number | null }[]
  >([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!assessmentId) return;
    (async () => {
      try {
        const res = await fetch(`/api/trustsys/assessments/${assessmentId}`);
        if (!res.ok) {
          setError("Could not load assessment.");
          return;
        }
        const data = await res.json();
        setAssessment(data.assessment);
        setRuns(data.runs || []);

        // If this assessment has a legacy_system_id, redirect to legacy assess
        if (data.assessment?.legacy_system_id) {
          router.replace(
            `/systems/${data.assessment.legacy_system_id}/assess`
          );
          return;
        }
      } catch {
        setError("Failed to load assessment.");
      } finally {
        setLoading(false);
      }
    })();
  }, [assessmentId, router]);

  // Create a new versioned run
  const createRun = async () => {
    if (!assessmentId) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/trustsys/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assessment_id: assessmentId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create run");
      }
      const data = await res.json();

      // If this assessment has a legacy system_id, redirect to legacy assess
      // which will pick up the new run as a draft
      if (assessment?.legacy_system_id) {
        router.push(`/systems/${assessment.legacy_system_id}/assess`);
      } else {
        // For new-only assessments, go to the run's results page after creation
        // (in future this will be an inline assess UI)
        router.push(
          `/trustsys/${assessmentId}/results/${data.run.id}`
        );
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create run");
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
        <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        Loading assessment...
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="text-sm text-destructive">{error}</div>
        <button
          onClick={() => router.back()}
          className="text-sm text-brand hover:underline"
        >
          Go back
        </button>
      </div>
    );
  }

  if (!assessment) return null;

  // Find in-progress or latest completed run
  const inProgressRun = runs.find((r) => r.status === "in_progress");
  const latestCompleted = runs.find((r) => r.status === "completed");
  const nextVersion = runs.length > 0 ? Math.max(...runs.map((r) => r.version_number)) + 1 : 1;

  return (
    <div className="max-w-xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">
          Assess: {assessment.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          This will create version {nextVersion} of the assessment.
        </p>
      </header>

      {/* Resume in-progress run */}
      {inProgressRun && (
        <div className="border border-brand bg-brand/5 rounded-lg p-5 space-y-3">
          <div className="font-medium">
            Version {inProgressRun.version_number} is in progress
          </div>
          <p className="text-sm text-muted-foreground">
            Continue where you left off.
          </p>
          <button
            type="button"
            onClick={() => {
              if (assessment.legacy_system_id) {
                router.push(`/systems/${assessment.legacy_system_id}/assess`);
              }
            }}
            className="px-5 py-2.5 rounded bg-brand text-white font-semibold hover:bg-brand/90 text-sm"
          >
            Continue assessment
          </button>
        </div>
      )}

      {/* Previous results summary */}
      {latestCompleted && (
        <div className="border border-border rounded-lg p-5 space-y-2">
          <div className="text-sm text-muted-foreground">
            Latest completed: Version {latestCompleted.version_number}
          </div>
          <div className="text-2xl font-bold">
            {latestCompleted.overall_score ?? "—"}/100
          </div>
          <button
            type="button"
            onClick={() =>
              router.push(
                `/trustsys/${assessmentId}/results/${latestCompleted.id}`
              )
            }
            className="text-sm text-brand hover:underline"
          >
            View results
          </button>
        </div>
      )}

      {/* Start new version */}
      {!inProgressRun && (
        <div className="border border-border rounded-lg p-5 space-y-4">
          <div className="font-medium">
            {latestCompleted
              ? `Start re-assessment (v${nextVersion})`
              : "Start assessment"}
          </div>
          <p className="text-sm text-muted-foreground">
            {latestCompleted
              ? "A new version will be created. The previous results are preserved."
              : "Assess this system across five trust dimensions."}
          </p>
          <button
            type="button"
            onClick={createRun}
            disabled={creating}
            className="px-5 py-2.5 rounded bg-brand text-white font-semibold hover:bg-brand/90 text-sm disabled:opacity-50"
          >
            {creating ? "Creating..." : latestCompleted ? "Re-Assess" : "Start Assessment"}
          </button>
        </div>
      )}

      {/* Version history */}
      {runs.length > 0 && (
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-muted text-sm font-medium text-muted-foreground">
            Version History
          </div>
          <div className="divide-y divide-border">
            {runs.map((run) => (
              <div
                key={run.id}
                className="flex items-center justify-between px-4 py-3"
              >
                <div>
                  <span className="text-sm font-medium">
                    v{run.version_number}
                  </span>
                  <span
                    className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                      run.status === "completed"
                        ? "bg-success/10 text-success"
                        : run.status === "in_progress"
                          ? "bg-brand/10 text-brand"
                          : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {run.status === "in_progress" ? "In Progress" : run.status}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {run.overall_score !== null && (
                    <span className="text-sm font-medium">
                      {run.overall_score}/100
                    </span>
                  )}
                  {run.status === "completed" && (
                    <button
                      type="button"
                      onClick={() =>
                        router.push(
                          `/trustsys/${assessmentId}/results/${run.id}`
                        )
                      }
                      className="text-xs text-brand hover:underline"
                    >
                      Results
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
