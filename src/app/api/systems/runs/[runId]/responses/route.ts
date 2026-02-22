import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-auth-server";
import { supabaseServer } from "@/lib/supabaseServer";
import { SYSTEM_QUESTIONS } from "@/lib/systemQuestionBank";

type RouteContext = { params: Promise<{ runId: string }> };

// ---------------------------------------------------------------------------
// Helper: authenticate + verify run ownership + run is still draft
// ---------------------------------------------------------------------------

async function authenticateAndAuthoriseDraftRun(runId: string) {
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

  const { data: run, error: runErr } = await db
    .from("system_runs")
    .select("id, system_id, status")
    .eq("id", runId)
    .single();

  if (runErr || !run) {
    return {
      error: NextResponse.json({ error: "Run not found" }, { status: 404 }),
    };
  }

  if (run.status !== "draft") {
    return {
      error: NextResponse.json(
        { error: "Run has already been submitted" },
        { status: 409 }
      ),
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

  return { user, run };
}

// ---------------------------------------------------------------------------
// POST /api/systems/runs/[runId]/responses — upsert a single response
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { runId } = await context.params;
    const result = await authenticateAndAuthoriseDraftRun(runId);
    if ("error" in result) return result.error;

    const body = await req.json();

    // Validate question_id
    const questionId = body.question_id;
    if (
      typeof questionId !== "string" ||
      !SYSTEM_QUESTIONS.some((q) => q.id === questionId)
    ) {
      return NextResponse.json(
        { error: "Invalid question_id" },
        { status: 400 }
      );
    }

    // Validate answer
    const answer = body.answer;
    if (!answer || typeof answer !== "object") {
      return NextResponse.json(
        { error: "answer is required and must be an object" },
        { status: 400 }
      );
    }

    // Evidence is optional
    const evidence = body.evidence ?? null;

    const db = supabaseServer();

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
      return NextResponse.json(
        { error: upsertErr?.message || "Failed to save response" },
        { status: 500 }
      );
    }

    return NextResponse.json({ response });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
