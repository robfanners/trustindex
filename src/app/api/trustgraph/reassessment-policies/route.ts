import { NextRequest } from "next/server";
import { requireAuth, apiError, apiOk, withErrorHandling } from "@/lib/apiHelpers";

// ---------------------------------------------------------------------------
// GET /api/trustgraph/reassessment-policies — list policies for the org
// ---------------------------------------------------------------------------
// Query params: run_type (org|sys)

export async function GET(req: NextRequest) {
  return withErrorHandling(async () => {
    const auth = await requireAuth({ withPlan: false });
    if (auth.error) return auth.error;

    const { orgId, db } = auth;
    const url = req.nextUrl;

    const runType = url.searchParams.get("run_type");

    let query = db
      .from("reassessment_policies")
      .select("*")
      .eq("organisation_id", orgId)
      .order("next_due", { ascending: true, nullsFirst: false });

    if (runType && ["org", "sys"].includes(runType)) {
      query = query.eq("run_type", runType);
    }

    const { data: policies, error: fetchErr } = await query;

    if (fetchErr) {
      return apiError(fetchErr.message, 500);
    }

    // Enrich with overdue flag
    const now = new Date();
    const enriched = (policies || []).map((p: {
      id: string;
      next_due: string | null;
      frequency_days: number;
      last_completed: string | null;
      [key: string]: unknown;
    }) => ({
      ...p,
      is_overdue: p.next_due ? new Date(p.next_due) < now : false,
      days_until_due: p.next_due
        ? Math.ceil((new Date(p.next_due).getTime() - now.getTime()) / 86400000)
        : null,
    }));

    return apiOk({ policies: enriched });
  });
}

// ---------------------------------------------------------------------------
// POST /api/trustgraph/reassessment-policies — create or update a policy
// ---------------------------------------------------------------------------
// Body: { target_id, run_type, frequency_days }

export async function POST(req: NextRequest) {
  return withErrorHandling(async () => {
    const auth = await requireAuth({ withPlan: false });
    if (auth.error) return auth.error;

    const { orgId, db } = auth;
    const body = await req.json();

    const targetId = body.target_id;
    const runType = body.run_type;
    const frequencyDays = Number(body.frequency_days);

    if (!targetId || !runType || !frequencyDays || frequencyDays < 1) {
      return apiError("target_id, run_type, and frequency_days (>0) are required", 400);
    }

    if (!["org", "sys"].includes(runType)) {
      return apiError("run_type must be 'org' or 'sys'", 400);
    }

    // Check if policy already exists
    const { data: existing } = await db
      .from("reassessment_policies")
      .select("id")
      .eq("target_id", targetId)
      .eq("run_type", runType)
      .maybeSingle();

    if (existing) {
      // Update existing
      const { data: updated, error: updateErr } = await db
        .from("reassessment_policies")
        .update({
          frequency_days: frequencyDays,
          next_due: body.last_completed
            ? new Date(new Date(body.last_completed).getTime() + frequencyDays * 86400000).toISOString()
            : undefined,
        })
        .eq("id", existing.id)
        .select("*")
        .single();

      if (updateErr) {
        return apiError(updateErr.message, 500);
      }
      return apiOk({ policy: updated, action: "updated" });
    }

    // Create new
    const lastCompleted = body.last_completed ? new Date(body.last_completed) : null;
    const nextDue = lastCompleted
      ? new Date(lastCompleted.getTime() + frequencyDays * 86400000)
      : null;

    const { data: policy, error: insertErr } = await db
      .from("reassessment_policies")
      .insert({
        organisation_id: orgId,
        run_type: runType,
        target_id: targetId,
        frequency_days: frequencyDays,
        last_completed: lastCompleted?.toISOString() ?? null,
        next_due: nextDue?.toISOString() ?? null,
      })
      .select("*")
      .single();

    if (insertErr) {
      return apiError(insertErr.message, 500);
    }

    return apiOk({ policy, action: "created" }, 201);
  });
}
