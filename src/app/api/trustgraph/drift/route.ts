import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-auth-server";
import { supabaseServer } from "@/lib/supabaseServer";

// ---------------------------------------------------------------------------
// GET /api/trustgraph/drift — list drift events for the user's org
// ---------------------------------------------------------------------------
// Query params: run_type (org|sys), days (lookback window, default 90),
//               page, per_page

export async function GET(req: NextRequest) {
  try {
    const authClient = await createSupabaseServerClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const db = supabaseServer();

    const { data: profile } = await db
      .from("profiles")
      .select("organisation_id")
      .eq("id", user.id)
      .single();

    if (!profile?.organisation_id) {
      return NextResponse.json({ error: "No organisation linked" }, { status: 400 });
    }

    const orgId = profile.organisation_id;
    const url = req.nextUrl;

    const runType = url.searchParams.get("run_type"); // 'org' | 'sys' | null
    const days = Math.min(365, Math.max(1, Number(url.searchParams.get("days")) || 90));
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
    const perPage = Math.min(100, Math.max(1, Number(url.searchParams.get("per_page")) || 50));

    // Build the query — drift_events don't have org_id directly,
    // so we join through runs to filter by org
    const cutoff = new Date(Date.now() - days * 86400000).toISOString();

    // Use raw SQL for the join query via RPC or direct query
    // Simpler approach: query drift_events and filter by run IDs belonging to org
    let sysRunIds: string[] = [];
    let orgRunIds: string[] = [];

    if (!runType || runType === "sys") {
      const { data: assessments } = await db
        .from("trustsys_assessments")
        .select("id")
        .eq("organisation_id", orgId);
      const assessmentIds = (assessments || []).map((a: { id: string }) => a.id);

      if (assessmentIds.length > 0) {
        const { data: sysRuns } = await db
          .from("trustsys_runs")
          .select("id")
          .in("assessment_id", assessmentIds);
        sysRunIds = (sysRuns || []).map((r: { id: string }) => r.id);
      }
    }

    if (!runType || runType === "org") {
      const { data: surveys } = await db
        .from("trustorg_surveys")
        .select("id")
        .eq("organisation_id", orgId);
      const surveyIds = (surveys || []).map((s: { id: string }) => s.id);

      if (surveyIds.length > 0) {
        const { data: orgRuns } = await db
          .from("trustorg_runs")
          .select("id")
          .in("survey_id", surveyIds);
        orgRunIds = (orgRuns || []).map((r: { id: string }) => r.id);
      }
    }

    const allRunIds = [...sysRunIds, ...orgRunIds];

    if (allRunIds.length === 0) {
      return NextResponse.json({ drift_events: [], total: 0, page, per_page: perPage });
    }

    let query = db
      .from("drift_events")
      .select("*", { count: "exact" })
      .in("run_id", allRunIds)
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .range((page - 1) * perPage, page * perPage - 1);

    if (runType) {
      query = query.eq("run_type", runType);
    }

    const { data: events, error: fetchErr, count } = await query;

    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }

    return NextResponse.json({
      drift_events: events || [],
      total: count ?? 0,
      page,
      per_page: perPage,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
