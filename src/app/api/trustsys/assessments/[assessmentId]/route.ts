import { NextRequest } from "next/server";
import { requireAuth, apiError, apiOk } from "@/lib/apiHelpers";
import { supabaseServer } from "@/lib/supabase/admin";

type RouteContext = { params: Promise<{ assessmentId: string }> };

// ---------------------------------------------------------------------------
// Helper: verify ownership via systems table
// ---------------------------------------------------------------------------

async function verifyOwnership(assessmentId: string, orgId: string) {
  const db = supabaseServer();

  // Get the system (assessment) from the systems table
  const { data: system, error: sysErr } = await db
    .from("systems")
    .select("*")
    .eq("id", assessmentId)
    .single();

  if (sysErr || !system) {
    return {
      error: apiError("Assessment not found", 404),
    };
  }

  // Verify org ownership: system.owner_id must be in the same org
  const { data: ownerProfile } = await db
    .from("profiles")
    .select("organisation_id")
    .eq("id", system.owner_id)
    .single();

  if (ownerProfile?.organisation_id !== orgId) {
    return {
      error: apiError("Not authorised", 403),
    };
  }

  return { system };
}

// ---------------------------------------------------------------------------
// GET /api/trustsys/assessments/[assessmentId] — detail + all runs
// Uses existing `systems` + `system_runs` tables
// ---------------------------------------------------------------------------

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;
    const { orgId, db } = auth;

    const { assessmentId } = await context.params;
    const ownershipResult = await verifyOwnership(assessmentId, orgId);
    if ("error" in ownershipResult) return ownershipResult.error;

    const { system } = ownershipResult;

    const { data: runs, error: runsErr } = await db
      .from("system_runs")
      .select(
        "id, status, overall_score, dimension_scores, risk_flags, version_label, created_at, submitted_at"
      )
      .eq("system_id", assessmentId)
      .order("created_at", { ascending: false });

    if (runsErr) {
      return apiError(runsErr.message, 500);
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

    return apiOk({
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
    return apiError(message, 500);
  }
}
