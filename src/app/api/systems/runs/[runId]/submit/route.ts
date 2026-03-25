import { NextRequest } from "next/server";
import { requireAuth, apiError, apiOk } from "@/lib/apiHelpers";
import { SYSTEM_QUESTIONS } from "@/lib/systemQuestionBank";
import type { QuestionAnswer } from "@/lib/systemQuestionBank";
import { computeAllScores, computeRiskFlags } from "@/lib/systemScoring";
import { generateRecommendations } from "@/lib/systemRecommendations";

type RouteContext = { params: Promise<{ runId: string }> };

// ---------------------------------------------------------------------------
// POST /api/systems/runs/[runId]/submit — server-side scoring + submit
// ---------------------------------------------------------------------------

export async function POST(_req: NextRequest, context: RouteContext) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const { user, db } = auth;

  try {
    const { runId } = await context.params;

    // Fetch run
    const { data: run, error: runErr } = await db
      .from("system_runs")
      .select("id, system_id, status")
      .eq("id", runId)
      .single();

    if (runErr || !run) {
      return apiError("Run not found", 404);
    }

    if (run.status !== "draft") {
      return apiError("Run has already been submitted", 409);
    }

    // Verify ownership via system
    const { data: system, error: sysErr } = await db
      .from("systems")
      .select("id, owner_id")
      .eq("id", run.system_id)
      .single();

    if (sysErr || !system || system.owner_id !== user.id) {
      return apiError("Not authorised", 403);
    }

    // Fetch all responses for this run
    const { data: responses, error: respErr } = await db
      .from("system_responses")
      .select("question_id, answer, evidence")
      .eq("run_id", runId);

    if (respErr) {
      return apiError(respErr.message, 500);
    }

    // Validate: all 25 questions must have responses
    const answeredIds = new Set((responses || []).map((r) => r.question_id));
    const missingIds = SYSTEM_QUESTIONS.filter(
      (q) => !answeredIds.has(q.id)
    ).map((q) => q.id);

    if (missingIds.length > 0) {
      return apiError(
        `Missing responses for ${missingIds.length} question(s)`,
        400
      );
    }

    // Build answers map from responses
    const answers: Record<string, QuestionAnswer> = {};
    for (const r of responses || []) {
      const answer: QuestionAnswer = r.answer as QuestionAnswer;
      // Merge evidence into the answer if present
      if (r.evidence) {
        answer.evidence = r.evidence as QuestionAnswer["evidence"];
      }
      answers[r.question_id as string] = answer;
    }

    // Compute scores
    const { dimensionScores, overall } = computeAllScores(answers);

    // Compute risk flags
    const riskFlags = computeRiskFlags(answers);

    // Generate recommendations
    const recommendations = generateRecommendations(answers);

    // Insert recommendations
    if (recommendations.length > 0) {
      const recRows = recommendations.map((r) => ({
        run_id: runId,
        question_id: r.questionId,
        dimension: r.dimension,
        control: r.control,
        priority: r.priority,
        recommendation: r.recommendation,
      }));

      const { error: recInsertErr } = await db
        .from("system_recommendations")
        .insert(recRows);

      if (recInsertErr) {
        return apiError(
          `Failed to save recommendations: ${recInsertErr.message}`,
          500
        );
      }
    }

    // Snapshot linked models at assessment time
    let modelSnapshot = null;
    const { data: linkedModels } = await db
      .from("system_model_links")
      .select("model_id, role, model_registry(model_name, model_version, provider)")
      .eq("system_id", run.system_id);

    if (linkedModels && linkedModels.length > 0) {
      modelSnapshot = linkedModels.map((lm) => {
        const mr = lm.model_registry as unknown as { model_name: string; model_version: string; provider: string | null } | null;
        return {
          model_id: lm.model_id,
          model_name: mr?.model_name ?? null,
          model_version: mr?.model_version ?? null,
          provider: mr?.provider ?? null,
          role: lm.role,
        };
      });
    }

    // Update the run to submitted
    const { data: updatedRun, error: updateErr } = await db
      .from("system_runs")
      .update({
        status: "submitted",
        submitted_at: new Date().toISOString(),
        overall_score: overall,
        dimension_scores: dimensionScores,
        risk_flags: riskFlags,
        model_snapshot: modelSnapshot,
      })
      .eq("id", runId)
      .select("*")
      .single();

    if (updateErr || !updatedRun) {
      return apiError(updateErr?.message || "Failed to update run", 500);
    }

    return apiOk({
      run: updatedRun,
      recommendations,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return apiError(message, 500);
  }
}
