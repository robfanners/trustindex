import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-auth-server";
import { supabaseServer } from "@/lib/supabaseServer";
import { SYSTEM_QUESTIONS } from "@/lib/systemQuestionBank";
import type { QuestionAnswer } from "@/lib/systemQuestionBank";
import { computeAllScores, computeRiskFlags } from "@/lib/systemScoring";
import { generateRecommendations } from "@/lib/systemRecommendations";

type RouteContext = { params: Promise<{ runId: string }> };

// ---------------------------------------------------------------------------
// POST /api/systems/runs/[runId]/submit — server-side scoring + submit
// ---------------------------------------------------------------------------

export async function POST(_req: NextRequest, context: RouteContext) {
  try {
    const { runId } = await context.params;

    // Authenticate
    const authClient = await createSupabaseServerClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const db = supabaseServer();

    // Fetch run
    const { data: run, error: runErr } = await db
      .from("system_runs")
      .select("id, system_id, status")
      .eq("id", runId)
      .single();

    if (runErr || !run) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    if (run.status !== "draft") {
      return NextResponse.json(
        { error: "Run has already been submitted" },
        { status: 409 }
      );
    }

    // Verify ownership via system
    const { data: system, error: sysErr } = await db
      .from("systems")
      .select("id, owner_id")
      .eq("id", run.system_id)
      .single();

    if (sysErr || !system || system.owner_id !== user.id) {
      return NextResponse.json({ error: "Not authorised" }, { status: 403 });
    }

    // Fetch all responses for this run
    const { data: responses, error: respErr } = await db
      .from("system_responses")
      .select("question_id, answer, evidence")
      .eq("run_id", runId);

    if (respErr) {
      return NextResponse.json({ error: respErr.message }, { status: 500 });
    }

    // Validate: all 25 questions must have responses
    const answeredIds = new Set((responses || []).map((r) => r.question_id));
    const missingIds = SYSTEM_QUESTIONS.filter(
      (q) => !answeredIds.has(q.id)
    ).map((q) => q.id);

    if (missingIds.length > 0) {
      return NextResponse.json(
        {
          error: `Missing responses for ${missingIds.length} question(s)`,
          missing: missingIds,
        },
        { status: 400 }
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
        return NextResponse.json(
          { error: `Failed to save recommendations: ${recInsertErr.message}` },
          { status: 500 }
        );
      }
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
      })
      .eq("id", runId)
      .select("*")
      .single();

    if (updateErr || !updatedRun) {
      return NextResponse.json(
        { error: updateErr?.message || "Failed to update run" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      run: updatedRun,
      recommendations,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
