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
      .select("id, name, version_label, created_at")
      .eq("owner_id", user.id)
      .eq("archived", false)
      .order("created_at", { ascending: false });

    if (sysErr) {
      return NextResponse.json({ error: sysErr.message }, { status: 500 });
    }

    if (!systems || systems.length === 0) {
      return NextResponse.json({ systems: [] });
    }

    // For each system, fetch latest assessment score + assessment count
    const systemIds = systems.map((s) => s.id);

    const { data: assessments } = await db
      .from("system_assessments")
      .select("system_id, overall_score, created_at")
      .in("system_id", systemIds)
      .order("created_at", { ascending: false });

    // Build maps: latest score per system + count per system
    const latestScoreMap = new Map<string, number | null>();
    const countMap = new Map<string, number>();

    for (const a of assessments || []) {
      const sid = a.system_id as string;
      countMap.set(sid, (countMap.get(sid) ?? 0) + 1);
      if (!latestScoreMap.has(sid)) {
        latestScoreMap.set(sid, a.overall_score as number | null);
      }
    }

    const result = systems.map((s) => ({
      id: s.id,
      name: s.name,
      version_label: s.version_label,
      created_at: s.created_at,
      latest_score: latestScoreMap.get(s.id as string) ?? null,
      assessment_count: countMap.get(s.id as string) ?? 0,
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
      })
      .select("id, name, version_label, created_at")
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
