import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-auth-server";
import { supabaseServer } from "@/lib/supabaseServer";

type RouteContext = { params: Promise<{ assessmentId: string }> };

// ---------------------------------------------------------------------------
// Helper: authenticate + verify org ownership
// ---------------------------------------------------------------------------

async function authenticateAndAuthorise(assessmentId: string) {
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

  const { data: profile } = await db
    .from("profiles")
    .select("organisation_id")
    .eq("id", user.id)
    .single();

  const { data: assessment, error: assessErr } = await db
    .from("trustsys_assessments")
    .select("*")
    .eq("id", assessmentId)
    .single();

  if (assessErr || !assessment) {
    return {
      error: NextResponse.json(
        { error: "Assessment not found" },
        { status: 404 }
      ),
    };
  }

  if (profile?.organisation_id && assessment.organisation_id !== profile.organisation_id) {
    return {
      error: NextResponse.json({ error: "Not authorised" }, { status: 403 }),
    };
  }

  return { user, assessment };
}

// ---------------------------------------------------------------------------
// GET /api/trustsys/assessments/[assessmentId] — detail + all runs
// ---------------------------------------------------------------------------

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { assessmentId } = await context.params;
    const result = await authenticateAndAuthorise(assessmentId);
    if ("error" in result) return result.error;

    const { assessment } = result;
    const db = supabaseServer();

    const { data: runs, error: runsErr } = await db
      .from("trustsys_runs")
      .select(
        "id, version_number, status, stability_status, score, dimension_scores, risk_flags, drift_from_previous, drift_flag, variance_last_3, created_by, created_at, completed_at"
      )
      .eq("assessment_id", assessmentId)
      .order("version_number", { ascending: false });

    if (runsErr) {
      return NextResponse.json({ error: runsErr.message }, { status: 500 });
    }

    // Map DB column names to frontend-expected property names
    const mappedRuns = (runs || []).map((r) => ({
      id: r.id,
      version_number: r.version_number,
      status: r.status,
      stability_status: r.stability_status,
      overall_score: r.score,
      dimension_scores: r.dimension_scores,
      risk_flags: r.risk_flags,
      confidence_factor: null,
      drift_from_previous: r.drift_from_previous,
      drift_flag: r.drift_flag,
      variance_last_3: r.variance_last_3,
      assessor_id: r.created_by,
      created_at: r.created_at,
      completed_at: r.completed_at,
    }));

    return NextResponse.json({
      assessment: {
        id: assessment.id,
        name: assessment.system_name,
        version_label: assessment.version_label,
        type: assessment.system_type,
        environment: assessment.environment,
        autonomy_level: assessment.autonomy_level,
        criticality_level: assessment.criticality_level,
        reassessment_frequency_days: assessment.reassessment_frequency_days,
        created_at: assessment.created_at,
      },
      runs: mappedRuns,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
