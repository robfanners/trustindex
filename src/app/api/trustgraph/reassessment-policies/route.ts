import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-auth-server";
import { supabaseServer } from "@/lib/supabaseServer";

// ---------------------------------------------------------------------------
// Helper: authenticate + get org_id
// ---------------------------------------------------------------------------

async function getAuthenticatedOrg() {
  const authClient = await createSupabaseServerClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  }

  const db = supabaseServer();
  const { data: profile } = await db
    .from("profiles")
    .select("organisation_id")
    .eq("id", user.id)
    .single();

  if (!profile?.organisation_id) {
    return { error: NextResponse.json({ error: "No organisation linked" }, { status: 400 }) };
  }

  return { user, orgId: profile.organisation_id };
}

// ---------------------------------------------------------------------------
// GET /api/trustgraph/reassessment-policies — list policies for the org
// ---------------------------------------------------------------------------
// Query params: run_type (org|sys)

export async function GET(req: NextRequest) {
  try {
    const result = await getAuthenticatedOrg();
    if ("error" in result) return result.error;

    const { orgId } = result;
    const db = supabaseServer();
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
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
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

    return NextResponse.json({ policies: enriched });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/trustgraph/reassessment-policies — create or update a policy
// ---------------------------------------------------------------------------
// Body: { target_id, run_type, frequency_days }

export async function POST(req: NextRequest) {
  try {
    const result = await getAuthenticatedOrg();
    if ("error" in result) return result.error;

    const { orgId } = result;
    const db = supabaseServer();
    const body = await req.json();

    const targetId = body.target_id;
    const runType = body.run_type;
    const frequencyDays = Number(body.frequency_days);

    if (!targetId || !runType || !frequencyDays || frequencyDays < 1) {
      return NextResponse.json(
        { error: "target_id, run_type, and frequency_days (>0) are required" },
        { status: 400 }
      );
    }

    if (!["org", "sys"].includes(runType)) {
      return NextResponse.json({ error: "run_type must be 'org' or 'sys'" }, { status: 400 });
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
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }
      return NextResponse.json({ policy: updated, action: "updated" });
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
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({ policy, action: "created" }, { status: 201 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
