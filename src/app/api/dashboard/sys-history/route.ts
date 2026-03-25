import { NextResponse } from "next/server";
import { requireAuth, apiOk } from "@/lib/apiHelpers";

// GET /api/dashboard/sys-history — score timeline per system for charts
export async function GET() {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;

    const { data: orgUsers } = await auth.db
      .from("profiles")
      .select("id")
      .eq("organisation_id", auth.orgId);

    const userIds = (orgUsers || []).map((u) => u.id);
    if (userIds.length === 0) return apiOk({ systems: [] });

    const { data: systems } = await auth.db
      .from("systems")
      .select("id, name")
      .in("owner_id", userIds)
      .eq("archived", false);

    if (!systems || systems.length === 0) {
      return apiOk({ systems: [] });
    }

    const systemIds = systems.map((s) => s.id);

    const { data: runs } = await auth.db
      .from("system_runs")
      .select("system_id, overall_score, version_label, submitted_at")
      .in("system_id", systemIds)
      .eq("status", "submitted")
      .not("overall_score", "is", null)
      .order("submitted_at", { ascending: true });

    const nameMap = new Map(systems.map((s) => [s.id, s.name]));
    const historyMap = new Map<string, Array<{ score: number; date: string; label: string }>>();

    for (const r of runs || []) {
      const sid = r.system_id as string;
      if (!historyMap.has(sid)) historyMap.set(sid, []);
      historyMap.get(sid)!.push({
        score: r.overall_score as number,
        date: r.submitted_at as string,
        label: (r.version_label as string) || "",
      });
    }

    const result = systems.map((s) => ({
      id: s.id,
      name: nameMap.get(s.id as string) || "",
      runs: historyMap.get(s.id as string) || [],
    }));

    return apiOk({ systems: result });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
