import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-auth-server";
import { supabaseServer } from "@/lib/supabaseServer";

type RouteContext = { params: Promise<{ assessmentId: string }> };

// ---------------------------------------------------------------------------
// Helper: authenticate + verify ownership via systems table
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

  // Get the system (assessment) from the systems table
  const { data: system, error: sysErr } = await db
    .from("systems")
    .select("*")
    .eq("id", assessmentId)
    .single();

  if (sysErr || !system) {
    return {
      error: NextResponse.json(
        { error: "Assessment not found" },
        { status: 404 }
      ),
    };
  }

  // Verify org ownership: system.owner_id must be in the same org
  if (profile?.organisation_id) {
    const { data: ownerProfile } = await db
      .from("profiles")
      .select("organisation_id")
      .eq("id", system.owner_id)
      .single();

    if (ownerProfile?.organisation_id !== profile.organisation_id) {
      return {
        error: NextResponse.json({ error: "Not authorised" }, { status: 403 }),
      };
    }
  }

  return { user, system };
}

// ---------------------------------------------------------------------------
// GET /api/trustsys/assessments/[assessmentId] — detail + all runs
// Uses existing `systems` + `system_runs` tables
// ---------------------------------------------------------------------------

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { assessmentId } = await context.params;
    const result = await authenticateAndAuthorise(assessmentId);
    if ("error" in result) return result.error;

    const { system } = result;
    const db = supabaseServer();

    const { data: runs, error: runsErr } = await db
      .from("system_runs")
      .select(
        "id, status, overall_score, dimension_scores, risk_flags, version_label, created_at, submitted_at"
      )
      .eq("system_id", assessmentId)
      .order("created_at", { ascending: false });

    if (runsErr) {
      return NextResponse.json({ error: runsErr.message }, { status: 500 });
    }

    // Map DB columns to frontend-expected property names
    // Generate version_number from reverse order (latest = highest number)
    const total = (runs || []).length;
    const mappedRuns = (runs || []).map((r, i) => ({
      id: r.id,
      version_number: total - i, // Latest first, so first item gets highest number
      status: r.status === "submitted" ? "completed" : r.status === "draft" ? "in_progress" : r.status,
      stability_status: "provisional",
      overall_score: r.overall_score,
      dimension_scores: r.dimension_scores,
      risk_flags: r.risk_flags,
      confidence_factor: null,
      drift_from_previous: null,
      drift_flag: false,
      variance_last_3: null,
      assessor_id: null,
      created_at: r.created_at,
      completed_at: r.submitted_at,
    }));

    return NextResponse.json({
      assessment: {
        id: system.id,
        name: system.name,
        version_label: system.version_label,
        type: system.type,
        environment: system.environment,
        created_at: system.created_at,
        // Bridge to legacy assess flow — the assessment IS the system
        legacy_system_id: system.id,
      },
      runs: mappedRuns,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
