"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import AppShell from "@/components/AppShell";

type Question = {
  id: string;
  dimension: string;
  prompt: string;
  sort_order: number;
};

export default function SurveyPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token;

  const [loading, setLoading] = useState(true);
  const [runId, setRunId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [missingIds, setMissingIds] = useState<string[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [runMode, setRunMode] = useState<"explorer" | "org" | null>(null);

  const answeredCount = useMemo(() => Object.keys(answers).length, [answers]);
  const unansweredCount = questions.length - answeredCount;
  const firstUnansweredId = questions.find((q) => answers[q.id] == null)?.id;

  useEffect(() => {
    if (!token) return;

    const load = async () => {
      setLoading(true);
      setError(null);

      // 1) Validate token -> get run_id
      const { data: invite, error: inviteErr } = await supabase
        .from("invites")
        .select("run_id, token")
        .eq("token", token)
        .single();

      if (inviteErr || !invite) {
        setError("Invalid or expired survey link.");
        setLoading(false);
        return;
      }

      setRunId(invite.run_id);

      const { data: runRow, error: runRowErr } = await supabase
        .from("survey_runs")
        .select("mode")
        .eq("id", invite.run_id)
        .single();

      if (!runRowErr && runRow) {
        setRunMode(runRow.mode as "explorer" | "org");
      }

      // 2) Load questions
      const { data: qs, error: qErr } = await supabase
        .from("questions")
        .select("id, dimension, prompt, sort_order")
        .order("sort_order", { ascending: true });

      if (qErr || !qs) {
        setError("Could not load questions.");
        setLoading(false);
        return;
      }

      setQuestions(qs as Question[]);      setLoading(false);
    };

    load();
  }, [token]);

  const setAnswer = (questionId: string, value: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    setMissingIds((prev) => prev.filter((id) => id !== questionId));
    setValidationError(null);
  };

  const submit = async () => {
    if (!runId) return;

    setError(null);
    setValidationError(null);
    setSubmitting(true);

    if (questions.length === 0) {
      setError("No questions found.");
      setSubmitting(false);
      return;
    }

    const missing = questions
      .filter((q) => answers[q.id] == null)
      .map((q) => q.id);

    if (missing.length > 0) {
      setMissingIds(missing);
      setValidationError(`Please answer ${missing.length} required questions.`);
      const firstMissing = missing[0];
      const target = document.querySelector(`[data-qid="${firstMissing}"]`);
      if (target instanceof HTMLElement) {
        target.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      setSubmitting(false);
      return;
    }

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
      setError(
        "We couldn’t submit your responses. Please try again. If it keeps happening, refresh the page and re-enter your answers."
      );
      setSubmitting(false);
      return;
    }

    // mark invite used (optional, but useful)
    await supabase
      .from("invites")
      .update({ used_at: new Date().toISOString() })
      .eq("token", token);

    setSubmitted(true);
    setSubmitting(false);
  };

  if (loading) {
    return (
      <AppShell>
        <div className="max-w-3xl mx-auto p-4 md:p-6 lg:p-10">
          <div className="text-verisum-grey">Loading survey…</div>
        </div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell>
        <div className="max-w-3xl mx-auto p-4 md:p-6 lg:p-10 space-y-4">
          <h1 className="text-2xl font-bold">TrustIndex Survey</h1>
          <div className="text-verisum-red">{error}</div>
        </div>
      </AppShell>
    );
  }

  if (submitted) {
    return (
      <AppShell>
        <div className="max-w-3xl mx-auto p-4 md:p-6 lg:p-10 space-y-4">
          <h1 className="text-3xl font-bold">Thank you</h1>
          <p className="text-verisum-grey">
            Your responses have been recorded. You can now close this window.
          </p>
          {runId && (
            <div className="flex flex-wrap items-center gap-3">
              <a
                className="px-5 py-3 rounded bg-verisum-blue text-verisum-white font-semibold hover:bg-[#2a7bb8]"
                href={`/dashboard/${runId}`}
              >
                View results
              </a>
              {runMode === "org" && (
                <a className="text-verisum-blue underline" href={`/admin/run/${runId}`}>
                  Open Survey Dashboard
                </a>
              )}
              {runMode === "explorer" && (
                <a
                  className="px-4 py-3 rounded border hover:bg-[#f5f5f5] text-sm"
                  href={
                    "mailto:?" +
                    "subject=" +
                    encodeURIComponent("My TrustIndex results link") +
                    "&body=" +
                    encodeURIComponent(
                      `Here are my TrustIndex links:\n\n` +
                        `Results: ${window.location.origin}/dashboard/${runId}\n` +
                        `Survey Dashboard: ${window.location.origin}/admin/run/${runId}\n`
                    )
                  }
                >
                  Email me my links
                </a>
              )}
            </div>
          )}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto p-4 md:p-6 lg:p-10 space-y-6 md:space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold">TrustIndex™ Survey</h1>
          <p className="text-verisum-grey">
            This survey helps your organisation understand how trust, transparency, and decision-making are experienced in practice.
          </p>
          <p className="text-sm text-verisum-grey">
            Please answer all questions. Scale: 1 (Strongly disagree) → 5 (Strongly agree).
          </p>
          <div className="text-sm text-verisum-grey">
            Progress: {answeredCount}/{questions.length}
          </div>
          {unansweredCount > 0 && (
            <div className="text-sm text-verisum-grey">
              You have {unansweredCount} unanswered question(s). Scroll to the highlighted items, or jump to the
              first one.{" "}
              <button
                type="button"
                className="text-verisum-blue underline"
                onClick={() => {
                  const missing = questions
                    .filter((q) => answers[q.id] == null)
                    .map((q) => q.id);
                  setMissingIds(missing);
                  setValidationError(`Please answer ${missing.length} required questions.`);
                  if (firstUnansweredId) {
                    const target = document.querySelector(`[data-qid="${firstUnansweredId}"]`);
                    if (target instanceof HTMLElement) {
                      target.scrollIntoView({ behavior: "smooth", block: "center" });
                    }
                  }
                }}
              >
                Jump to first unanswered
              </button>
            </div>
          )}
        </header>

        {validationError && (
          <div className="border border-verisum-red bg-[#ffe5e5] text-verisum-red rounded-lg p-4 text-sm">
            {validationError}
          </div>
        )}

        <div className="space-y-6">
          {questions.map((q, idx) => {
            const isMissing = missingIds.includes(q.id);
            return (
            <div
              key={q.id}
              data-qid={q.id}
              className={[
                "border border-verisum-grey rounded-lg p-6 space-y-3",
                isMissing ? "border-verisum-red bg-[#ffe5e5]" : "border-verisum-grey",
              ].join(" ")}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs uppercase tracking-wide text-verisum-grey">
                  {q.dimension}
                </div>
                {isMissing && <div className="text-xs font-semibold text-verisum-red">Required</div>}
              </div>
              <div className="font-medium">
                {idx + 1}. {q.prompt}
              </div>

              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setAnswer(q.id, v)}
                    className={[
                      "w-10 h-10 rounded border text-sm",
                      answers[q.id] === v
                        ? "bg-verisum-black text-verisum-white border-verisum-black"
                        : "bg-verisum-white text-verisum-black border-verisum-grey hover:border-verisum-grey",
                    ].join(" ")}
                    aria-label={`Answer ${v}`}
                  >
                    {v}
                  </button>
                ))}
              </div>

              <div className="text-xs text-verisum-grey">
                1 = Strongly disagree · 3 = Neutral · 5 = Strongly agree
              </div>
              {isMissing && (
                <div className="text-xs font-medium text-verisum-red">
                  Please answer this question.
                </div>
              )}
            </div>
          );
          })}
        </div>

        {error && <div className="text-verisum-red">{error}</div>}

        <div className="pt-2">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={submit}
              disabled={submitting || answeredCount !== questions.length}
              className="px-6 py-3 rounded bg-verisum-blue text-verisum-white font-semibold hover:bg-[#2a7bb8] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Submitting…" : unansweredCount > 0 ? `Answer ${unansweredCount} more to submit` : "Submit"}
            </button>
            {unansweredCount > 0 && (
              <button
                type="button"
                className="px-4 py-3 rounded border hover:bg-[#f5f5f5] text-sm"
                onClick={() => {
                  const missing = questions
                    .filter((q) => answers[q.id] == null)
                    .map((q) => q.id);
                  setMissingIds(missing);
                  setValidationError(`Please answer ${missing.length} required questions.`);
                  if (firstUnansweredId) {
                    const target = document.querySelector(`[data-qid="${firstUnansweredId}"]`);
                    if (target instanceof HTMLElement) {
                      target.scrollIntoView({ behavior: "smooth", block: "center" });
                    }
                  }
                }}
              >
                Show missing questions
              </button>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
