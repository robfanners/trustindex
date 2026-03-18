import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { createSupabaseServerClient } from "@/lib/supabase-auth-server";

// ---------------------------------------------------------------------------
// GET /api/dashboard/control-centre
// ---------------------------------------------------------------------------
// Single aggregation endpoint that parallel-fetches all data the Verisum
// Control Centre dashboard needs. Uses Promise.allSettled so individual
// query failures don't crash the whole response.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function safeData<T>(result: PromiseSettledResult<any>): T | null {
  if (result.status === "rejected") return null;
  if (result.value?.error) return null;
  return (result.value?.data as T) ?? null;
}

export async function GET() {
  try {
    const authClient = await createSupabaseServerClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 },
      );
    }

    const db = supabaseServer();
    const { data: profile } = await db
      .from("profiles")
      .select("organisation_id, plan, full_name")
      .eq("id", user.id)
      .single();

    if (!profile?.organisation_id) {
      return NextResponse.json(
        { error: "No organisation linked" },
        { status: 400 },
      );
    }

    const orgId = profile.organisation_id;

    // ---- Parallel fetch all data sources ----
    const [
      healthResult,
      escalationsResult,
      incidentsResult,
      driftResult,
      regulatoryResult,
      activityResult,
      frameworksResult,
      actionsResult,
      attestationsResult,
      provenanceResult,
    ] = await Promise.allSettled([
      // 1. Health score
      db.rpc("tg_compute_health", { p_org: orgId }).single(),

      // 2. Escalations (unresolved, top 6)
      db
        .from("escalations")
        .select(
          "id, reason, severity, status, trigger_type, assigned_to, created_at",
        )
        .eq("organisation_id", orgId)
        .eq("resolved", false)
        .order("created_at", { ascending: false })
        .limit(6),

      // 3. Incidents (not closed, top 6)
      db
        .from("incidents")
        .select("id, title, status, impact_level, system_id, created_at")
        .eq("organisation_id", orgId)
        .neq("status", "closed")
        .order("created_at", { ascending: false })
        .limit(6),

      // 4. Drift events (flagged, top 10)
      // drift_events has no organisation_id — filter via RPC or fetch all flagged
      // (small table, acceptable for now)
      db
        .from("drift_events")
        .select("id, run_type, delta_score, drift_flag, created_at")
        .eq("drift_flag", true)
        .order("created_at", { ascending: false })
        .limit(10),

      // 5. Regulatory feed (latest 4, global — no org filter)
      db
        .from("regulatory_updates")
        .select("id, title, summary, jurisdictions, published_at")
        .order("published_at", { ascending: false })
        .limit(4),

      // 6. Activity (latest 6 audit entries)
      db
        .from("audit_logs")
        .select(
          "id, entity_type, action_type, performed_by, metadata, created_at",
        )
        .eq("organisation_id", orgId)
        .order("created_at", { ascending: false })
        .limit(6),

      // 7. Compliance frameworks
      db
        .from("compliance_frameworks")
        .select("*")
        .eq("organisation_id", orgId)
        .order("name", { ascending: true }),

      // 8. Actions (open)
      db
        .from("actions")
        .select("id, status, severity, due_date")
        .eq("organisation_id", orgId)
        .eq("status", "open"),

      // 9. Attestations (valid)
      db
        .from("prove_attestations")
        .select("id, is_valid, chain_status")
        .eq("organisation_id", orgId)
        .eq("is_valid", true),

      // 10. Provenance
      db
        .from("prove_provenance")
        .select("id, chain_status")
        .eq("organisation_id", orgId),
    ]);

    // ---- Extract results safely ----
    const health = safeData<{
      health_score: number;
      base_health: number;
      org_base: number;
      sys_base: number;
      p_rel: number;
      p_act: number;
      p_drift: number;
      p_exp: number;
      open_actions: number;
      overdue_actions: number;
      critical_overdue_actions: number;
      computed_at: string;
    }>(healthResult);

    const escalations = safeData<
      {
        id: string;
        reason: string;
        severity: string;
        status: string;
        trigger_type: string;
        assigned_to: string | null;
        created_at: string;
      }[]
    >(escalationsResult) ?? [];

    const incidents = safeData<
      {
        id: string;
        title: string;
        status: string;
        impact_level: string;
        system_id: string | null;
        created_at: string;
      }[]
    >(incidentsResult) ?? [];

    const driftEvents = safeData<
      {
        id: string;
        run_type: string;
        delta_score: number;
        drift_flag: boolean;
        created_at: string;
      }[]
    >(driftResult) ?? [];

    const regulatory = safeData<
      {
        id: string;
        title: string;
        summary: string;
        jurisdictions: string[];
        published_at: string;
      }[]
    >(regulatoryResult) ?? [];

    const activity = safeData<
      {
        id: string;
        entity_type: string;
        action_type: string;
        performed_by: string;
        metadata: Record<string, unknown>;
        created_at: string;
      }[]
    >(activityResult) ?? [];

    const frameworks = safeData<Record<string, unknown>[]>(
      frameworksResult,
    ) ?? [];

    const openActions = safeData<
      {
        id: string;
        status: string;
        severity: string;
        due_date: string | null;
      }[]
    >(actionsResult) ?? [];

    const attestations = safeData<
      { id: string; is_valid: boolean; chain_status: string }[]
    >(attestationsResult) ?? [];

    const provenance = safeData<{ id: string; chain_status: string }[]>(
      provenanceResult,
    ) ?? [];

    // ---- Compute derived values ----
    const now = new Date();
    const overdueActions = openActions.filter(
      (a) => a.due_date && new Date(a.due_date) < now,
    );

    // ---- Build response ----
    return NextResponse.json({
      plan: profile.plan ?? "explorer",
      govern: {
        health_score: health?.health_score ?? null,
        org_base: health?.org_base ?? null,
        sys_base: health?.sys_base ?? null,
        open_actions: openActions.length,
        overdue_actions: overdueActions.length,
      },
      monitor: {
        escalations,
        escalation_count: escalations.length,
        incidents,
        incident_count: incidents.length,
        drift_events: driftEvents,
        drift_count: driftEvents.length,
      },
      prove: {
        attestation_count: attestations.length,
        provenance_count: provenance.length,
      },
      frameworks,
      regulatory,
      activity,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    );
  }
}
