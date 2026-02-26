import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedOrgWithRole } from "@/lib/reportAuth.server";
import { canAccessReport } from "@/lib/reportAuth";
import type { TrustGraphRole } from "@/lib/reportAuth";
import { supabaseServer } from "@/lib/supabaseServer";

// ---------------------------------------------------------------------------
// GET /api/reports/assessment-history — versioned run history for charts
// ---------------------------------------------------------------------------
// Query params: from, to (ISO date), run_type (org|sys), assessment_id, survey_id

export async function GET(req: NextRequest) {
  try {
    const result = await getAuthenticatedOrgWithRole();
    if ("error" in result) return result.error;

    const { orgId, role } = result;

    if (!canAccessReport(role as TrustGraphRole, "assessment_history")) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const db = supabaseServer();
    const url = req.nextUrl;

    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const runType = url.searchParams.get("run_type");
    const assessmentId = url.searchParams.get("assessment_id");
    const surveyId = url.searchParams.get("survey_id");

    if (!from || !to) {
      return NextResponse.json(
        { error: "from and to date params are required" },
        { status: 400 }
      );
    }

    type RunRow = {
      id: string;
      version_number: number;
      score: number | null;
      dimension_scores: Record<string, number> | null;
      stability_status: string | null;
      drift_from_previous: number | null;
      completed_at: string | null;
      [key: string]: unknown;
    };

    // --- Sys runs ---
    let sysRuns: (RunRow & { system_name: string; assessment_id: string })[] = [];

    if (!runType || runType === "sys") {
      // Get assessments for this org
      let assessmentQuery = db
        .from("trustsys_assessments")
        .select("id, system_name")
        .eq("organisation_id", orgId);

      if (assessmentId) {
        assessmentQuery = assessmentQuery.eq("id", assessmentId);
      }

      const { data: assessments } = await assessmentQuery;
      const assessmentMap = new Map(
        (assessments || []).map((a: { id: string; system_name: string }) => [
          a.id,
          a.system_name,
        ])
      );
      const ids = Array.from(assessmentMap.keys());

      if (ids.length > 0) {
        const { data: runs } = await db
          .from("trustsys_runs")
          .select(
            "id, assessment_id, version_number, score, dimension_scores, stability_status, drift_from_previous, completed_at"
          )
          .in("assessment_id", ids)
          .eq("status", "completed")
          .gte("completed_at", from)
          .lte("completed_at", to)
          .order("completed_at", { ascending: true });

        sysRuns = (runs || []).map((r: RunRow & { assessment_id: string }) => ({
          ...r,
          system_name: assessmentMap.get(r.assessment_id) ?? "Unknown",
        }));
      }
    }

    // --- Org runs ---
    let orgRuns: (RunRow & { survey_title: string; survey_id: string })[] = [];

    if (!runType || runType === "org") {
      let surveyQuery = db
        .from("trustorg_surveys")
        .select("id, title")
        .eq("organisation_id", orgId);

      if (surveyId) {
        surveyQuery = surveyQuery.eq("id", surveyId);
      }

      const { data: surveys } = await surveyQuery;
      const surveyMap = new Map(
        (surveys || []).map((s: { id: string; title: string }) => [
          s.id,
          s.title,
        ])
      );
      const ids = Array.from(surveyMap.keys());

      if (ids.length > 0) {
        const { data: runs } = await db
          .from("trustorg_runs")
          .select(
            "id, survey_id, version_number, score, dimension_scores, stability_status, drift_from_previous, completed_at"
          )
          .in("survey_id", ids)
          .eq("status", "completed")
          .gte("completed_at", from)
          .lte("completed_at", to)
          .order("completed_at", { ascending: true });

        orgRuns = (runs || []).map((r: RunRow & { survey_id: string }) => ({
          ...r,
          survey_title: surveyMap.get(r.survey_id) ?? "Unknown",
        }));
      }
    }

    // --- Dimensions reference ---
    const { data: dimensions } = await db
      .from("dimensions")
      .select("id, name, type, weight")
      .order("display_order", { ascending: true });

    return NextResponse.json({
      history: {
        org_runs: orgRuns,
        sys_runs: sysRuns,
        dimensions: dimensions || [],
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
