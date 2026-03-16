import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-auth-server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function GET(req: NextRequest) {
  const authClient = await createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const db = supabaseServer();

  const { data: profile } = await db
    .from("profiles")
    .select("organisation_id")
    .eq("id", user.id)
    .single();

  if (!profile?.organisation_id) {
    return NextResponse.json({ error: "No organisation linked" }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const days = Math.min(parseInt(searchParams.get("days") ?? "90"), 365);
  const since = new Date(Date.now() - days * 86400000).toISOString();

  // Get org users
  const { data: orgUsers } = await db
    .from("profiles")
    .select("id")
    .eq("organisation_id", profile.organisation_id);

  const userIds = (orgUsers ?? []).map((u: { id: string }) => u.id);

  // TrustOrg score history
  const { data: orgRuns } = await db
    .from("trustorg_runs")
    .select("id, score, dimension_scores, completed_at, stability_status")
    .in("created_by", userIds)
    .eq("status", "completed")
    .gte("completed_at", since)
    .order("completed_at", { ascending: true });

  // TrustSys score history
  const { data: sysRuns } = await db
    .from("trustsys_runs")
    .select("id, assessment_id, score, dimension_scores, completed_at, stability_status")
    .eq("status", "completed")
    .gte("completed_at", since)
    .order("completed_at", { ascending: true });

  // Get org systems to filter
  const { data: orgSystems } = await db
    .from("systems")
    .select("id, name")
    .in("owner_id", userIds);

  const orgSystemMap = new Map((orgSystems ?? []).map((s: { id: string; name: string }) => [s.id, s.name]));
  const filteredSysRuns = (sysRuns ?? []).filter(
    (r: { assessment_id: string }) => orgSystemMap.has(r.assessment_id)
  );

  // Drift events
  const { data: driftEvents } = await db
    .from("drift_events")
    .select("id, run_type, delta_score, dimension_id, drift_flag, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: true });

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
    const week = toWeekKey(run.completed_at);
    const entry = weekMap.get(week) ?? { org_score: null, sys_scores: new Map(), drift_count: 0 };
    entry.org_score = run.score;
    weekMap.set(week, entry);
  }

  for (const run of filteredSysRuns) {
    const week = toWeekKey(run.completed_at);
    const entry = weekMap.get(week) ?? { org_score: null, sys_scores: new Map(), drift_count: 0 };
    const sysName = orgSystemMap.get(run.assessment_id) ?? run.assessment_id;
    entry.sys_scores.set(sysName, run.score);
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

  return NextResponse.json({
    data: {
      timeline,
      period_days: days,
    },
  });
}
