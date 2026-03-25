import { requireAuth, apiError, apiOk } from "@/lib/apiHelpers";

export async function GET() {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const { user, db } = auth;

  try {
    const { data: runs, error: runsErr } = await db
      .from("survey_runs")
      .select("id, title, mode, status, opens_at")
      .eq("owner_user_id", user.id)
      .order("opens_at", { ascending: false });

    if (runsErr) {
      return apiError(runsErr.message, 500);
    }

    if (!runs || runs.length === 0) {
      return apiOk({ surveys: [] });
    }

    // Fetch response counts for all run IDs
    const runIds = runs.map((r) => r.id);
    const { data: counts } = await db
      .from("v_run_response_counts")
      .select("run_id, respondents, answers")
      .in("run_id", runIds);

    const countMap = new Map(
      (counts || []).map((c: { run_id: string; respondents: number; answers: number }) => [
        c.run_id,
        { respondents: c.respondents, answers: c.answers },
      ])
    );

    const surveys = runs.map((r) => {
      const c = countMap.get(r.id);
      return {
        id: r.id,
        title: r.title,
        mode: r.mode,
        status: r.status,
        created_at: r.opens_at,
        respondents: c?.respondents ?? 0,
        answers: c?.answers ?? 0,
      };
    });

    return apiOk({ surveys });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return apiError(message, 500);
  }
}
