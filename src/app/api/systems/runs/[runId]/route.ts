import { NextRequest } from "next/server";
import { requireAuth, apiError, apiOk } from "@/lib/apiHelpers";

type RouteContext = { params: Promise<{ runId: string }> };

// ---------------------------------------------------------------------------
// Helper: verify run ownership via system → run chain
// ---------------------------------------------------------------------------

async function verifyRunOwnership(db: SupabaseClient, userId: string, runId: string) {
  // Fetch run with its system_id
  const { data: run, error: runErr } = await db
    .from("system_runs")
    .select("*")
    .eq("id", runId)
    .single();

  if (runErr || !run) {
    return {
      error: apiError("Run not found", 404),
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

  return { run, system };
}

// ---------------------------------------------------------------------------
// GET /api/systems/runs/[runId] — full run detail + responses + recommendations
// ---------------------------------------------------------------------------

export async function GET(_req: NextRequest, context: RouteContext) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const { user, db } = auth;

  try {
    const { runId } = await context.params;
    const result = await verifyRunOwnership(db, user.id, runId);
    if ("error" in result) return result.error;

    const { run } = result;

    // Fetch responses
    const { data: responses, error: respErr } = await db
      .from("system_responses")
      .select("id, question_id, answer, evidence, created_at")
      .eq("run_id", runId)
      .order("created_at", { ascending: true });

    if (respErr) {
      return apiError(respErr.message, 500);
    }

    // Fetch recommendations (only if submitted)
    let recommendations: unknown[] = [];
    if (run.status === "submitted") {
      const { data: recs, error: recErr } = await db
        .from("system_recommendations")
        .select(
          "id, question_id, dimension, control, priority, recommendation, created_at"
        )
        .eq("run_id", runId)
        .order("priority", { ascending: true });

      if (recErr) {
        return apiError(recErr.message, 500);
      }
      recommendations = recs || [];
    }

    return apiOk({
      run,
      responses: responses || [],
      recommendations,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return apiError(message, 500);
  }
}
