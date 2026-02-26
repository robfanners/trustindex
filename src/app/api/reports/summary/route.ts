import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedOrgWithRole } from "@/lib/reportAuth.server";
import { supabaseServer } from "@/lib/supabaseServer";

// ---------------------------------------------------------------------------
// GET /api/reports/summary — aggregated board summary for date range
// ---------------------------------------------------------------------------
// Query params: from (ISO date), to (ISO date)

export async function GET(req: NextRequest) {
  try {
    const result = await getAuthenticatedOrgWithRole();
    if ("error" in result) return result.error;

    const { orgId } = result;
    const db = supabaseServer();
    const url = req.nextUrl;

    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    if (!from || !to) {
      return NextResponse.json(
        { error: "from and to date params are required" },
        { status: 400 }
      );
    }

    // 1) Health scores — try MV first, fallback to RPC
    let health: Record<string, unknown> | null = null;

    const { data: mvRow } = await db
      .from("trustgraph_health_mv")
      .select("*")
      .eq("organisation_id", orgId)
      .maybeSingle();

    if (mvRow) {
      health = mvRow;
    } else {
      const { data: rpcRow } = await db.rpc("tg_compute_health", {
        p_org_id: orgId,
      });
      if (rpcRow) {
        const row = Array.isArray(rpcRow) ? rpcRow[0] : rpcRow;
        health = row ?? null;
      }
    }

    // 2) Action counts within date range
    const { data: actions } = await db
      .from("actions")
      .select("id, status, severity, due_date")
      .eq("organisation_id", orgId)
      .gte("created_at", from)
      .lte("created_at", to);

    const actionList = actions || [];
    const now = new Date();
    const actionStats = {
      total: actionList.length,
      open: actionList.filter((a: { status: string }) => a.status === "open").length,
      in_progress: actionList.filter((a: { status: string }) => a.status === "in_progress").length,
      done: actionList.filter((a: { status: string }) => a.status === "done").length,
      blocked: actionList.filter((a: { status: string }) => a.status === "blocked").length,
      critical_open: actionList.filter(
        (a: { severity: string; status: string }) =>
          a.severity === "critical" && a.status !== "done"
      ).length,
      overdue: actionList.filter(
        (a: { due_date: string | null; status: string }) =>
          a.due_date && new Date(a.due_date) < now && a.status !== "done"
      ).length,
    };

    // 3) Escalation counts within date range
    const { data: escalations } = await db
      .from("escalations")
      .select("id, severity, resolved")
      .eq("organisation_id", orgId)
      .gte("created_at", from)
      .lte("created_at", to);

    const escList = escalations || [];
    const bySeverity: Record<string, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };
    for (const e of escList) {
      const sev = (e as { severity: string }).severity;
      if (sev in bySeverity) bySeverity[sev]++;
    }

    const escalationStats = {
      total: escList.length,
      unresolved: escList.filter((e: { resolved: boolean }) => !e.resolved).length,
      by_severity: bySeverity,
    };

    // 4) Drift events within date range — need run IDs for org
    const { data: sysAssessments } = await db
      .from("trustsys_assessments")
      .select("id")
      .eq("organisation_id", orgId);
    const assessmentIds = (sysAssessments || []).map((a: { id: string }) => a.id);

    const { data: orgSurveys } = await db
      .from("trustorg_surveys")
      .select("id")
      .eq("organisation_id", orgId);
    const surveyIds = (orgSurveys || []).map((s: { id: string }) => s.id);

    let allRunIds: string[] = [];

    if (assessmentIds.length > 0) {
      const { data: sysRuns } = await db
        .from("trustsys_runs")
        .select("id")
        .in("assessment_id", assessmentIds);
      allRunIds = (sysRuns || []).map((r: { id: string }) => r.id);
    }

    if (surveyIds.length > 0) {
      const { data: orgRuns } = await db
        .from("trustorg_runs")
        .select("id")
        .in("survey_id", surveyIds);
      allRunIds = [
        ...allRunIds,
        ...(orgRuns || []).map((r: { id: string }) => r.id),
      ];
    }

    let driftStats = { events_in_period: 0, avg_delta: 0, max_delta: 0 };

    if (allRunIds.length > 0) {
      const { data: driftEvents } = await db
        .from("drift_events")
        .select("delta_score")
        .in("run_id", allRunIds)
        .gte("created_at", from)
        .lte("created_at", to);

      const drifts = driftEvents || [];
      if (drifts.length > 0) {
        const deltas = drifts.map(
          (d: { delta_score: number }) => d.delta_score
        );
        driftStats = {
          events_in_period: drifts.length,
          avg_delta:
            Math.round(
              (deltas.reduce((s: number, v: number) => s + v, 0) /
                deltas.length) *
                10
            ) / 10,
          max_delta: Math.min(...deltas),
        };
      }
    }

    return NextResponse.json({
      summary: {
        health_score: health
          ? (health as { health_score: number }).health_score
          : null,
        org_base: health ? (health as { org_base: number }).org_base : null,
        sys_base: health ? (health as { sys_base: number }).sys_base : null,
        base_health: health
          ? (health as { base_health: number }).base_health
          : null,
        penalties: health
          ? {
              p_rel: (health as { p_rel: number }).p_rel ?? 0,
              p_act: (health as { p_act: number }).p_act ?? 0,
              p_drift: (health as { p_drift: number }).p_drift ?? 0,
              p_exp: (health as { p_exp: number }).p_exp ?? 0,
            }
          : null,
        actions: actionStats,
        escalations: escalationStats,
        drift: driftStats,
        computed_at: new Date().toISOString(),
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
