"use server";

import { supabaseServer } from "@/lib/supabaseServer";

export type CreateState = {
  runId: string | null;
  token: string | null;
  error: string | null;
};

function randomToken(length = 24) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < length; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export async function createDemoRunAction(_: CreateState): Promise<CreateState> {
  try {
    const orgName = "Verisum (Demo)";
    const title = `TrustIndex Pilot - ${new Date().toISOString().slice(0, 10)}`;

    const { data: existingOrgs, error: orgFindErr } = await supabaseServer
      .from("organisations")
      .select("id")
      .eq("name", orgName)
      .limit(1);

    if (orgFindErr) {
      return { runId: null, token: null, error: orgFindErr.message };
    }

    let organisationId = existingOrgs?.[0]?.id as string | undefined;

    if (!organisationId) {
      const { data: orgInsert, error: orgInsertErr } = await supabaseServer
        .from("organisations")
        .insert({ name: orgName })
        .select("id")
        .single();

      if (orgInsertErr || !orgInsert) {
        return { runId: null, token: null, error: orgInsertErr?.message || "Failed to create organisation" };
      }

      organisationId = orgInsert.id;
    }

    const { data: runInsert, error: runErr } = await supabaseServer
      .from("survey_runs")
      .insert({
        organisation_id: organisationId,
        title,
        status: "live",
        opens_at: new Date().toISOString(),
        mode: "explorer",
      })
      .select("id")
      .single();

    if (runErr || !runInsert) {
      return { runId: null, token: null, error: runErr?.message || "Failed to create survey run" };
    }

    const runId = runInsert.id as string;
    const token = randomToken(24);

    const { error: inviteErr } = await supabaseServer
      .from("invites")
      .insert([{ run_id: runId, token }]);

    if (inviteErr) {
      return { runId: null, token: null, error: inviteErr.message };
    }

    return { runId, token, error: null };
  } catch (e: any) {
    return { runId: null, token: null, error: e?.message || "Failed to create demo run" };
  }
}
