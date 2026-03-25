import { NextRequest } from "next/server";
import { requireAuth, apiError, apiOk } from "@/lib/apiHelpers";
import { supabaseServer } from "@/lib/supabaseServer";
import { SYSTEM_QUESTIONS } from "@/lib/systemQuestionBank";
import type { QuestionAnswer } from "@/lib/systemQuestionBank";
import { computeAllScores, computeRiskFlags } from "@/lib/systemScoring";
import { generateRecommendations } from "@/lib/systemRecommendations";
import {
  calculateDrift,
  calculateDimensionDrift,
  checkStability,
  DRIFT_THRESHOLD,
} from "@/lib/assessmentLifecycle";

// ---------------------------------------------------------------------------
// POST /api/trustsys/runs — create a new versioned run for an assessment
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;
    const { user, orgId, db } = auth;

    const body = await req.json();
    const assessmentId = body.assessment_id;

    if (!assessmentId) {
      return apiError("assessment_id is required", 400);
    }

    // Verify assessment exists and belongs to user's org
    const { data: assessment, error: assessErr } = await db
      .from("trustsys_assessments")
      .select("id, organisation_id")
      .eq("id", assessmentId)
      .single();

    if (assessErr || !assessment) {
      return apiError("Assessment not found", 404);
    }

    if (assessment.organisation_id !== orgId) {
      return apiError("Not authorised", 403);
    }

    // Get current max version_number for this assessment
    const { data: latestRun } = await db
      .from("trustsys_runs")
      .select("version_number")
      .eq("assessment_id", assessmentId)
      .order("version_number", { ascending: false })
      .limit(1)
      .single();

    const nextVersion = ((latestRun?.version_number as number) ?? 0) + 1;

    // Create the new run
    const { data: run, error: insertErr } = await db
      .from("trustsys_runs")
      .insert({
        assessment_id: assessmentId,
        created_by: user.id,
        version_number: nextVersion,
        status: "in_progress",
        stability_status: "provisional",
      })
      .select("id, assessment_id, version_number, status, created_at")
      .single();

    if (insertErr || !run) {
      return apiError(insertErr?.message || "Failed to create run", 500);
    }

    return apiOk({ run });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return apiError(message, 500);
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/trustsys/runs?id=<runId>&action=submit — submit a run with scoring
// ---------------------------------------------------------------------------

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;
    const { orgId, db } = auth;

    const { searchParams } = new URL(req.url);
    const runId = searchParams.get("id");
    const action = searchParams.get("action");

    if (!runId) {
      return apiError("id is required", 400);
    }

    if (action !== "submit") {
      return apiError("Only action=submit is supported", 400);
    }

    // Fetch the run
    const { data: run, error: runErr } = await db
      .from("trustsys_runs")
      .select("id, assessment_id, status, version_number")
      .eq("id", runId)
      .single();

    if (runErr || !run) {
      return apiError("Run not found", 404);
    }

    if (run.status !== "in_progress") {
      return apiError("Run is not in progress", 409);
    }

    // Check org ownership via the linked assessment
    const { data: runAssessment } = await db
      .from("trustsys_assessments")
      .select("organisation_id")
      .eq("id", run.assessment_id)
      .single();

    if (runAssessment?.organisation_id !== orgId) {
      return apiError("Not authorised", 403);
    }

    // -----------------------------------------------------------------------
    // Fetch responses (from legacy system_responses via the run's linked data,
    // or from tg_responses if using the new tables)
    // -----------------------------------------------------------------------
    // For now, the assess page still writes to system_responses via legacy API.
    // We'll also check tg_responses for new-format data.
    // -----------------------------------------------------------------------

    // Try tg_responses first (new table)
    let responses: { question_id: string; answer: QuestionAnswer; evidence: QuestionAnswer["evidence"] }[] = [];

    const { data: tgResponses } = await db
      .from("tg_responses")
      .select("question_id, answer, evidence")
      .eq("run_id", runId);

    if (tgResponses && tgResponses.length > 0) {
      responses = tgResponses.map((r) => ({
        question_id: r.question_id as string,
        answer: r.answer as QuestionAnswer,
        evidence: r.evidence as QuestionAnswer["evidence"],
      }));
    } else {
      // Fallback: check system_responses (legacy)
      const { data: legacyResponses } = await db
        .from("system_responses")
        .select("question_id, answer, evidence")
        .eq("run_id", runId);

      if (legacyResponses && legacyResponses.length > 0) {
        responses = legacyResponses.map((r) => ({
          question_id: r.question_id as string,
          answer: r.answer as QuestionAnswer,
          evidence: r.evidence as QuestionAnswer["evidence"],
        }));
      }
    }

    // Validate: all 25 questions must have responses
    const answeredIds = new Set(responses.map((r) => r.question_id));
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

    // Build answers map
    const answers: Record<string, QuestionAnswer> = {};
    for (const r of responses) {
      const answer: QuestionAnswer = r.answer;
      if (r.evidence) {
        answer.evidence = r.evidence;
      }
      answers[r.question_id] = answer;
    }

    // Compute scores
    const { dimensionScores, overall } = computeAllScores(answers);
    const riskFlags = computeRiskFlags(answers);
    const recommendations = generateRecommendations(answers);

    // -----------------------------------------------------------------------
    // Drift detection: compare with previous completed run
    // -----------------------------------------------------------------------
    const { data: previousRuns } = await db
      .from("trustsys_runs")
      .select("score, dimension_scores, version_number")
      .eq("assessment_id", run.assessment_id)
      .eq("status", "completed")
      .order("version_number", { ascending: false })
      .limit(1);

    const previousRun = previousRuns?.[0] ?? null;
    const previousScore = previousRun?.score as number | null;
    const previousDimScores = previousRun?.dimension_scores as Record<string, number> | null;

    const overallDrift = calculateDrift(overall, previousScore, DRIFT_THRESHOLD);
    const dimDrift = calculateDimensionDrift(dimensionScores, previousDimScores, DRIFT_THRESHOLD);
    const driftFromPrevious = previousScore !== null ? overall - previousScore : null;

    // -----------------------------------------------------------------------
    // Stability check: get all completed run scores for this assessment
    // -----------------------------------------------------------------------
    const { data: allCompletedRuns } = await db
      .from("trustsys_runs")
      .select("score")
      .eq("assessment_id", run.assessment_id)
      .eq("status", "completed")
      .order("version_number", { ascending: true });

    // Include current run score
    const allScores = [
      ...(allCompletedRuns || []).map((r) => r.score as number),
      overall,
    ];

    const stability = checkStability(allScores);

    // -----------------------------------------------------------------------
    // Insert drift event if drift detected
    // -----------------------------------------------------------------------
    if (overallDrift.hasDrift) {
      await db.from("drift_events").insert({
        run_id: runId,
        run_type: "sys" as const,
        delta_score: overallDrift.delta ?? 0,
        dimension_id: null,
        drift_flag: true,
      });
    }

    // Insert dimension-level drift events
    // Look up dimension UUIDs by name for the sys run type
    const dimNames = Object.entries(dimDrift)
      .filter(([, drift]) => drift.hasDrift)
      .map(([dim]) => dim);

    let dimLookup: Record<string, string> = {};
    if (dimNames.length > 0) {
      const { data: dimRows } = await db
        .from("dimensions")
        .select("id, name")
        .eq("type", "sys")
        .in("name", dimNames);
      if (dimRows) {
        dimLookup = Object.fromEntries(
          dimRows.map((d) => [d.name as string, d.id as string])
        );
      }
    }

    for (const [dim, drift] of Object.entries(dimDrift)) {
      if (drift.hasDrift) {
        await db.from("drift_events").insert({
          run_id: runId,
          run_type: "sys" as const,
          delta_score: drift.delta ?? 0,
          dimension_id: dimLookup[dim] ?? null,
          drift_flag: true,
        });
      }
    }

    // -----------------------------------------------------------------------
    // Update the run
    // -----------------------------------------------------------------------
    const now = new Date().toISOString();

    const { data: updatedRun, error: updateErr } = await db
      .from("trustsys_runs")
      .update({
        status: "completed",
        stability_status: stability.isStable ? "stable" : "provisional",
        score: overall,
        dimension_scores: dimensionScores,
        risk_flags: riskFlags,
        drift_from_previous: driftFromPrevious,
        drift_flag: overallDrift.hasDrift,
        variance_last_3: stability.variance,
        completed_at: now,
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

    // Save recommendations to system_recommendations (legacy table still used)
    if (recommendations.length > 0) {
      const recRows = recommendations.map((r) => ({
        run_id: runId,
        question_id: r.questionId,
        dimension: r.dimension,
        control: r.control,
        priority: r.priority,
        recommendation: r.recommendation,
      }));

      await db.from("system_recommendations").insert(recRows);
    }

    return NextResponse.json({
      run: updatedRun,
      drift: overallDrift,
      stability,
      recommendations,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
