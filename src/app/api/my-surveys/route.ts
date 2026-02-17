import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-auth-server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function GET() {
  try {
    // Authenticate the request
    const authClient = await createSupabaseServerClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Query surveys owned by this user (using service role to bypass RLS)
    const db = supabaseServer();

    const { data: runs, error: runsErr } = await db
      .from("survey_runs")
      .select("id, title, mode, status, opens_at")
      .eq("owner_user_id", user.id)
      .order("opens_at", { ascending: false });

    if (runsErr) {
      return NextResponse.json({ error: runsErr.message }, { status: 500 });
    }

    if (!runs || runs.length === 0) {
      return NextResponse.json({ surveys: [] });
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

    return NextResponse.json({ surveys });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
