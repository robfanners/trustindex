import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-auth-server";
import { supabaseServer } from "@/lib/supabaseServer";

// GET /api/dashboard/org-history — org survey score timeline for charts
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
      return NextResponse.json({ scores: [] });
    }

    // Get survey runs for this org that have responses
    const { data: runs } = await db
      .from("survey_runs")
      .select("id, title, created_at, mode")
      .eq("organisation_id", profile.organisation_id)
      .order("created_at", { ascending: true });

    if (!runs || runs.length === 0) {
      return NextResponse.json({ scores: [] });
    }

    // Get scores from v_trustindex_scores
    const runIds = runs.map((r) => r.id);
    const { data: scores } = await db
      .from("v_trustindex_scores")
      .select("run_id, trustindex_0_to_100")
      .in("run_id", runIds);

    const scoreMap = new Map(
      (scores || []).map((s: { run_id: string; trustindex_0_to_100: number }) => [
        s.run_id,
        Number(s.trustindex_0_to_100),
      ])
    );

    // Only include runs that have scores
    const result = runs
      .filter((r) => scoreMap.has(r.id))
      .map((r) => ({
        run_id: r.id,
        title: r.title,
        score: scoreMap.get(r.id)!,
        date: r.created_at,
        mode: r.mode,
      }));

    return NextResponse.json({ scores: result });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
