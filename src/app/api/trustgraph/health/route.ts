import { requireAuth, apiError, apiOk, withErrorHandling } from "@/lib/apiHelpers";

// ---------------------------------------------------------------------------
// GET /api/trustgraph/health — Verisum Health Score for the user's org
// ---------------------------------------------------------------------------
// Returns the composite health score + penalty drivers from the materialized
// view (fast) with a fallback to direct function call.

export async function GET() {
  return withErrorHandling(async () => {
    const auth = await requireAuth({ withPlan: false });
    if (auth.error) return auth.error;

    const { orgId, db } = auth;

    // Try materialized view first (fast)
    const { data: mvRow } = await db
      .from("trustgraph_health_mv")
      .select("*")
      .eq("organisation_id", orgId)
      .maybeSingle();

    if (mvRow) {
      return apiOk({
        health: {
          health_score: Number(mvRow.health_score) || 0,
          base_health: Number(mvRow.base_health) || 0,
          org_base: Number(mvRow.org_base) || 0,
          sys_base: Number(mvRow.sys_base) || 0,
          p_rel: Number(mvRow.p_rel) || 0,
          p_act: Number(mvRow.p_act) || 0,
          p_drift: Number(mvRow.p_drift) || 0,
          p_exp: Number(mvRow.p_exp) || 0,
          open_actions: Number(mvRow.open_actions) || 0,
          overdue_actions: Number(mvRow.overdue_actions) || 0,
          critical_overdue_actions: Number(mvRow.critical_overdue_actions) || 0,
          computed_at: mvRow.computed_at,
        },
        source: "materialized_view",
      });
    }

    // Fallback: call the function directly (slower but always current)
    const { data: fnResult, error: fnErr } = await db.rpc("tg_compute_health", {
      p_org_id: orgId,
    });

    if (fnErr) {
      // Function may not exist yet (migration not run) — return null gracefully
      return apiOk({
        health: null,
        message: "Health scoring not yet configured",
      });
    }

    const row = Array.isArray(fnResult) ? fnResult[0] : fnResult;

    if (!row) {
      return apiOk({
        health: null,
        message: "No data available for health calculation",
      });
    }

    return apiOk({
      health: {
        health_score: Number(row.health_score) || 0,
        base_health: Number(row.base_health) || 0,
        org_base: Number(row.org_base) || 0,
        sys_base: Number(row.sys_base) || 0,
        p_rel: Number(row.p_rel) || 0,
        p_act: Number(row.p_act) || 0,
        p_drift: Number(row.p_drift) || 0,
        p_exp: Number(row.p_exp) || 0,
        open_actions: Number(row.open_actions) || 0,
        overdue_actions: Number(row.overdue_actions) || 0,
        critical_overdue_actions: Number(row.critical_overdue_actions) || 0,
        computed_at: new Date().toISOString(),
      },
      source: "function_direct",
    });
  });
}

// ---------------------------------------------------------------------------
// POST /api/trustgraph/health — trigger a recalc (refresh materialized view)
// ---------------------------------------------------------------------------

export async function POST() {
  return withErrorHandling(async () => {
    const auth = await requireAuth({ withPlan: false });
    if (auth.error) return auth.error;

    const { db } = auth;

    // Trigger the queue processor (refreshes MV)
    const { error: rpcErr } = await db.rpc("tg_process_recalc_queue");

    if (rpcErr) {
      return apiOk({
        refreshed: false,
        message: "Recalc function not available yet",
      });
    }

    return apiOk({ refreshed: true });
  });
}
