"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import AppShell from "@/components/AppShell";
import SurveyForm, { type Question } from "@/components/SurveyForm";
import OnboardingForm from "@/components/OnboardingForm";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
} from "recharts";
import TierBadge from "@/components/TierBadge";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DimensionRow = {
  run_id: string;
  dimension: string;
  mean_1_to_5: number;
  n_answers: number;
};

type TrustRow = {
  run_id: string;
  overall_mean_1_to_5: number;
  trustindex_0_to_100: number;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Race a promise/thenable against a timeout — rejects if the timeout fires first. */
function withTimeout<T>(
  promise: Promise<T> | PromiseLike<T>,
  ms: number
): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Request timed out")), ms)
    ),
  ]);
}

function bandFor(score: number) {
  if (score < 40)
    return {
      label: "Fragile",
      color: "text-destructive",
      summary:
        "Low trust signals systemic friction and elevated execution risk.",
    };
  if (score < 70)
    return {
      label: "Mixed",
      color: "text-warning",
      summary:
        "Trust is inconsistent; performance is likely uneven across teams or cohorts.",
    };
  return {
    label: "Strong",
    color: "text-success",
    summary: "Trust is an asset; protect it and scale what is working.",
  };
}

// ---------------------------------------------------------------------------
// /try — anonymous Explorer self-assessment
// ---------------------------------------------------------------------------

export default function TryExplorerPage() {
  // Phase: "loading" → "survey" → "submitting-results" → "results"
  const [phase, setPhase] = useState<
    "loading" | "survey" | "submitting-results" | "results"
  >("loading");

  // Survey setup
  const [runId, setRunId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [missingIds, setMissingIds] = useState<string[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Results
  const [trust, setTrust] = useState<TrustRow | null>(null);
  const [dims, setDims] = useState<DimensionRow[]>([]);

  const radarData = useMemo(() => {
    const short = (s: string) =>
      s === "Employee Confidence"
        ? "Confidence"
        : s === "AI Explainability"
        ? "AI Explain."
        : s;
    return dims.map((d) => ({
      dimension: short(d.dimension),
      score: Math.round(((Number(d.mean_1_to_5) - 1) / 4) * 100),
    }));
  }, [dims]);

  // -------------------------------------------------------------------------
  // 1. Create anonymous Explorer run + load questions
  // -------------------------------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const QUERY_TIMEOUT = 8000; // 8 s — generous but won't hang forever

      try {
        // ------------------------------------------------------------------
        // A. Try to resume a pending Explorer from localStorage
        // ------------------------------------------------------------------
        const pending = localStorage.getItem("ti_explorer_pending");
        let existingRunId: string | null = null;
        let existingToken: string | null = null;

        if (pending) {
          try {
            const parsed = JSON.parse(pending);
            existingRunId = parsed.runId ?? null;
            existingToken = parsed.token ?? null;
          } catch {
            localStorage.removeItem("ti_explorer_pending");
          }
        }

        if (existingRunId && existingToken) {
          try {
            const { data: invite } = await withTimeout(
              supabase
                .from("invites")
                .select("run_id, used_at")
                .eq("token", existingToken)
                .single(),
              QUERY_TIMEOUT
            );

            if (invite && !invite.used_at) {
              // Resume: load questions with the same timeout guard
              const { data: qs } = await withTimeout(
                supabase
                  .from("questions")
                  .select("id, dimension, prompt, sort_order")
                  .order("sort_order", { ascending: true }),
                QUERY_TIMEOUT
              );

              if (!cancelled && qs && qs.length > 0) {
                setRunId(existingRunId);
                setToken(existingToken);
                setQuestions(qs as Question[]);
                setPhase("survey");
                return;
              }
              // If questions failed to load, fall through and create fresh
            }
          } catch {
            // Timeout or query error — stale token, RLS issue, etc.
            // Fall through to create a fresh run.
          }

          // Either invite was used, invalid, or the query failed — clear it.
          localStorage.removeItem("ti_explorer_pending");
        }

        // ------------------------------------------------------------------
        // B. Create a brand-new Explorer run via the API
        // ------------------------------------------------------------------
        const res = await withTimeout(
          fetch("/api/try-explorer", { method: "POST" }),
          QUERY_TIMEOUT
        );
        const json = await res.json();

        if (!res.ok || !json.runId) {
          if (!cancelled) setError(json.error || "Failed to set up survey.");
          return;
        }

        // Persist so the user can resume or claim after signup
        localStorage.setItem(
          "ti_explorer_pending",
          JSON.stringify({ runId: json.runId, token: json.token })
        );

        if (!cancelled) {
          setRunId(json.runId);
          setToken(json.token);
        }

        // ------------------------------------------------------------------
        // C. Load questions
        // ------------------------------------------------------------------
        const { data: qs, error: qErr } = await withTimeout(
          supabase
            .from("questions")
            .select("id, dimension, prompt, sort_order")
            .order("sort_order", { ascending: true }),
          QUERY_TIMEOUT
        );

        if (qErr || !qs || qs.length === 0) {
          if (!cancelled) setError("Could not load questions.");
          return;
        }

        if (!cancelled) {
          setQuestions(qs as Question[]);
          setPhase("survey");
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : "Failed to initialise survey."
          );
        }
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  // -------------------------------------------------------------------------
  // 2. Answer + submit + load results
  // -------------------------------------------------------------------------

  const setAnswer = (questionId: string, value: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    setMissingIds((prev) => prev.filter((id) => id !== questionId));
    setValidationError(null);
  };

  const handleShowMissing = () => {
    const missing = questions
      .filter((q) => answers[q.id] == null)
      .map((q) => q.id);
    setMissingIds(missing);
    setValidationError(`Please answer ${missing.length} required questions.`);
  };

  const handleSubmit = async () => {
    if (!runId || !token) return;

    setError(null);
    setValidationError(null);
    setSubmitting(true);

    const missing = questions
      .filter((q) => answers[q.id] == null)
      .map((q) => q.id);

    if (missing.length > 0) {
      setMissingIds(missing);
      setValidationError(`Please answer ${missing.length} required questions.`);
      const el = document.querySelector(`[data-qid="${missing[0]}"]`);
      if (el instanceof HTMLElement)
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      setSubmitting(false);
      return;
    }

    // Upsert responses
    const payload = questions.map((q) => ({
      run_id: runId,
      invite_token: token,
      question_id: q.id,
      value: answers[q.id],
    }));

    const { error: insertErr } = await supabase
      .from("responses")
      .upsert(payload, { onConflict: "run_id,invite_token,question_id" });

    if (insertErr) {
      setError("Couldn't submit your responses. Please try again.");
      setSubmitting(false);
      return;
    }

    // Mark invite used
    await supabase
      .from("invites")
      .update({ used_at: new Date().toISOString() })
      .eq("token", token);

    setSubmitting(false);
    setPhase("submitting-results");

    // Load results (may take a moment for DB views to refresh)
    // Poll briefly in case of view lag
    let attempts = 0;
    const poll = setInterval(async () => {
      attempts++;
      const { data: trustData } = await supabase
        .from("v_trustindex_scores")
        .select("run_id, overall_mean_1_to_5, trustindex_0_to_100")
        .eq("run_id", runId)
        .maybeSingle();

      const { data: dimData } = await supabase
        .from("v_dimension_scores")
        .select("run_id, dimension, mean_1_to_5, n_answers")
        .eq("run_id", runId);

      if (trustData && dimData && dimData.length > 0) {
        clearInterval(poll);
        setTrust(trustData as TrustRow);
        setDims(dimData as DimensionRow[]);
        setPhase("results");
      } else if (attempts >= 6) {
        clearInterval(poll);
        // Show results anyway (may be empty)
        if (trustData) setTrust(trustData as TrustRow);
        if (dimData) setDims(dimData as DimensionRow[]);
        setPhase("results");
      }
    }, 500);
  };

  // -------------------------------------------------------------------------
  // Render: Loading
  // -------------------------------------------------------------------------

  if (phase === "loading") {
    return (
      <AppShell>
        <div className="max-w-3xl mx-auto p-4 md:p-6 lg:p-10">
          {error ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">
                {error}
              </div>
              <button
                onClick={() => {
                  localStorage.removeItem("ti_explorer_pending");
                  setError(null);
                  window.location.reload();
                }}
                className="px-5 py-2.5 bg-brand text-white font-semibold rounded-full
                  shadow-lg shadow-brand/20 hover:bg-brand-hover hover:-translate-y-0.5
                  transition-all duration-300 text-sm"
              >
                Try again
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
              Setting up your self-assessment…
            </div>
          )}
        </div>
      </AppShell>
    );
  }

  // -------------------------------------------------------------------------
  // Render: Submitting results (brief spinner)
  // -------------------------------------------------------------------------

  if (phase === "submitting-results") {
    return (
      <AppShell>
        <div className="max-w-3xl mx-auto p-4 md:p-6 lg:p-10">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
            Calculating your TrustGraph score…
          </div>
        </div>
      </AppShell>
    );
  }

  // -------------------------------------------------------------------------
  // Render: Results teaser + signup CTA
  // -------------------------------------------------------------------------

  if (phase === "results") {
    const score = trust
      ? Math.round(Number(trust.trustindex_0_to_100))
      : null;
    const band = score !== null ? bandFor(score) : null;

    return (
      <AppShell>
        <div className="max-w-3xl mx-auto p-4 md:p-6 lg:p-10 space-y-6 md:space-y-8">
          <header className="space-y-2">
            <h1 className="text-3xl font-bold">Your TrustGraph™ Results</h1>
            <p className="text-muted-foreground">
              Here&apos;s a snapshot of how trust is experienced based on your
              self-assessment.
            </p>
          </header>

          {/* Score card */}
          {trust && score !== null && band && (
            <>
              <div className="rounded-xl border border-border p-6 flex items-end justify-between shadow-sm">
                <div>
                  <div className="text-sm text-muted-foreground">
                    TrustGraph Score™
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-5xl font-bold">
                      {Number(trust.trustindex_0_to_100).toFixed(1)}
                    </div>
                    {score !== null && <TierBadge score={score} />}
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  Mean: {Number(trust.overall_mean_1_to_5).toFixed(2)} / 5
                </div>
              </div>

              <div className="border border-border rounded-lg p-6 space-y-3">
                <div className={`text-xl font-semibold ${band.color}`}>
                  {band.label} trust ({score}/100)
                </div>
                <div className="text-sm text-muted-foreground">{band.summary}</div>
              </div>
            </>
          )}

          {/* Radar */}
          {radarData.length > 0 && (
            <div className="border border-border rounded-lg p-6">
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
                      tick={{
                        fontSize: 11,
                        fontWeight: 600,
                        fill: "#4b5563",
                      }}
                    />
                    <Radar dataKey="score" />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Onboarding / Signup */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">
              Save your results &amp; unlock the full dashboard
            </h2>
            <p className="text-sm text-muted-foreground">
              Sign up free to keep your TrustGraph results, run organisational
              surveys, and access dimension-level analysis with recommended
              actions.
            </p>
            <OnboardingForm />
            <div className="text-center">
              <a
                className="text-sm text-muted-foreground hover:text-foreground underline"
                href="/auth/login?next=/dashboard"
              >
                Already have an account? Sign in
              </a>
            </div>
          </div>

          {!trust && (
            <div className="text-sm text-muted-foreground">
              We couldn&apos;t calculate your score just yet. Sign up and your
              results will be waiting on your dashboard.
            </div>
          )}
        </div>
      </AppShell>
    );
  }

  // -------------------------------------------------------------------------
  // Render: Survey form
  // -------------------------------------------------------------------------

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto p-4 md:p-6 lg:p-10 space-y-6 md:space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">TrustGraph Explorer</h1>
          <p className="text-muted-foreground">
            Take a free, private self-assessment. See how trust, transparency,
            and decision-making are experienced in your organisation — in about
            3 minutes.
          </p>
        </div>

        <SurveyForm
          questions={questions}
          answers={answers}
          onAnswer={setAnswer}
          onSubmit={handleSubmit}
          submitting={submitting}
          missingIds={missingIds}
          validationError={validationError}
          onShowMissing={handleShowMissing}
          error={error}
        />
      </div>
    </AppShell>
  );
}
