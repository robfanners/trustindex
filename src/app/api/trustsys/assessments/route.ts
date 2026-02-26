import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-auth-server";
import { supabaseServer } from "@/lib/supabaseServer";

// ---------------------------------------------------------------------------
// GET /api/trustsys/assessments — list org's TrustSys assessments with latest run
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

    // Fetch assessments for this org
    const { data: assessments, error: assessErr } = await db
      .from("trustsys_assessments")
      .select(
        "id, system_name, version_label, system_type, environment, autonomy_level, criticality_level, reassessment_frequency_days, created_at"
      )
      .eq("organisation_id", profile.organisation_id)
      .order("created_at", { ascending: false });

    if (assessErr) {
      return NextResponse.json({ error: assessErr.message }, { status: 500 });
    }

    if (!assessments || assessments.length === 0) {
      return NextResponse.json({ assessments: [] });
    }

    // Fetch runs for all assessments to get latest score, run count, status
    const assessmentIds = assessments.map((a) => a.id);

    const { data: runs } = await db
      .from("trustsys_runs")
      .select(
        "assessment_id, status, stability_status, score, version_number, created_at"
      )
      .in("assessment_id", assessmentIds)
      .order("version_number", { ascending: false });

    // Build maps
    const latestRunMap = new Map<
      string,
      {
        score: number | null;
        status: string;
        stability_status: string;
        version_number: number;
      }
    >();
    const runCountMap = new Map<string, number>();
    const hasInProgressMap = new Map<string, boolean>();

    for (const r of runs || []) {
      const aid = r.assessment_id as string;
      runCountMap.set(aid, (runCountMap.get(aid) ?? 0) + 1);

      if (r.status === "in_progress") {
        hasInProgressMap.set(aid, true);
      }

      // Latest = highest version_number (already sorted desc)
      if (!latestRunMap.has(aid) && r.status === "completed") {
        latestRunMap.set(aid, {
          score: r.score as number | null,
          status: r.status as string,
          stability_status: r.stability_status as string,
          version_number: r.version_number as number,
        });
      }
    }

    const result = assessments.map((a) => {
      const latest = latestRunMap.get(a.id as string);
      return {
        id: a.id,
        name: a.system_name,
        version_label: a.version_label,
        type: a.system_type,
        environment: a.environment,
        autonomy_level: a.autonomy_level,
        criticality_level: a.criticality_level,
        reassessment_frequency_days: a.reassessment_frequency_days,
        created_at: a.created_at,
        latest_score: latest?.score ?? null,
        latest_status: latest?.status ?? null,
        stability_status: latest?.stability_status ?? "provisional",
        latest_version: latest?.version_number ?? 0,
        run_count: runCountMap.get(a.id as string) ?? 0,
        has_in_progress: hasInProgressMap.get(a.id as string) ?? false,
      };
    });

    return NextResponse.json({ assessments: result });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/trustsys/assessments — create a new TrustSys assessment
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
    const autonomyLevel = Number(body.autonomy_level) || 1;
    const criticalityLevel = Number(body.criticality_level) || 1;

    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const { data: assessment, error: insertErr } = await db
      .from("trustsys_assessments")
      .insert({
        organisation_id: profile.organisation_id,
        system_name: name,
        version_label: versionLabel || null,
        system_type: type || null,
        environment: environment || null,
        autonomy_level: Math.min(5, Math.max(1, autonomyLevel)),
        criticality_level: Math.min(5, Math.max(1, criticalityLevel)),
      })
      .select("id, system_name, version_label, system_type, environment, autonomy_level, criticality_level, created_at")
      .single();

    if (insertErr || !assessment) {
      return NextResponse.json(
        { error: insertErr?.message || "Failed to create assessment" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      assessment: {
        id: assessment.id,
        name: assessment.system_name,
        version_label: assessment.version_label,
        type: assessment.system_type,
        environment: assessment.environment,
        autonomy_level: assessment.autonomy_level,
        criticality_level: assessment.criticality_level,
        created_at: assessment.created_at,
      },
    }, { status: 201 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
