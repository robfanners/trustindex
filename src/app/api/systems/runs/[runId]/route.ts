import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-auth-server";
import { supabaseServer } from "@/lib/supabaseServer";

type RouteContext = { params: Promise<{ runId: string }> };

// ---------------------------------------------------------------------------
// Helper: authenticate + verify run ownership via system → run chain
// ---------------------------------------------------------------------------

async function authenticateAndAuthoriseRun(runId: string) {
  const authClient = await createSupabaseServerClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    return {
      error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }),
    };
  }

  const db = supabaseServer();

  // Fetch run with its system_id
  const { data: run, error: runErr } = await db
    .from("system_runs")
    .select("*")
    .eq("id", runId)
    .single();

  if (runErr || !run) {
    return {
      error: NextResponse.json({ error: "Run not found" }, { status: 404 }),
    };
  }

  // Verify ownership via system
  const { data: system, error: sysErr } = await db
    .from("systems")
    .select("id, owner_id")
    .eq("id", run.system_id)
    .single();

  if (sysErr || !system || system.owner_id !== user.id) {
    return {
      error: NextResponse.json({ error: "Not authorised" }, { status: 403 }),
    };
  }

  return { user, run, system };
}

// ---------------------------------------------------------------------------
// GET /api/systems/runs/[runId] — full run detail + responses + recommendations
// ---------------------------------------------------------------------------

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { runId } = await context.params;
    const result = await authenticateAndAuthoriseRun(runId);
    if ("error" in result) return result.error;

    const { run } = result;
    const db = supabaseServer();

    // Fetch responses
    const { data: responses, error: respErr } = await db
      .from("system_responses")
      .select("id, question_id, answer, evidence, created_at")
      .eq("run_id", runId)
      .order("created_at", { ascending: true });

    if (respErr) {
      return NextResponse.json({ error: respErr.message }, { status: 500 });
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
        return NextResponse.json({ error: recErr.message }, { status: 500 });
      }
      recommendations = recs || [];
    }

    return NextResponse.json({
      run,
      responses: responses || [],
      recommendations,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
