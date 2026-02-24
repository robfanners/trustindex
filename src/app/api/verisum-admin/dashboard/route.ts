import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/vcc/adminAuth";
import { supabaseServer } from "@/lib/supabaseServer";

// ---------------------------------------------------------------------------
// GET /api/verisum-admin/dashboard — Aggregated platform metrics
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const auth = await requireAdmin("view_dashboard");
    if ("error" in auth) return auth.error;

    const db = supabaseServer();

    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Run all metric queries in parallel
    const [
      profilesRes,
      systemsRes,
      runsRes,
      surveysRes,
      // Activity & Growth
      newUsersWeekRes,
      newUsersMonthRes,
      liveSurveysRes,
      closedSurveysRes,
      respondentsRes,
      // Assessment Quality
      submittedRunsRes,
      draftRunsRes,
      scoresRes,
      systemTypesRes,
    ] = await Promise.all([
      // --- Existing ---
      db.from("profiles").select("plan, suspended_at"),
      db.from("systems").select("id", { count: "exact", head: true }).eq("archived", false),
      db.from("system_runs").select("id", { count: "exact", head: true }),
      db.from("survey_runs").select("id", { count: "exact", head: true }),

      // --- Activity & Growth ---
      db.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", oneWeekAgo),
      db.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", oneMonthAgo),
      db.from("survey_runs").select("id", { count: "exact", head: true }).eq("status", "live"),
      db.from("survey_runs").select("id", { count: "exact", head: true }).eq("status", "closed"),
      db.from("v_run_response_counts").select("run_id, respondents"),

      // --- Assessment Quality ---
      db.from("system_runs").select("id", { count: "exact", head: true }).eq("status", "submitted"),
      db.from("system_runs").select("id", { count: "exact", head: true }).eq("status", "draft"),
      db.from("system_runs").select("overall_score").eq("status", "submitted").not("overall_score", "is", null),
      db.from("systems").select("type").eq("archived", false),
    ]);

    // Plan breakdown + suspended count
    const profiles = profilesRes.data ?? [];
    const planCounts = { explorer: 0, pro: 0, enterprise: 0 };
    let suspendedCount = 0;

    for (const p of profiles) {
      const plan = (p.plan as string) ?? "explorer";
      if (plan in planCounts) {
        planCounts[plan as keyof typeof planCounts]++;
      }
      if (p.suspended_at) suspendedCount++;
    }

    // Risk flags: count system_runs with non-empty risk_flags
    const { count: riskFlagCount } = await db
      .from("system_runs")
      .select("id", { count: "exact", head: true })
      .eq("status", "submitted")
      .not("risk_flags", "eq", "[]");

    // Total respondents (aggregate from view)
    const respondentRows = respondentsRes.data ?? [];
    const totalRespondents = respondentRows.reduce(
      (sum, r) => sum + ((r.respondents as number) ?? 0),
      0
    );

    // Average system score + low-score count
    const scoreRows = scoresRes.data ?? [];
    let avgSystemScore: number | null = null;
    let lowScoreSystems = 0;

    if (scoreRows.length > 0) {
      const total = scoreRows.reduce(
        (sum, r) => sum + ((r.overall_score as number) ?? 0),
        0
      );
      avgSystemScore = Math.round(total / scoreRows.length);
      lowScoreSystems = scoreRows.filter(
        (r) => (r.overall_score as number) < 60
      ).length;
    }

    // Systems by type breakdown
    const systemsByType: Record<string, number> = {};
    for (const s of systemTypesRes.data ?? []) {
      const t = (s.type as string) ?? "Other";
      systemsByType[t] = (systemsByType[t] ?? 0) + 1;
    }

    // Engagement — avg respondents per survey, surveys with zero responses
    const totalSurveys = surveysRes.count ?? 0;
    const avgRespondentsPerSurvey =
      totalSurveys > 0 ? Math.round(totalRespondents / totalSurveys) : 0;

    // Surveys with zero responses: total surveys minus surveys that appear in counts view
    const surveyIdsWithResponses = new Set(
      respondentRows.map((r) => r.run_id as string).filter(Boolean)
    );
    // Note: respondentsRes only has surveys WITH responses, so we need total surveys count
    const surveysWithZeroResponses = Math.max(
      0,
      totalSurveys - surveyIdsWithResponses.size
    );

    return NextResponse.json({
      data: {
        // Existing
        totalUsers: profiles.length,
        planCounts,
        activeSystems: systemsRes.count ?? 0,
        totalSystemRuns: runsRes.count ?? 0,
        suspendedCount,
        riskFlagCount: riskFlagCount ?? 0,
        totalSurveys,

        // Activity & Growth
        newUsersThisWeek: newUsersWeekRes.count ?? 0,
        newUsersThisMonth: newUsersMonthRes.count ?? 0,
        liveSurveys: liveSurveysRes.count ?? 0,
        closedSurveys: closedSurveysRes.count ?? 0,
        totalRespondents,

        // Assessment Quality
        submittedRuns: submittedRunsRes.count ?? 0,
        draftRuns: draftRunsRes.count ?? 0,
        avgSystemScore,
        lowScoreSystems,
        systemsByType,

        // Engagement
        avgRespondentsPerSurvey,
        surveysWithZeroResponses,
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
