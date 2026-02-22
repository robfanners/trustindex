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

    // Run all metric queries in parallel
    const [
      profilesRes,
      systemsRes,
      runsRes,
      surveysRes,
    ] = await Promise.all([
      // All profiles (for plan breakdown + suspended count)
      db.from("profiles").select("plan, suspended_at"),
      // Active (non-archived) systems count
      db.from("systems").select("id", { count: "exact", head: true }).eq("archived", false),
      // Total system runs
      db.from("system_runs").select("id", { count: "exact", head: true }),
      // Total surveys
      db.from("survey_runs").select("id", { count: "exact", head: true }),
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

    return NextResponse.json({
      data: {
        totalUsers: profiles.length,
        planCounts,
        activeSystems: systemsRes.count ?? 0,
        totalSystemRuns: runsRes.count ?? 0,
        suspendedCount,
        riskFlagCount: riskFlagCount ?? 0,
        totalSurveys: surveysRes.count ?? 0,
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
