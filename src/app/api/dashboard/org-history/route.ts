import { NextResponse } from "next/server";
import { requireAuth, apiOk } from "@/lib/apiHelpers";

// GET /api/dashboard/org-history — org survey score timeline for charts
export async function GET() {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;

    // Get survey runs for this org that have responses
    const { data: runs } = await auth.db
      .from("survey_runs")
      .select("id, title, created_at, mode")
      .eq("organisation_id", auth.orgId)
      .order("created_at", { ascending: true });

    if (!runs || runs.length === 0) {
      return apiOk({ scores: [] });
    }

    // Get scores from v_trustindex_scores
    const runIds = runs.map((r) => r.id);
    const { data: scores } = await auth.db
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

    return apiOk({ scores: result });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
