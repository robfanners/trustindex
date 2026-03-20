import { NextRequest } from "next/server";
import { requireAuth, apiOk, withErrorHandling } from "@/lib/apiHelpers";

export async function GET(req: NextRequest) {
  return withErrorHandling(async () => {
    const auth = await requireAuth({ withPlan: false });
    if (auth.error) return auth.error;

    const { orgId: organisation_id, db } = auth;

  const { searchParams } = new URL(req.url);
  const rawDays = parseInt(searchParams.get("days") ?? "90", 10);
  const days = Math.min(isNaN(rawDays) ? 90 : rawDays, 365);
  const since = new Date(Date.now() - days * 86400000).toISOString();

    // Get org users
    const { data: orgUsers } = await db
      .from("profiles")
      .select("id")
      .eq("organisation_id", organisation_id);

    const userIds = (orgUsers ?? []).map((u: { id: string }) => u.id);

    // TrustOrg score history (survey_runs table)
    const { data: orgRuns } = await db
      .from("survey_runs")
      .select("id, overall_score, dimension_scores, submitted_at")
      .in("created_by", userIds)
      .eq("status", "submitted")
      .gte("submitted_at", since)
      .order("submitted_at", { ascending: true });

    // Get org systems
    const { data: orgSystems } = await db
      .from("systems")
      .select("id, name")
      .in("owner_id", userIds);

    const orgSystemMap = new Map((orgSystems ?? []).map((s: { id: string; name: string }) => [s.id, s.name]));
    const systemIds = [...orgSystemMap.keys()];

    // TrustSys score history (system_runs table)
    const { data: sysRuns } = await db
      .from("system_runs")
      .select("id, system_id, overall_score, submitted_at")
      .in("system_id", systemIds.length > 0 ? systemIds : ["__none__"])
      .eq("status", "submitted")
      .gte("submitted_at", since)
      .order("submitted_at", { ascending: true });

    // Collect all run IDs for org-scoped drift event filtering
    const orgRunIds = (orgRuns ?? []).map((r: { id: string }) => r.id);
    const sysRunIds = (sysRuns ?? []).map((r: { id: string }) => r.id);
    const allRunIds = [...orgRunIds, ...sysRunIds];

    // Drift events (scoped to org's runs only)
    const { data: driftEvents } = allRunIds.length > 0
      ? await db
          .from("drift_events")
          .select("id, run_type, delta_score, dimension_id, drift_flag, created_at")
          .in("run_id", allRunIds)
          .gte("created_at", since)
          .order("created_at", { ascending: true })
      : { data: [] };

    // Build weekly timeline
    const toWeekKey = (dateStr: string) => {
      const d = new Date(dateStr);
      const start = new Date(d);
      start.setDate(d.getDate() - d.getDay());
      return start.toISOString().split("T")[0];
    };

    const weekMap = new Map<string, {
      org_score: number | null;
      sys_scores: Map<string, number>;
      drift_count: number;
    }>();

    for (const run of orgRuns ?? []) {
      const week = toWeekKey(run.submitted_at);
      const entry = weekMap.get(week) ?? { org_score: null, sys_scores: new Map(), drift_count: 0 };
      entry.org_score = run.overall_score;
      weekMap.set(week, entry);
    }

    for (const run of sysRuns ?? []) {
      const week = toWeekKey(run.submitted_at);
      const entry = weekMap.get(week) ?? { org_score: null, sys_scores: new Map(), drift_count: 0 };
      const sysName = orgSystemMap.get(run.system_id) ?? run.system_id;
      entry.sys_scores.set(sysName, run.overall_score);
      weekMap.set(week, entry);
    }

    for (const event of driftEvents ?? []) {
      const week = toWeekKey(event.created_at);
      const entry = weekMap.get(week) ?? { org_score: null, sys_scores: new Map(), drift_count: 0 };
      entry.drift_count += 1;
      weekMap.set(week, entry);
    }

    // Build sorted timeline
    const sortedWeeks = [...weekMap.keys()].sort();
    let lastOrgScore: number | null = null;

    const timeline = sortedWeeks.map((week) => {
      const entry = weekMap.get(week)!;
      if (entry.org_score !== null) lastOrgScore = entry.org_score;

      const sysScoreValues = [...entry.sys_scores.values()];
      const avgSys = sysScoreValues.length > 0
        ? Math.round(sysScoreValues.reduce((a, b) => a + b, 0) / sysScoreValues.length)
        : null;

      return {
        date: week,
        org_score: entry.org_score ?? lastOrgScore,
        sys_scores: Object.fromEntries(entry.sys_scores),
        avg_sys_score: avgSys,
        drift_events_count: entry.drift_count,
      };
    });

    return apiOk({
      data: {
        timeline,
        period_days: days,
      },
    });
  });
}
