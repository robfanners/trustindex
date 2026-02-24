"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import AuthenticatedShell from "@/components/AuthenticatedShell";
import RequireAuth from "@/components/RequireAuth";
import { useAuth } from "@/context/AuthContext";
import { canExportResults } from "@/lib/entitlements";
import {
  SYSTEM_QUESTIONS,
  SYSTEM_DIMENSIONS,
  MATURITY_LEVELS,
  EVIDENCE_TYPES,
} from "@/lib/systemQuestionBank";
import type {
  SystemQuestion,
  QuestionAnswer,
  MaturityLevel,
  Evidence,
  EvidenceType,
} from "@/lib/systemQuestionBank";
import {
  questionScore as calcQuestionScore,
  computeAllScores,
} from "@/lib/systemScoring";
import type { RiskFlag } from "@/lib/systemScoring";
import type { Recommendation } from "@/lib/systemRecommendations";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
} from "recharts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function bandFor(score: number) {
  if (score < 40)
    return {
      label: "Fragile",
      color: "text-destructive",
      bg: "bg-destructive/10",
      summary:
        "Significant trust gaps exist in this system. Immediate attention is recommended before further deployment or reliance.",
    };
  if (score < 70)
    return {
      label: "Mixed",
      color: "text-warning",
      bg: "bg-warning/10",
      summary:
        "Some trust dimensions are adequate but others need work. Target the weakest dimension first.",
    };
  return {
    label: "Strong",
    color: "text-success",
    bg: "bg-success/10",
    summary:
      "This system demonstrates strong trust characteristics. Continue monitoring and protect what is working.",
  };
}

function scoreBadgeColor(score: number): string {
  if (score < 0.25) return "bg-destructive/15 text-destructive";
  if (score < 0.5) return "bg-warning/15 text-warning";
  return "bg-success/15 text-success";
}

// CSV helpers
function escapeCsv(value: unknown) {
  const str = value == null ? "" : String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

// ---------------------------------------------------------------------------
// Page wrapper
// ---------------------------------------------------------------------------

export default function SystemAssessPage() {
  return (
    <RequireAuth>
      <AuthenticatedShell>
        <SystemAssessContent />
      </AuthenticatedShell>
    </RequireAuth>
  );
}

// ---------------------------------------------------------------------------
// Main content
// ---------------------------------------------------------------------------

type Phase = "loading" | "create-run" | "assess" | "submitting" | "results";

type RunData = {
  id: string;
  system_id: string;
  version_label: string | null;
  status: string;
  overall_score: number | null;
  dimension_scores: Record<string, number> | null;
  risk_flags: RiskFlag[] | null;
  created_at?: string;
};

function SystemAssessContent() {
  const params = useParams<{ systemId: string }>();
  const systemId = params?.systemId;
  const { profile } = useAuth();
  const exportAllowed = canExportResults(profile?.plan);

  const [phase, setPhase] = useState<Phase>("loading");
  const [systemName, setSystemName] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);

  // Run state
  const [runId, setRunId] = useState<string | null>(null);
  const [versionLabel, setVersionLabel] = useState("");
  const [existingDraft, setExistingDraft] = useState<RunData | null>(null);

  // Assessment state
  const [answers, setAnswers] = useState<Record<string, QuestionAnswer>>({});
  const [savingQuestion, setSavingQuestion] = useState<string | null>(null);

  // Results state
  const [resultRun, setResultRun] = useState<RunData | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);

  // Autosave debounce refs
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // -------------------------------------------------------------------------
  // Load system info + check for existing draft
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!systemId) return;
    (async () => {
      try {
        // Fetch system name
        const sysRes = await fetch(`/api/systems/${systemId}`);
        if (!sysRes.ok) {
          setError(
            "Could not load system. It may not exist or you may not have access."
          );
          setPhase("create-run");
          return;
        }
        const sysData = await sysRes.json();
        setSystemName(sysData.system?.name || "");

        // Check for existing draft run
        const runsRes = await fetch(`/api/systems/${systemId}/runs`);
        if (runsRes.ok) {
          const runsData = await runsRes.json();
          const draft = (runsData.runs || []).find(
            (r: RunData) => r.status === "draft"
          );
          if (draft) {
            setExistingDraft(draft);
          }
        }

        setPhase("create-run");
      } catch {
        setError("Failed to load system information.");
        setPhase("create-run");
      }
    })();
  }, [systemId]);

  // -------------------------------------------------------------------------
  // Resume a draft run: load saved responses
  // -------------------------------------------------------------------------

  const resumeRun = useCallback(
    async (draftRunId: string) => {
      setError(null);
      setPhase("loading");
      try {
        const res = await fetch(`/api/systems/runs/${draftRunId}`);
        if (!res.ok) throw new Error("Failed to load run");
        const data = await res.json();

        setRunId(draftRunId);
        setVersionLabel(data.run?.version_label || "");

        // Rebuild answers from saved responses
        const loaded: Record<string, QuestionAnswer> = {};
        for (const resp of data.responses || []) {
          const answer: QuestionAnswer = resp.answer as QuestionAnswer;
          if (resp.evidence) {
            answer.evidence = resp.evidence as Evidence;
          }
          loaded[resp.question_id as string] = answer;
        }
        setAnswers(loaded);
        setPhase("assess");
      } catch {
        setError("Failed to resume draft. Please try again.");
        setPhase("create-run");
      }
    },
    []
  );

  // -------------------------------------------------------------------------
  // Create a new run
  // -------------------------------------------------------------------------

  const createRun = useCallback(async () => {
    if (!systemId) return;
    setError(null);
    setPhase("loading");
    try {
      const res = await fetch(`/api/systems/${systemId}/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version_label: versionLabel.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create run");
      }
      const data = await res.json();
      setRunId(data.run.id);
      setAnswers({});
      setPhase("assess");
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to create assessment run."
      );
      setPhase("create-run");
    }
  }, [systemId, versionLabel]);

  // -------------------------------------------------------------------------
  // Autosave a single question response
  // -------------------------------------------------------------------------

  const saveResponse = useCallback(
    async (questionId: string, answer: QuestionAnswer) => {
      if (!runId) return;
      setSavingQuestion(questionId);
      try {
        const body: Record<string, unknown> = {
          question_id: questionId,
          answer: {
            ...(answer.maturity != null ? { maturity: answer.maturity } : {}),
            ...(answer.boolean != null ? { boolean: answer.boolean } : {}),
          },
        };
        if (answer.evidence) {
          body.evidence = answer.evidence;
        }
        await fetch(`/api/systems/runs/${runId}/responses`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } catch {
        // Silently fail — user can retry
      } finally {
        setSavingQuestion(null);
      }
    },
    [runId]
  );

  // -------------------------------------------------------------------------
  // Handle answer change (with debounced autosave)
  // -------------------------------------------------------------------------

  const handleAnswerChange = useCallback(
    (questionId: string, updatedAnswer: QuestionAnswer) => {
      setAnswers((prev) => ({ ...prev, [questionId]: updatedAnswer }));

      // Debounce autosave
      if (saveTimers.current[questionId]) {
        clearTimeout(saveTimers.current[questionId]);
      }
      saveTimers.current[questionId] = setTimeout(() => {
        saveResponse(questionId, updatedAnswer);
      }, 500);
    },
    [saveResponse]
  );

  // -------------------------------------------------------------------------
  // Submit assessment
  // -------------------------------------------------------------------------

  const handleSubmit = useCallback(async () => {
    if (!runId) return;

    // Validate all 25 questions answered
    const answeredIds = new Set(Object.keys(answers));
    const missing = SYSTEM_QUESTIONS.filter((q) => !answeredIds.has(q.id));
    if (missing.length > 0) {
      setError(
        `Please answer all questions. ${missing.length} remaining: ${missing
          .slice(0, 3)
          .map((q) => q.id)
          .join(", ")}${missing.length > 3 ? "..." : ""}`
      );
      // Scroll to first unanswered
      const el = document.querySelector(
        `[data-qid="${missing[0].id}"]`
      );
      if (el instanceof HTMLElement) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }

    setError(null);
    setPhase("submitting");

    try {
      const res = await fetch(`/api/systems/runs/${runId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Submit failed (${res.status})`);
      }

      const data = await res.json();
      setResultRun(data.run);
      setRecommendations(data.recommendations || []);
      setPhase("results");
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to submit assessment."
      );
      setPhase("assess");
    }
  }, [runId, answers]);

  // -------------------------------------------------------------------------
  // CSV export (client-side, data already loaded)
  // -------------------------------------------------------------------------

  const downloadAssessmentCsv = useCallback(() => {
    if (!resultRun) return;
    setExportStatus(null);
    setExporting(true);

    try {
      const overall = resultRun.overall_score ?? 0;
      const dimScores = resultRun.dimension_scores ?? {};
      const riskFlags = (resultRun.risk_flags ?? []) as RiskFlag[];
      const exportedAt = new Date().toISOString();
      const lines: string[] = [];

      // Section 1: Summary
      lines.push(["Section", "Key", "Value"].map(escapeCsv).join(","));
      lines.push(
        ["Summary", "System", systemName].map(escapeCsv).join(",")
      );
      lines.push(
        ["Summary", "Overall Score", String(overall)].map(escapeCsv).join(",")
      );
      lines.push(
        ["Summary", "Band", bandFor(overall).label].map(escapeCsv).join(",")
      );
      lines.push(
        ["Summary", "Exported At", exportedAt].map(escapeCsv).join(",")
      );
      if (resultRun.version_label) {
        lines.push(
          ["Summary", "Version", resultRun.version_label]
            .map(escapeCsv)
            .join(",")
        );
      }
      lines.push("");

      // Section 2: Dimension scores
      lines.push(
        ["Dimension", "Score"].map(escapeCsv).join(",")
      );
      for (const dim of SYSTEM_DIMENSIONS) {
        lines.push(
          [dim, String(dimScores[dim] ?? 0)].map(escapeCsv).join(",")
        );
      }
      lines.push("");

      // Section 3: Question-level detail
      lines.push(
        [
          "Dimension",
          "Control",
          "Question",
          "Answer Type",
          "Answer",
          "Evidence Type",
          "Evidence Pointer",
          "Evidence Note",
          "Score",
        ]
          .map(escapeCsv)
          .join(",")
      );
      for (const q of SYSTEM_QUESTIONS) {
        const a = answers[q.id];
        const answerValue =
          q.answerType === "boolean"
            ? a?.boolean != null
              ? a.boolean
                ? "Yes"
                : "No"
              : ""
            : a?.maturity ?? "";
        const score = a ? calcQuestionScore(a, q.answerType) : null;
        lines.push(
          [
            q.dimension,
            q.control,
            q.prompt,
            q.answerType,
            String(answerValue),
            a?.evidence?.type ?? "",
            a?.evidence?.pointer ?? "",
            a?.evidence?.note ?? "",
            score != null ? String(Math.round(score * 100)) + "%" : "",
          ]
            .map(escapeCsv)
            .join(",")
        );
      }
      lines.push("");

      // Section 4: Risk flags
      if (riskFlags.length > 0) {
        lines.push(
          ["Risk Flag", "Label", "Description"].map(escapeCsv).join(",")
        );
        for (const flag of riskFlags) {
          lines.push(
            [flag.code, flag.label, flag.description]
              .map(escapeCsv)
              .join(",")
          );
        }
        lines.push("");
      }

      // Section 5: Recommendations
      if (recommendations.length > 0) {
        lines.push(
          ["Priority", "Dimension", "Control", "Recommendation"]
            .map(escapeCsv)
            .join(",")
        );
        for (const rec of recommendations) {
          lines.push(
            [rec.priority, rec.dimension, rec.control, rec.recommendation]
              .map(escapeCsv)
              .join(",")
          );
        }
      }

      const csv = lines.join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `trustsysgraph_${resultRun.id}_assessment.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setExportStatus("CSV downloaded.");
    } catch (err: unknown) {
      setExportStatus(
        err instanceof Error ? err.message : "Failed to export CSV."
      );
    } finally {
      setExporting(false);
    }
  }, [resultRun, systemName, answers, recommendations]);

  // -------------------------------------------------------------------------
  // Derived: progress, client-side score preview
  // -------------------------------------------------------------------------

  const answeredCount = Object.keys(answers).length;
  const totalQuestions = SYSTEM_QUESTIONS.length;
  const progressPct = Math.round((answeredCount / totalQuestions) * 100);
  const allAnswered = answeredCount === totalQuestions;

  const previewScores = useMemo(() => {
    if (answeredCount === 0) return null;
    return computeAllScores(answers);
  }, [answers, answeredCount]);

  // -------------------------------------------------------------------------
  // Render: loading
  // -------------------------------------------------------------------------

  if (phase === "loading") {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
        <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        Loading...
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render: create-run
  // -------------------------------------------------------------------------

  if (phase === "create-run") {
    return (
      <div className="max-w-xl space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-bold">System assessment</h1>
          {systemName && (
            <p className="text-muted-foreground">{systemName}</p>
          )}
          <p className="text-sm text-muted-foreground">
            Assess this system across five trust dimensions: Transparency,
            Explainability, Human Oversight, Risk Controls, and Accountability.
          </p>
        </header>

        {error && (
          <div className="border border-destructive bg-destructive/5 text-destructive rounded-lg p-4 text-sm">
            {error}
          </div>
        )}

        {/* Resume existing draft */}
        {existingDraft && (
          <div className="border border-brand bg-brand/5 rounded-lg p-5 space-y-3">
            <div className="font-medium">You have a draft in progress</div>
            <p className="text-sm text-muted-foreground">
              Started{" "}
              {existingDraft.created_at ? new Date(existingDraft.created_at).toLocaleDateString() : "recently"}.
              {existingDraft.version_label && (
                <> Label: <strong>{existingDraft.version_label}</strong></>
              )}
            </p>
            <button
              type="button"
              onClick={() => resumeRun(existingDraft.id)}
              className="px-5 py-2.5 rounded bg-brand text-white font-semibold hover:bg-brand-hover text-sm"
            >
              Continue draft
            </button>
          </div>
        )}

        {/* New run */}
        <div className="border border-border rounded-lg p-5 space-y-4">
          <div className="font-medium">
            {existingDraft ? "Or start a new assessment" : "Start a new assessment"}
          </div>
          <div className="space-y-1">
            <label
              htmlFor="version-label"
              className="block text-sm text-muted-foreground"
            >
              Version label (optional)
            </label>
            <input
              id="version-label"
              type="text"
              value={versionLabel}
              onChange={(e) => setVersionLabel(e.target.value)}
              placeholder="e.g. v0.8, Jan 2026 prod"
              className="w-full border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-brand"
            />
          </div>
          <button
            type="button"
            onClick={createRun}
            className="px-5 py-2.5 rounded bg-foreground text-white font-semibold hover:bg-muted-foreground text-sm"
          >
            Start assessment
          </button>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render: results
  // -------------------------------------------------------------------------

  if (phase === "results" && resultRun) {
    const overall = resultRun.overall_score ?? 0;
    const dimScores = resultRun.dimension_scores ?? {};
    const riskFlags = (resultRun.risk_flags ?? []) as RiskFlag[];
    const band = bandFor(overall);

    const radarData = SYSTEM_DIMENSIONS.map((dim) => ({
      dimension: dim,
      score: dimScores[dim] ?? 0,
    }));

    // Evidence gaps: questions without strong evidence
    const evidenceGaps = SYSTEM_QUESTIONS.filter((q) => {
      const a = answers[q.id];
      if (!a) return true;
      if (!a.evidence) return true;
      const pointer = a.evidence.pointer?.trim();
      return !pointer;
    });

    return (
      <div className="max-w-4xl space-y-8">
        <header className="space-y-2">
          <h1 className="text-2xl font-bold">Assessment complete</h1>
          {systemName && (
            <p className="text-muted-foreground">{systemName}</p>
          )}
        </header>

        {/* Score hero */}
        <div className="border border-border rounded-lg p-6 flex items-end justify-between">
          <div>
            <div className="text-sm text-muted-foreground">
              TrustSysGraph score
            </div>
            <div className="text-5xl font-bold">{overall}</div>
          </div>
          <div className={`text-lg font-semibold ${band.color}`}>
            {band.label}
          </div>
        </div>

        {/* Band interpretation */}
        <div className="border border-border rounded-lg p-6 space-y-2">
          <div className="text-sm text-muted-foreground">What this means</div>
          <div className={`text-xl font-semibold ${band.color}`}>
            {band.label} trust ({overall}/100)
          </div>
          <div className="text-sm text-muted-foreground">{band.summary}</div>
        </div>

        {/* Radar + Dimensions */}
        <div className="grid md:grid-cols-2 gap-6">
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

          <div className="border border-border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Dimensions</h2>
            <div className="space-y-3">
              {SYSTEM_DIMENSIONS.map((dim) => {
                const score = dimScores[dim] ?? 0;
                const dimBand = bandFor(score);
                return (
                  <div
                    key={dim}
                    className="flex items-center justify-between border border-border rounded p-3"
                  >
                    <div className="font-medium text-sm">{dim}</div>
                    <div
                      className={`text-sm font-semibold ${dimBand.color}`}
                    >
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
          <div className="border border-destructive/30 bg-destructive/5 rounded-lg p-6 space-y-3">
            <h2 className="text-lg font-semibold text-destructive">
              Risk flags ({riskFlags.length})
            </h2>
            <div className="space-y-2">
              {riskFlags.map((flag) => (
                <div
                  key={flag.code}
                  className="border border-destructive/20 rounded p-3 space-y-1"
                >
                  <div className="font-medium text-sm text-destructive">
                    {flag.label}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {flag.description}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommendations */}
        {recommendations.length > 0 && (
          <div className="border border-border rounded-lg p-6 space-y-3">
            <h2 className="text-lg font-semibold">
              Recommendations ({recommendations.length})
            </h2>
            <div className="space-y-3">
              {recommendations.map((rec, idx) => (
                <div
                  key={idx}
                  className="border border-border rounded p-4 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded ${
                        rec.priority === "high"
                          ? "bg-destructive/15 text-destructive"
                          : "bg-warning/15 text-warning"
                      }`}
                    >
                      {rec.priority.toUpperCase()}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {rec.dimension} &middot; {rec.control}
                    </span>
                  </div>
                  <div className="text-sm">{rec.recommendation}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Evidence gaps */}
        {evidenceGaps.length > 0 && (
          <div className="border border-border rounded-lg p-6 space-y-3">
            <h2 className="text-lg font-semibold">
              Evidence gaps ({evidenceGaps.length})
            </h2>
            <p className="text-sm text-muted-foreground">
              These questions are missing strong evidence. Adding evidence will
              improve your score.
            </p>
            <div className="space-y-2">
              {evidenceGaps.map((q) => (
                <div
                  key={q.id}
                  className="flex items-center justify-between border border-border rounded p-3"
                >
                  <div className="text-sm">{q.control}</div>
                  <div className="text-xs text-muted-foreground">
                    {q.dimension}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Export */}
        <div className="border border-border rounded-lg p-6 space-y-3">
          <h2 className="text-lg font-semibold">Export</h2>
          {exportAllowed ? (
            <>
              <button
                className="px-3 py-2 border border-border rounded hover:bg-[#f5f5f5] text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={downloadAssessmentCsv}
                disabled={exporting}
              >
                {exporting ? "Preparing CSV..." : "Download assessment CSV"}
              </button>
              {exportStatus && (
                <div className="text-sm text-muted-foreground">{exportStatus}</div>
              )}
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                CSV export is available on Pro and Enterprise plans.
              </p>
              <a
                className="inline-block px-4 py-2 rounded bg-brand text-white text-sm font-semibold hover:bg-brand-hover"
                href="/upgrade"
              >
                Upgrade to Pro
              </a>
            </>
          )}
        </div>

        {/* Navigation */}
        <div className="flex flex-wrap gap-3 text-sm">
          <a
            className="text-brand underline hover:text-foreground"
            href="/dashboard?tab=systems"
          >
            Back to Systems
          </a>
          <span className="text-muted-foreground">&middot;</span>
          <a
            className="text-brand underline hover:text-foreground"
            href={`/systems/${systemId}/assess`}
          >
            Run another assessment
          </a>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render: assess / submitting
  // -------------------------------------------------------------------------

  return (
    <div className="max-w-3xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">System assessment</h1>
        {systemName && (
          <p className="text-muted-foreground">{systemName}</p>
        )}
        <p className="text-sm text-muted-foreground">
          Assess this system across five trust dimensions. For each control,
          select the maturity level or yes/no, then provide supporting evidence.
        </p>
      </header>

      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Progress: {answeredCount}/{totalQuestions}
          </span>
          {previewScores && (
            <span className="text-muted-foreground">
              Preview score: {previewScores.overall}/100
            </span>
          )}
        </div>
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-brand rounded-full transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="border border-destructive bg-destructive/5 text-destructive rounded-lg p-4 text-sm">
          {error}
        </div>
      )}

      {/* Questions grouped by dimension */}
      {SYSTEM_DIMENSIONS.map((dim) => {
        const dimQuestions = SYSTEM_QUESTIONS.filter(
          (q) => q.dimension === dim
        );
        return (
          <div key={dim} className="space-y-4">
            <h2 className="text-lg font-semibold border-b border-border pb-2">
              {dim}
            </h2>
            {dimQuestions.map((q) => (
              <QuestionCard
                key={q.id}
                question={q}
                answer={answers[q.id]}
                onChange={(a) => handleAnswerChange(q.id, a)}
                saving={savingQuestion === q.id}
              />
            ))}
          </div>
        );
      })}

      {/* Submit bar */}
      <div className="sticky bottom-0 bg-gray-50 border-t border-border py-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={phase === "submitting" || !allAnswered}
          className="px-6 py-3 rounded bg-brand text-white font-semibold hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          {phase === "submitting"
            ? "Submitting..."
            : allAnswered
            ? "Submit assessment"
            : `Answer ${totalQuestions - answeredCount} more to submit`}
        </button>
        <a
          href="/dashboard?tab=systems"
          className="px-4 py-3 rounded border border-border hover:bg-gray-100 text-sm"
        >
          Save &amp; continue later
        </a>
        <span className="text-xs text-muted-foreground">
          Answers are saved automatically.
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// QuestionCard — maturity/boolean answer + evidence
// ---------------------------------------------------------------------------

function QuestionCard({
  question,
  answer,
  onChange,
  saving,
}: {
  question: SystemQuestion;
  answer?: QuestionAnswer;
  onChange: (a: QuestionAnswer) => void;
  saving: boolean;
}) {
  const current: QuestionAnswer = answer ?? {};

  // Compute live score preview
  const liveScore = answer
    ? calcQuestionScore(answer, question.answerType)
    : null;

  const hasAnswer =
    question.answerType === "boolean"
      ? current.boolean != null
      : current.maturity != null;

  return (
    <div
      data-qid={question.id}
      className={`border rounded-lg p-5 space-y-4 ${
        hasAnswer ? "border-border" : "border-border/50"
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            {question.dimension} &middot; {question.control}
          </div>
          <div className="font-medium text-sm">{question.prompt}</div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {saving && (
            <div className="w-3 h-3 border border-brand border-t-transparent rounded-full animate-spin" />
          )}
          {liveScore != null && (
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded ${scoreBadgeColor(
                liveScore
              )}`}
            >
              {Math.round(liveScore * 100)}%
            </span>
          )}
        </div>
      </div>

      {/* Answer input */}
      {question.answerType === "enum_maturity" ? (
        <div className="space-y-1">
          <label className="block text-xs text-muted-foreground">
            Maturity level
          </label>
          <div className="flex flex-wrap gap-2">
            {MATURITY_LEVELS.map((ml) => (
              <button
                key={ml.value}
                type="button"
                onClick={() =>
                  onChange({ ...current, maturity: ml.value as MaturityLevel })
                }
                className={`px-3 py-1.5 rounded border text-xs font-medium transition-colors ${
                  current.maturity === ml.value
                    ? "bg-foreground text-white border-foreground"
                    : "bg-background text-foreground border-border hover:border-foreground"
                }`}
              >
                {ml.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-1">
          <label className="block text-xs text-muted-foreground">
            Is this in place?
          </label>
          <div className="flex gap-2">
            {[
              { label: "Yes", value: true },
              { label: "No", value: false },
            ].map((opt) => (
              <button
                key={String(opt.value)}
                type="button"
                onClick={() => onChange({ ...current, boolean: opt.value })}
                className={`px-4 py-1.5 rounded border text-xs font-medium transition-colors ${
                  current.boolean === opt.value
                    ? "bg-foreground text-white border-foreground"
                    : "bg-background text-foreground border-border hover:border-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Evidence block */}
      <EvidenceBlock
        evidence={current.evidence}
        onChange={(ev) => onChange({ ...current, evidence: ev })}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// EvidenceBlock — evidence type + pointer + optional note
// ---------------------------------------------------------------------------

function EvidenceBlock({
  evidence,
  onChange,
}: {
  evidence?: Evidence;
  onChange: (ev: Evidence | undefined) => void;
}) {
  const hasEvidence = evidence != null;

  if (!hasEvidence) {
    return (
      <button
        type="button"
        onClick={() =>
          onChange({ type: "link", pointer: "" })
        }
        className="text-xs text-brand hover:underline"
      >
        + Add evidence
      </button>
    );
  }

  return (
    <div className="border border-dashed border-border rounded p-3 space-y-3 bg-gray-50">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Evidence
        </span>
        <button
          type="button"
          onClick={() => onChange(undefined)}
          className="text-xs text-destructive hover:underline"
        >
          Remove
        </button>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="block text-xs text-muted-foreground">Type</label>
          <select
            value={evidence.type}
            onChange={(e) =>
              onChange({ ...evidence, type: e.target.value as EvidenceType })
            }
            className="w-full border border-border rounded px-2 py-1.5 text-xs focus:outline-none focus:border-brand bg-background"
          >
            {EVIDENCE_TYPES.map((et) => (
              <option key={et.value} value={et.value}>
                {et.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="block text-xs text-muted-foreground">
            Pointer (URL, ID, path)
          </label>
          <input
            type="text"
            value={evidence.pointer}
            onChange={(e) =>
              onChange({ ...evidence, pointer: e.target.value })
            }
            placeholder="https://... or JIRA-123"
            className="w-full border border-border rounded px-2 py-1.5 text-xs focus:outline-none focus:border-brand"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="block text-xs text-muted-foreground">
          Note (optional)
        </label>
        <textarea
          value={evidence.note ?? ""}
          onChange={(e) =>
            onChange({
              ...evidence,
              note: e.target.value || undefined,
            })
          }
          rows={2}
          placeholder="Additional context about the evidence..."
          className="w-full border border-border rounded px-2 py-1.5 text-xs focus:outline-none focus:border-brand resize-none"
        />
      </div>
    </div>
  );
}
