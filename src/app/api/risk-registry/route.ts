import { NextResponse } from "next/server";
import { requireAuth, apiError, apiOk } from "@/lib/apiHelpers";

export async function GET() {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  // Get org users
  const { data: orgUsers } = await auth.db
    .from("profiles")
    .select("id")
    .eq("organisation_id", auth.orgId);

  const userIds = (orgUsers ?? []).map((u: { id: string }) => u.id);
  if (userIds.length === 0) return apiOk({ data: [] });

  // Fetch all systems with vendor info
  const { data: systems, error: sysErr } = await auth.db
    .from("systems")
    .select(`
      id, name, version_label, type, environment,
      risk_category, owner_name, owner_role, compliance_tags,
      ai_vendor_id, ai_vendors(vendor_name, risk_category),
      created_at, archived
    `)
    .in("owner_id", userIds)
    .eq("archived", false)
    .order("created_at", { ascending: false });

  if (sysErr) return apiError(sysErr.message, 500);
  if (!systems || systems.length === 0) return apiOk({ data: [] });

  const systemIds = systems.map((s: { id: string }) => s.id);

  // Get latest submitted run scores
  const { data: runs } = await auth.db
    .from("system_runs")
    .select("system_id, overall_score, risk_flags, submitted_at")
    .in("system_id", systemIds)
    .eq("status", "submitted")
    .order("submitted_at", { ascending: false });

  const latestBySystem = new Map<string, { score: number; risk_flags: unknown; submitted_at: string }>();
  for (const run of runs ?? []) {
    const sid = run.system_id as string;
    if (!latestBySystem.has(sid)) {
      latestBySystem.set(sid, {
        score: run.overall_score as number,
        risk_flags: run.risk_flags,
        submitted_at: run.submitted_at as string,
      });
    }
  }

  // Get open incident counts per system
  const { data: incidents } = await auth.db
    .from("incidents")
    .select("system_id")
    .eq("organisation_id", auth.orgId)
    .in("status", ["open", "investigating"])
    .not("system_id", "is", null);

  const incidentsBySystem = new Map<string, number>();
  for (const inc of incidents ?? []) {
    const sid = inc.system_id as string;
    incidentsBySystem.set(sid, (incidentsBySystem.get(sid) ?? 0) + 1);
  }

  // Enrich
  const registry = systems.map((sys: Record<string, unknown>) => {
    const latest = latestBySystem.get(sys.id as string);
    return {
      ...sys,
      trust_score: latest?.score ?? null,
      risk_flags: latest?.risk_flags ?? [],
      last_assessed: latest?.submitted_at ?? null,
      open_incidents: incidentsBySystem.get(sys.id as string) ?? 0,
    };
  });

  return apiOk({ data: registry });
}
