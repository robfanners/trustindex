import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-auth-server";
import { supabaseServer } from "@/lib/supabaseServer";

// ---------------------------------------------------------------------------
// GET /api/trustsys/assessments — list org's TrustSys assessments with latest run
// Uses the existing `systems` + `system_runs` tables
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

    // Get user's org_id from profile
    const { data: profile } = await db
      .from("profiles")
      .select("organisation_id")
      .eq("id", user.id)
      .single();

    if (!profile?.organisation_id) {
      return NextResponse.json({ assessments: [] });
    }

    // Fetch systems (assessments) owned by users in the same org
    // The `systems` table uses `owner_id` (user) — join through profiles to match org
    const { data: orgUsers } = await db
      .from("profiles")
      .select("id")
      .eq("organisation_id", profile.organisation_id);

    const userIds = (orgUsers || []).map((u) => u.id);

    if (userIds.length === 0) {
      return NextResponse.json({ assessments: [] });
    }

    const { data: systems, error: sysErr } = await db
      .from("systems")
      .select("id, name, version_label, type, environment, created_at")
      .in("owner_id", userIds)
      .eq("archived", false)
      .order("created_at", { ascending: false });

    if (sysErr) {
      return NextResponse.json({ error: sysErr.message }, { status: 500 });
    }

    if (!systems || systems.length === 0) {
      return NextResponse.json({ assessments: [] });
    }

    // Fetch runs for all systems to get latest score, run count, status
    const systemIds = systems.map((s) => s.id);

    const { data: runs } = await db
      .from("system_runs")
      .select("system_id, status, overall_score, version_label, created_at, submitted_at")
      .in("system_id", systemIds)
      .order("created_at", { ascending: false });

    // Build maps
    const latestRunMap = new Map<
      string,
      {
        score: number | null;
        status: string;
        version_label: string | null;
      }
    >();
    const runCountMap = new Map<string, number>();
    const hasInProgressMap = new Map<string, boolean>();

    for (const r of runs || []) {
      const sid = r.system_id as string;
      runCountMap.set(sid, (runCountMap.get(sid) ?? 0) + 1);

      // Map "draft" → in_progress
      if (r.status === "draft") {
        hasInProgressMap.set(sid, true);
      }

      // Latest completed = "submitted" status (already sorted desc by created_at)
      if (!latestRunMap.has(sid) && r.status === "submitted") {
        latestRunMap.set(sid, {
          score: r.overall_score as number | null,
          status: "completed",
          version_label: r.version_label as string | null,
        });
      }
    }

    const result = systems.map((s) => {
      const latest = latestRunMap.get(s.id as string);
      return {
        id: s.id,
        name: s.name,
        version_label: s.version_label,
        type: s.type,
        environment: s.environment,
        created_at: s.created_at,
        latest_score: latest?.score ?? null,
        latest_status: latest?.status ?? null,
        stability_status: "provisional",
        latest_version: 0,
        run_count: runCountMap.get(s.id as string) ?? 0,
        has_in_progress: hasInProgressMap.get(s.id as string) ?? false,
      };
    });

    return NextResponse.json({ assessments: result });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/trustsys/assessments — create a new system (assessment)
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const authClient = await createSupabaseServerClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const db = supabaseServer();

    // Get user's org_id from profile
    const { data: profile } = await db
      .from("profiles")
      .select("organisation_id")
      .eq("id", user.id)
      .single();

    if (!profile?.organisation_id) {
      return NextResponse.json(
        { error: "No organisation linked to your account" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const name = String(body.name || "").trim();
    const versionLabel = String(body.version_label || "").trim();
    const type = typeof body.type === "string" ? body.type.trim() : null;
    const environment =
      typeof body.environment === "string" ? body.environment.trim() : null;

    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const { data: system, error: insertErr } = await db
      .from("systems")
      .insert({
        owner_id: user.id,
        name,
        version_label: versionLabel || null,
        type: type || null,
        environment: environment || null,
      })
      .select("id, name, version_label, type, environment, created_at")
      .single();

    if (insertErr || !system) {
      return NextResponse.json(
        { error: insertErr?.message || "Failed to create assessment" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      assessment: {
        id: system.id,
        name: system.name,
        version_label: system.version_label,
        type: system.type,
        environment: system.environment,
        created_at: system.created_at,
      },
    }, { status: 201 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
