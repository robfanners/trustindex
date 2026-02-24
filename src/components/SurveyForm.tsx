"use client";

import { useMemo } from "react";

// ---------------------------------------------------------------------------
// Types (exported for reuse)
// ---------------------------------------------------------------------------

export type Question = {
  id: string;
  dimension: string;
  prompt: string;
  sort_order: number;
};

export type SurveyFormProps = {
  questions: Question[];
  answers: Record<string, number>;
  onAnswer: (questionId: string, value: number) => void;
  onSubmit: () => void;
  submitting: boolean;
  missingIds: string[];
  validationError: string | null;
  /** Optional: show missing-question highlighting and set validation state */
  onShowMissing?: () => void;
  error?: string | null;
};

// ---------------------------------------------------------------------------
// SurveyForm — pure presentational survey question list + submit button
// ---------------------------------------------------------------------------

export default function SurveyForm({
  questions,
  answers,
  onAnswer,
  onSubmit,
  submitting,
  missingIds,
  validationError,
  onShowMissing,
  error,
}: SurveyFormProps) {
  const answeredCount = useMemo(() => Object.keys(answers).length, [answers]);
  const unansweredCount = questions.length - answeredCount;
  const firstUnansweredId = questions.find((q) => answers[q.id] == null)?.id;

  function jumpToFirstUnanswered() {
    if (onShowMissing) {
      onShowMissing();
    }
    if (firstUnansweredId) {
      const target = document.querySelector(`[data-qid="${firstUnansweredId}"]`);
      if (target instanceof HTMLElement) {
        target.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }

  return (
    <>
      {/* Header / progress */}
      <header className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Please answer all questions. Scale: 1 (Strongly disagree) → 5 (Strongly agree).
        </p>
        <div className="text-sm text-muted-foreground">
          Progress: {answeredCount}/{questions.length}
        </div>
        {unansweredCount > 0 && (
          <div className="text-sm text-muted-foreground">
            You have {unansweredCount} unanswered question(s).{" "}
            <button
              type="button"
              className="text-brand underline"
              onClick={jumpToFirstUnanswered}
            >
              Jump to first unanswered
            </button>
          </div>
        )}
      </header>

      {/* Validation banner */}
      {validationError && (
        <div className="border border-destructive bg-[#ffe5e5] text-destructive rounded-lg p-4 text-sm">
          {validationError}
        </div>
      )}

      {/* Question cards */}
      <div className="space-y-6">
        {questions.map((q, idx) => {
          const isMissing = missingIds.includes(q.id);
          return (
            <div
              key={q.id}
              data-qid={q.id}
              className={[
                "border rounded-lg p-6 space-y-3",
                isMissing
                  ? "border-destructive bg-[#ffe5e5]"
                  : "border-border",
              ].join(" ")}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  {q.dimension}
                </div>
                {isMissing && (
                  <div className="text-xs font-semibold text-destructive">Required</div>
                )}
              </div>
              <div className="font-medium">
                {idx + 1}. {q.prompt}
              </div>

              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => onAnswer(q.id, v)}
                    className={[
                      "w-10 h-10 rounded border text-sm",
                      answers[q.id] === v
                        ? "bg-foreground text-white border-foreground"
                        : "bg-background text-foreground border-border hover:border-border",
                    ].join(" ")}
                    aria-label={`Answer ${v}`}
                  >
                    {v}
                  </button>
                ))}
              </div>

              <div className="text-xs text-muted-foreground">
                1 = Strongly disagree · 3 = Neutral · 5 = Strongly agree
              </div>
              {isMissing && (
                <div className="text-xs font-medium text-destructive">
                  Please answer this question.
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Error */}
      {error && <div className="text-destructive">{error}</div>}

      {/* Submit bar */}
      <div className="pt-2">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitting || answeredCount !== questions.length}
            className="px-6 py-3 rounded bg-brand text-white font-semibold hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting
              ? "Submitting…"
              : unansweredCount > 0
              ? `Answer ${unansweredCount} more to submit`
              : "Submit"}
          </button>
          {unansweredCount > 0 && (
            <button
              type="button"
              className="px-4 py-3 rounded border hover:bg-[#f5f5f5] text-sm"
              onClick={jumpToFirstUnanswered}
            >
              Show missing questions
            </button>
          )}
        </div>
      </div>
    </>
  );
}
