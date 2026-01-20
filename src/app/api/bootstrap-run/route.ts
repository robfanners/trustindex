import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

function randomToken(length = 28) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < length; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const orgName = String(body.orgName || "").trim();
    const runTitle = String(body.runTitle || "").trim();
    const mode = body.mode === "explorer" ? "explorer" : "org";
    const inviteCountRaw = Number(body.inviteCount || (mode === "explorer" ? 1 : 10));
    const inviteCount = Math.max(1, Math.min(500, Math.floor(inviteCountRaw)));

    if (!orgName) {
      return NextResponse.json({ error: "orgName is required" }, { status: 400 });
    }
    if (!runTitle) {
      return NextResponse.json({ error: "runTitle is required" }, { status: 400 });
    }
    if (mode === "explorer" && inviteCount !== 1) {
      return NextResponse.json({ error: "Explorer mode must have inviteCount = 1" }, { status: 400 });
    }
const MIN_ORG_RESPONDENTS = 5;

if (mode === "org" && inviteCount < MIN_ORG_RESPONDENTS) {
  return NextResponse.json(
    { error: `Organisational mode requires inviteCount >= ${MIN_ORG_RESPONDENTS}` },
    { status: 400 }
  );
}

    // 1) Find or create organisation
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

      if (orgInsertErr) {
        return NextResponse.json({ error: orgInsertErr.message }, { status: 500 });
      }
      organisationId = orgInsert.id;
    }

    // 2) Create run
    const { data: runInsert, error: runErr } = await supabase
      .from("survey_runs")
      .insert({
        organisation_id: organisationId,
        title: runTitle,
        status: "live",
        opens_at: new Date().toISOString(),
        mode,
      })
      .select("id")
      .single();

    if (runErr) {
      return NextResponse.json({ error: runErr.message }, { status: 500 });
    }

    const runId = runInsert.id as string;

    // 3) Create invites
    const tokens = Array.from({ length: inviteCount }, () => randomToken(28));

    const inviteRows = tokens.map((t) => ({
      run_id: runId,
      token: t,
      team: body.team ? String(body.team) : null,
      level: body.level ? String(body.level) : null,
      location: body.location ? String(body.location) : null,
    }));

    const { error: inviteErr } = await supabase.from("invites").insert(inviteRows);

    if (inviteErr) {
      return NextResponse.json({ error: inviteErr.message }, { status: 500 });
    }

    return NextResponse.json({
      organisationId,
      runId,
      mode,
      tokens,
      surveyLinks: tokens.map((t) => `/survey/${t}`),
      dashboardLink: `/dashboard/${runId}`,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unknown error" }, { status: 500 });
  }
}
