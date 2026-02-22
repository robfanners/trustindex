import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

// ---------------------------------------------------------------------------
// POST /api/try-explorer — create an anonymous Explorer self-assessment
// No auth required. Creates a survey_run with owner_user_id = NULL.
// The run can later be "claimed" via /api/claim-explorer-run after signup.
// ---------------------------------------------------------------------------

function randomToken(length = 28) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < length; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export async function POST() {
  try {
    let supabase: ReturnType<typeof supabaseServer>;
    try {
      supabase = supabaseServer();
    } catch {
      return NextResponse.json(
        { error: "Server configuration error." },
        { status: 503 }
      );
    }

    const orgName = "Self-Assessment";
    const runTitle = `Explorer Self-Assessment – ${new Date().toISOString().slice(0, 10)}`;

    // Find or create the "Self-Assessment" organisation
    const { data: existingOrgs, error: orgFindErr } = await supabase
      .from("organisations")
      .select("id")
      .eq("name", orgName)
      .limit(1);

    if (orgFindErr) {
      return NextResponse.json({ error: orgFindErr.message }, { status: 500 });
    }

    let organisationId = existingOrgs?.[0]?.id as string | undefined;

    if (!organisationId) {
      const { data: orgInsert, error: orgInsertErr } = await supabase
        .from("organisations")
        .insert({ name: orgName })
        .select("id")
        .single();

      if (orgInsertErr || !orgInsert) {
        return NextResponse.json(
          { error: orgInsertErr?.message || "Failed to create organisation" },
          { status: 500 }
        );
      }
      organisationId = orgInsert.id;
    }

    // Create the survey run (no owner — will be claimed on signup)
    const { data: runInsert, error: runErr } = await supabase
      .from("survey_runs")
      .insert({
        organisation_id: organisationId,
        title: runTitle,
        status: "live",
        opens_at: new Date().toISOString(),
        mode: "explorer",
      })
      .select("id")
      .single();

    if (runErr || !runInsert) {
      return NextResponse.json(
        { error: runErr?.message || "Failed to create survey run" },
        { status: 500 }
      );
    }

    const runId = runInsert.id as string;
    const token = randomToken(28);

    // Create single invite
    const { error: inviteErr } = await supabase.from("invites").insert({
      run_id: runId,
      token,
    });

    if (inviteErr) {
      return NextResponse.json({ error: inviteErr.message }, { status: 500 });
    }

    return NextResponse.json({ runId, token });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
