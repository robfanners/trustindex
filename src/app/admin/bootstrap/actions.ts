"use server";

import { supabaseServer } from "@/lib/supabaseServer";
import { createSupabaseServerClient } from "@/lib/supabase-auth-server";
import { getUserPlan, getUserSurveyCount, canCreateSurvey, getPlanLimits } from "@/lib/entitlements";

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
    const orgName = "Verisum";
    const title = `TrustIndex Pilot - ${new Date().toISOString().slice(0, 10)}`;

    const { data: existingOrgs, error: orgFindErr } = await supabaseServer()
      .from("organisations")
      .select("id")
      .eq("name", orgName)
      .limit(1);

    if (orgFindErr) {
      return { runId: null, token: null, error: orgFindErr.message };
    }

    let organisationId = existingOrgs?.[0]?.id as string | undefined;

    if (!organisationId) {
      const { data: orgInsert, error: orgInsertErr } = await supabaseServer()
        .from("organisations")
        .insert({ name: orgName })
        .select("id")
        .single();

      if (orgInsertErr || !orgInsert) {
        return { runId: null, token: null, error: orgInsertErr?.message || "Failed to create organisation" };
      }

      organisationId = orgInsert.id;
    }

    // Read authenticated user (if any) for ownership
    let ownerUserId: string | null = null;
    try {
      const authClient = await createSupabaseServerClient();
      const { data: { user } } = await authClient.auth.getUser();
      ownerUserId = user?.id ?? null;
    } catch {
      // No auth session — ownerUserId stays null
    }

    // Enforce plan caps for authenticated users
    if (ownerUserId) {
      const [plan, surveyCount] = await Promise.all([
        getUserPlan(ownerUserId),
        getUserSurveyCount(ownerUserId),
      ]);

      if (!canCreateSurvey(plan, surveyCount)) {
        const limits = getPlanLimits(plan);
        return {
          runId: null,
          token: null,
          error: `You've reached your plan limit of ${limits.maxSurveys} survey${limits.maxSurveys !== 1 ? "s" : ""}. Upgrade to continue.`,
        };
      }
    }

    const runRow: Record<string, unknown> = {
      organisation_id: organisationId,
      title,
      status: "live",
      opens_at: new Date().toISOString(),
      mode: "explorer",
    };
    if (ownerUserId) runRow.owner_user_id = ownerUserId;

    const { data: runInsert, error: runErr } = await supabaseServer()
      .from("survey_runs")
      .insert(runRow)
      .select("id")
      .single();

    if (runErr || !runInsert) {
      return { runId: null, token: null, error: runErr?.message || "Failed to create survey run" };
    }

    const runId = runInsert.id as string;
    const token = randomToken(24);

    const { error: inviteErr } = await supabaseServer()
      .from("invites")
      .insert([{ run_id: runId, token }]);

    if (inviteErr) {
      return { runId: null, token: null, error: inviteErr.message };
    }

    return { runId, token, error: null };
  } catch (e: any) {
    return { runId: null, token: null, error: e?.message || "Failed to create survey" };
  }
}
