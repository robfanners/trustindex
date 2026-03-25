import { requireAuth, apiError, apiOk } from "@/lib/apiHelpers";

// ---------------------------------------------------------------------------
// POST /api/trustgraph/check-expiry — trigger expiry check + escalation
// ---------------------------------------------------------------------------
// Calls tg_check_and_expire() and tg_escalate_overdue_actions() server-side.
// Designed to be called from cron or manually from dashboard.
// Also refreshes the health materialized view after changes.

export async function POST() {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const { db } = auth;

  try {
    // 1) Check and expire overdue assessments
    const { data: expiryResult, error: expiryErr } = await db.rpc("tg_check_and_expire");

    let expiredCount = 0;
    let expiryEscalations = 0;

    if (!expiryErr && expiryResult) {
      const row = Array.isArray(expiryResult) ? expiryResult[0] : expiryResult;
      expiredCount = row?.expired_count ?? 0;
      expiryEscalations = row?.escalation_count ?? 0;
    }

    // 2) Escalate overdue critical actions
    const { data: actionResult, error: actionErr } = await db.rpc(
      "tg_escalate_overdue_actions"
    );

    let actionEscalations = 0;
    if (!actionErr && actionResult) {
      const row = Array.isArray(actionResult) ? actionResult[0] : actionResult;
      actionEscalations = row?.escalated_count ?? 0;
    }

    // 3) Refresh health MV if any changes were made
    if (expiredCount > 0 || actionEscalations > 0) {
      await db.rpc("tg_process_recalc_queue").then(
        () => {},
        () => {} // Non-fatal — MV refresh can be retried
      );
    }

    return apiOk({
      expired_count: expiredCount,
      expiry_escalations: expiryEscalations,
      action_escalations: actionEscalations,
      total_escalations: expiryEscalations + actionEscalations,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return apiError(message, 500);
  }
}
