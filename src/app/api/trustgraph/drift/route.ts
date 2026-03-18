import { NextRequest } from "next/server";
import { requireAuth, apiError, apiOk, withErrorHandling } from "@/lib/apiHelpers";
import { requireTier } from "@/lib/requireTier";

// ---------------------------------------------------------------------------
// GET /api/trustgraph/drift — list drift events for the user's org
// ---------------------------------------------------------------------------
// Query params: run_type (org|sys), days (lookback window, default 90),
//               page, per_page

export async function GET(req: NextRequest) {
  return withErrorHandling(async () => {
    const check = await requireTier("Assure");
    if (!check.authorized) return check.response;

    if (!check.orgId) {
      return apiError("No organisation linked", 400);
    }

    const auth = await requireAuth({ withPlan: false });
    if (auth.error) return auth.error;

    const orgId = check.orgId;
    const db = auth.db;
    const url = req.nextUrl;

    const runType = url.searchParams.get("run_type"); // 'org' | 'sys' | null
    const days = Math.min(365, Math.max(1, Number(url.searchParams.get("days")) || 90));
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
    const perPage = Math.min(100, Math.max(1, Number(url.searchParams.get("per_page")) || 50));

    // Build the query — drift_events don't have org_id directly,
    // so we join through runs to filter by org
    const cutoff = new Date(Date.now() - days * 86400000).toISOString();

    // Use raw SQL for the join query via RPC or direct query
    // Simpler approach: query drift_events and filter by run IDs belonging to org
    let sysRunIds: string[] = [];
    let orgRunIds: string[] = [];

    if (!runType || runType === "sys") {
      const { data: assessments } = await db
        .from("trustsys_assessments")
        .select("id")
        .eq("organisation_id", orgId);
      const assessmentIds = (assessments || []).map((a: { id: string }) => a.id);

      if (assessmentIds.length > 0) {
        const { data: sysRuns } = await db
          .from("trustsys_runs")
          .select("id")
          .in("assessment_id", assessmentIds);
        sysRunIds = (sysRuns || []).map((r: { id: string }) => r.id);
      }
    }

    if (!runType || runType === "org") {
      const { data: surveys } = await db
        .from("trustorg_surveys")
        .select("id")
        .eq("organisation_id", orgId);
      const surveyIds = (surveys || []).map((s: { id: string }) => s.id);

      if (surveyIds.length > 0) {
        const { data: orgRuns } = await db
          .from("trustorg_runs")
          .select("id")
          .in("survey_id", surveyIds);
        orgRunIds = (orgRuns || []).map((r: { id: string }) => r.id);
      }
    }

    const allRunIds = [...sysRunIds, ...orgRunIds];

    // --- Fetch reassessment policies (always available if assessments exist) ---
    const { data: policies } = await db
      .from("reassessment_policies")
      .select("*")
      .eq("organisation_id", orgId)
      .order("next_due", { ascending: true, nullsFirst: false });

    const now = new Date();
    const reassessmentStatus = (policies || []).map((p: {
      id: string;
      target_id: string;
      target_name?: string;
      run_type: string;
      frequency_days: number;
      last_completed: string | null;
      next_due: string | null;
      [key: string]: unknown;
    }) => {
      const nextDue = p.next_due ? new Date(p.next_due) : null;
      const daysUntilDue = nextDue
        ? Math.ceil((nextDue.getTime() - now.getTime()) / 86400000)
        : null;
      let status: "on_track" | "due_soon" | "overdue" | "no_schedule" = "no_schedule";
      if (daysUntilDue !== null) {
        if (daysUntilDue < 0) status = "overdue";
        else if (daysUntilDue <= 14) status = "due_soon";
        else status = "on_track";
      }
      return {
        target_id: p.target_id,
        target_name: p.target_name ?? p.target_id,
        run_type: p.run_type,
        frequency_days: p.frequency_days,
        last_completed: p.last_completed,
        next_due: p.next_due,
        days_until_due: daysUntilDue,
        status,
      };
    });

    // --- Fetch health data for drift summary ---
    const { data: healthRows } = await db
      .from("trustgraph_health_mv")
      .select("p_drift")
      .eq("organisation_id", orgId)
      .limit(1);
    const pDrift = healthRows?.[0] ? Number((healthRows[0] as { p_drift: number }).p_drift) || 0 : 0;

    const staleCount = reassessmentStatus.filter(
      (r: { status: string }) => r.status === "overdue"
    ).length;

    const driftSummary = {
      p_drift: pDrift,
      total_policies: reassessmentStatus.length,
      stale_count: staleCount,
      total_assessments: allRunIds.length,
    };

    // --- Fetch drift events (may be empty if < 2 runs) ---
    let driftEvents: unknown[] = [];
    let driftTotal = 0;

    if (allRunIds.length > 0) {
      let query = db
        .from("drift_events")
        .select("*", { count: "exact" })
        .in("run_id", allRunIds)
        .gte("created_at", cutoff)
        .order("created_at", { ascending: false })
        .range((page - 1) * perPage, page * perPage - 1);

      if (runType) {
        query = query.eq("run_type", runType);
      }

      const { data: events, error: fetchErr, count: evCount } = await query;

      if (fetchErr) {
        return apiError(fetchErr.message, 500);
      }

      driftEvents = events || [];
      driftTotal = evCount ?? 0;
    }

    return apiOk({
      drift_events: driftEvents,
      total: driftTotal,
      page,
      per_page: perPage,
      reassessment_status: reassessmentStatus,
      drift_summary: driftSummary,
    });
  });
}
