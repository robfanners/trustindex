import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-auth-server";
import { supabaseServer } from "@/lib/supabaseServer";

// GET /api/dashboard/sys-history — score timeline per system for charts
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

    const { data: profile } = await db
      .from("profiles")
      .select("organisation_id")
      .eq("id", user.id)
      .single();

    if (!profile?.organisation_id) {
      return NextResponse.json({ systems: [] });
    }

    const { data: orgUsers } = await db
      .from("profiles")
      .select("id")
      .eq("organisation_id", profile.organisation_id);

    const userIds = (orgUsers || []).map((u) => u.id);
    if (userIds.length === 0) return NextResponse.json({ systems: [] });

    const { data: systems } = await db
      .from("systems")
      .select("id, name")
      .in("owner_id", userIds)
      .eq("archived", false);

    if (!systems || systems.length === 0) {
      return NextResponse.json({ systems: [] });
    }

    const systemIds = systems.map((s) => s.id);

    const { data: runs } = await db
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

    return NextResponse.json({ systems: result });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
