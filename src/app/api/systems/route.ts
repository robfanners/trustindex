import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-auth-server";
import { supabaseServer } from "@/lib/supabaseServer";
import {
  getUserPlan,
  getUserSystemCount,
  canCreateSystem,
  getPlanLimits,
} from "@/lib/entitlements";

// ---------------------------------------------------------------------------
// GET /api/systems — list authenticated user's non-archived systems
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const authClient = await createSupabaseServerClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const db = supabaseServer();

    // Fetch non-archived systems owned by this user
    const { data: systems, error: sysErr } = await db
      .from("systems")
      .select("id, name, version_label, type, environment, created_at")
      .eq("owner_id", user.id)
      .eq("archived", false)
      .order("created_at", { ascending: false });

    if (sysErr) {
      return NextResponse.json({ error: sysErr.message }, { status: 500 });
    }

    if (!systems || systems.length === 0) {
      return NextResponse.json({ systems: [] });
    }

    // For each system, fetch runs (submitted + draft) for score/count/draft info
    const systemIds = systems.map((s) => s.id);

    const { data: runs } = await db
      .from("system_runs")
      .select("system_id, status, overall_score, created_at")
      .in("system_id", systemIds)
      .order("created_at", { ascending: false });

    // Build maps: latest submitted score per system, run count, has draft
    const latestScoreMap = new Map<string, number | null>();
    const runCountMap = new Map<string, number>();
    const hasDraftMap = new Map<string, boolean>();

    for (const r of runs || []) {
      const sid = r.system_id as string;
      runCountMap.set(sid, (runCountMap.get(sid) ?? 0) + 1);
      if (r.status === "draft") {
        hasDraftMap.set(sid, true);
      }
      if (r.status === "submitted" && !latestScoreMap.has(sid)) {
        latestScoreMap.set(sid, r.overall_score as number | null);
      }
    }

    const result = systems.map((s) => ({
      id: s.id,
      name: s.name,
      version_label: s.version_label,
      type: s.type ?? null,
      environment: s.environment ?? null,
      created_at: s.created_at,
      latest_score: latestScoreMap.get(s.id as string) ?? null,
      run_count: runCountMap.get(s.id as string) ?? 0,
      has_draft: hasDraftMap.get(s.id as string) ?? false,
    }));

    return NextResponse.json({ systems: result });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/systems — create a new system (with plan cap check)
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  try {
    const authClient = await createSupabaseServerClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await req.json();
    const name = String(body.name || "").trim();
    const versionLabel = String(body.version_label || "").trim();
    const systemType =
      typeof body.type === "string" && body.type.trim()
        ? body.type.trim()
        : null;
    const environment =
      typeof body.environment === "string" && body.environment.trim()
        ? body.environment.trim()
        : null;

    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    // Enforce plan caps
    const [plan, systemCount] = await Promise.all([
      getUserPlan(user.id),
      getUserSystemCount(user.id),
    ]);

    if (!canCreateSystem(plan, systemCount)) {
      const limits = getPlanLimits(plan);
      return NextResponse.json(
        {
          error:
            limits.maxSystems === 0
              ? "Systems assessment is available on Pro plans and above."
              : `You've reached your plan limit of ${limits.maxSystems} system${limits.maxSystems !== 1 ? "s" : ""}. Upgrade to continue.`,
          code: "PLAN_CAP_REACHED",
        },
        { status: 403 }
      );
    }

    const db = supabaseServer();

    const { data: system, error: insertErr } = await db
      .from("systems")
      .insert({
        owner_id: user.id,
        name,
        version_label: versionLabel,
        type: systemType,
        environment,
      })
      .select("id, name, version_label, type, environment, created_at")
      .single();

    if (insertErr || !system) {
      return NextResponse.json(
        { error: insertErr?.message || "Failed to create system" },
        { status: 500 }
      );
    }

    return NextResponse.json({ system }, { status: 201 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
