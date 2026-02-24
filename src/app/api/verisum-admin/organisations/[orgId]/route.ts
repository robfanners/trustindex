import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/vcc/adminAuth";
import { supabaseServer } from "@/lib/supabaseServer";
import { auditLog } from "@/lib/vcc/audit";

// ---------------------------------------------------------------------------
// GET /api/verisum-admin/organisations/[orgId] — Org detail
// ---------------------------------------------------------------------------

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const auth = await requireAdmin("view_org_details");
    if ("error" in auth) return auth.error;

    const { orgId } = await params;
    const db = supabaseServer();

    // Fetch profile
    const { data: profile, error: profErr } = await db
      .from("profiles")
      .select(
        "id, email, plan, stripe_customer_id, stripe_subscription_id, created_at, suspended_at, suspended_reason"
      )
      .eq("id", orgId)
      .single();

    if (profErr || !profile) {
      return NextResponse.json(
        { error: "Organisation not found" },
        { status: 404 }
      );
    }

    // Fetch surveys, systems, and overrides in parallel
    const [surveysRes, systemsRes, overridesRes] = await Promise.all([
      db
        .from("survey_runs")
        .select("id, title, mode, created_at")
        .eq("owner_user_id", orgId)
        .order("created_at", { ascending: false })
        .limit(50),
      db
        .from("systems")
        .select("id, name, version_label, type, environment, created_at")
        .eq("owner_id", orgId)
        .eq("archived", false)
        .order("created_at", { ascending: false }),
      db
        .from("org_overrides")
        .select(
          "id, override_type, override_value, reason, expires_at, created_at, revoked_at"
        )
        .eq("user_id", orgId)
        .order("created_at", { ascending: false }),
    ]);

    // Enrich surveys with respondent counts from view
    const rawSurveys = surveysRes.data ?? [];
    let enrichedSurveys = rawSurveys.map((s) => ({
      ...s,
      respondent_count: 0,
    }));

    if (rawSurveys.length > 0) {
      const surveyIds = rawSurveys.map((s) => s.id as string);
      const { data: surveyCounts } = await db
        .from("v_run_response_counts")
        .select("run_id, respondents")
        .in("run_id", surveyIds);

      const surveyCountMap = new Map(
        (surveyCounts || []).map(
          (c: { run_id: string; respondents: number }) => [c.run_id, c.respondents]
        )
      );

      enrichedSurveys = rawSurveys.map((s) => ({
        ...s,
        respondent_count: surveyCountMap.get(s.id as string) ?? 0,
      }));
    }

    // For each system, get latest score + run count
    const systems = systemsRes.data ?? [];
    let enrichedSystems = systems.map((s) => ({
      ...s,
      latest_score: null as number | null,
      run_count: 0,
    }));

    if (systems.length > 0) {
      const sysIds = systems.map((s) => s.id as string);
      const { data: runs } = await db
        .from("system_runs")
        .select("system_id, status, overall_score, created_at")
        .in("system_id", sysIds)
        .order("created_at", { ascending: false });

      const scoreMap = new Map<string, number | null>();
      const countMap = new Map<string, number>();

      for (const r of runs ?? []) {
        const sid = r.system_id as string;
        countMap.set(sid, (countMap.get(sid) ?? 0) + 1);
        if (r.status === "submitted" && !scoreMap.has(sid)) {
          scoreMap.set(sid, r.overall_score as number | null);
        }
      }

      enrichedSystems = systems.map((s) => ({
        ...s,
        latest_score: scoreMap.get(s.id as string) ?? null,
        run_count: countMap.get(s.id as string) ?? 0,
      }));
    }

    return NextResponse.json({
      data: {
        id: profile.id,
        email: profile.email,
        plan: profile.plan,
        stripe_customer_id: profile.stripe_customer_id,
        stripe_subscription_id: profile.stripe_subscription_id,
        created_at: profile.created_at,
        suspended_at: profile.suspended_at,
        suspended_reason: profile.suspended_reason,
        surveys: enrichedSurveys,
        systems: enrichedSystems,
        overrides: overridesRes.data ?? [],
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/verisum-admin/organisations/[orgId] — Suspend / Reinstate
// ---------------------------------------------------------------------------

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const auth = await requireAdmin("suspend_reinstate");
    if ("error" in auth) return auth.error;

    const { orgId } = await params;
    const body = await request.json();
    const action = body.action as string;
    const reason = String(body.reason ?? "").trim();

    if (!["suspend", "reinstate"].includes(action)) {
      return NextResponse.json(
        { error: "action must be 'suspend' or 'reinstate'" },
        { status: 400 }
      );
    }

    if (!reason) {
      return NextResponse.json(
        { error: "reason is required" },
        { status: 400 }
      );
    }

    const db = supabaseServer();

    // Fetch current state for before-snapshot
    const { data: before, error: fetchErr } = await db
      .from("profiles")
      .select("id, email, plan, suspended_at, suspended_reason")
      .eq("id", orgId)
      .single();

    if (fetchErr || !before) {
      return NextResponse.json(
        { error: "Organisation not found" },
        { status: 404 }
      );
    }

    // Apply update
    const updateData =
      action === "suspend"
        ? { suspended_at: new Date().toISOString(), suspended_reason: reason }
        : { suspended_at: null, suspended_reason: null };

    const { data: after, error: updateErr } = await db
      .from("profiles")
      .update(updateData)
      .eq("id", orgId)
      .select("id, email, plan, suspended_at, suspended_reason")
      .single();

    if (updateErr || !after) {
      return NextResponse.json(
        { error: updateErr?.message ?? "Failed to update" },
        { status: 500 }
      );
    }

    // Write audit log
    await auditLog({
      adminUserId: auth.user.id,
      adminEmail: auth.user.email,
      adminRoles: auth.roles,
      action: action === "suspend" ? "org.suspend" : "org.reinstate",
      targetType: "organisation",
      targetId: orgId,
      reason,
      beforeSnapshot: before as unknown as Record<string, unknown>,
      afterSnapshot: after as unknown as Record<string, unknown>,
    });

    return NextResponse.json({ data: after });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
