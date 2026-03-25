import { NextRequest } from "next/server";
import { requireAuth, apiError, apiOk } from "@/lib/apiHelpers";
import { SYSTEM_QUESTIONS } from "@/lib/systemQuestionBank";

type RouteContext = { params: Promise<{ runId: string }> };

// ---------------------------------------------------------------------------
// Helper: verify run ownership + run is still draft
// ---------------------------------------------------------------------------

async function verifyDraftRunOwnership(db: SupabaseClient, userId: string, runId: string) {
  const { data: run, error: runErr } = await db
    .from("system_runs")
    .select("id, system_id, status")
    .eq("id", runId)
    .single();

  if (runErr || !run) {
    return {
      error: apiError("Run not found", 404),
    };
  }

  if (run.status !== "draft") {
    return {
      error: apiError("Run has already been submitted", 409),
    };
  }

  // Verify ownership via system
  const { data: system, error: sysErr } = await db
    .from("systems")
    .select("id, owner_id")
    .eq("id", run.system_id)
    .single();

  if (sysErr || !system || system.owner_id !== userId) {
    return {
      error: apiError("Not authorised", 403),
    };
  }

  return { run };
}

// ---------------------------------------------------------------------------
// POST /api/systems/runs/[runId]/responses — upsert a single response
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest, context: RouteContext) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const { user, db } = auth;

  try {
    const { runId } = await context.params;
    const result = await verifyDraftRunOwnership(db, user.id, runId);
    if ("error" in result) return result.error;

    const body = await req.json();

    // Validate question_id
    const questionId = body.question_id;
    if (
      typeof questionId !== "string" ||
      !SYSTEM_QUESTIONS.some((q) => q.id === questionId)
    ) {
      return apiError("Invalid question_id", 400);
    }

    // Validate answer
    const answer = body.answer;
    if (!answer || typeof answer !== "object") {
      return apiError("answer is required and must be an object", 400);
    }

    // Evidence is optional
    const evidence = body.evidence ?? null;

    const { data: response, error: upsertErr } = await db
      .from("system_responses")
      .upsert(
        {
          run_id: runId,
          question_id: questionId,
          answer,
          evidence,
        },
        { onConflict: "run_id,question_id" }
      )
      .select("id, run_id, question_id, answer, evidence, created_at")
      .single();

    if (upsertErr || !response) {
      return apiError(upsertErr?.message || "Failed to save response", 500);
    }

    return apiOk({ response });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return apiError(message, 500);
  }
}
