"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import AppShell from "@/components/AppShell";
import SurveyForm, { type Question } from "@/components/SurveyForm";

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

  // -------------------------------------------------------------------------
  // Load invite + questions
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!token) return;

    const load = async () => {
      setLoading(true);
      setError(null);

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

      const { data: qs, error: qErr } = await supabase
        .from("questions")
        .select("id, dimension, prompt, sort_order")
        .order("sort_order", { ascending: true });

      if (qErr || !qs) {
        setError("Could not load questions.");
        setLoading(false);
        return;
      }

      setQuestions(qs as Question[]);
      setLoading(false);
    };

    load();
  }, [token]);

  // -------------------------------------------------------------------------
  // Answer + submit handlers
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
        "We couldn't submit your responses. Please try again. If it keeps happening, refresh the page and re-enter your answers."
      );
      setSubmitting(false);
      return;
    }

    await supabase
      .from("invites")
      .update({ used_at: new Date().toISOString() })
      .eq("token", token);

    setSubmitted(true);
    setSubmitting(false);
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (loading) {
    return (
      <AppShell>
        <div className="max-w-3xl mx-auto p-4 md:p-6 lg:p-10">
          <div className="text-verisum-grey">Loading survey…</div>
        </div>
      </AppShell>
    );
  }

  if (error && questions.length === 0) {
    return (
      <AppShell>
        <div className="max-w-3xl mx-auto p-4 md:p-6 lg:p-10 space-y-4">
          <h1 className="text-2xl font-bold">TrustOrg Survey</h1>
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
                    encodeURIComponent("My TrustGraph results link") +
                    "&body=" +
                    encodeURIComponent(
                      `Here are my TrustGraph links:\n\n` +
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
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">TrustOrg Survey</h1>
          <p className="text-verisum-grey">
            This survey helps your organisation understand how trust, transparency, and decision-making are experienced in practice.
          </p>
        </div>

        <SurveyForm
          questions={questions}
          answers={answers}
          onAnswer={setAnswer}
          onSubmit={submit}
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
