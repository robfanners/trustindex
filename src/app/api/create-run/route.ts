import { requireAuth, apiError, apiOk } from "@/lib/apiHelpers";
import { supabaseServer } from "@/lib/supabase/admin";
import { getUserPlan, getUserSurveyCount, canCreateSurvey, getPlanLimits } from "@/lib/entitlements";

function randomToken(length = 28) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < length; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export async function POST(req: Request) {
  try {
    let supabase: ReturnType<typeof supabaseServer>;
    try {
      supabase = supabaseServer();
    } catch (_configErr: unknown) {
      return apiError("Server configuration error. Please try again later or contact support.", 503);
    }

    // Require authenticated user
    const auth = await requireAuth({ orgOptional: true });
    if (auth.error) return auth.error;
    const { user: ownerUser, db } = auth;
    const ownerUserId = ownerUser.id;

    const body = await req.json();

    const orgName = String(body.orgName || "").trim();
    const runTitle = String(body.runTitle || "").trim();
    const mode = body.mode === "explorer" ? "explorer" : "org";
    const inviteCountRaw = Number(body.inviteCount || (mode === "explorer" ? 1 : 10));
    const inviteCount = Math.max(1, Math.min(500, Math.floor(inviteCountRaw)));

    if (!orgName) {
      return apiError("orgName is required", 400);
    }
    if (!runTitle) {
      return apiError("runTitle is required", 400);
    }
    if (mode === "explorer" && inviteCount !== 1) {
      return apiError("Explorer mode must have inviteCount = 1", 400);
    }

    const MIN_ORG_RESPONDENTS = 5;
    if (mode === "org" && inviteCount < MIN_ORG_RESPONDENTS) {
      return apiError(`Organisational mode requires inviteCount >= ${MIN_ORG_RESPONDENTS}`, 400);
    }

    // Enforce plan caps for authenticated users
    const [plan, surveyCount] = await Promise.all([
      getUserPlan(ownerUserId),
      getUserSurveyCount(ownerUserId),
    ]);

    if (!canCreateSurvey(plan, surveyCount)) {
      const limits = getPlanLimits(plan);
      return apiError(
        `You've reached your plan limit of ${limits.maxSurveys} survey${limits.maxSurveys !== 1 ? "s" : ""}. Upgrade to continue.`,
        403
      );
    }

    const { data: existingOrgs, error: orgFindErr } = await supabase
      .from("organisations")
      .select("id")
      .eq("name", orgName)
      .limit(1);

    if (orgFindErr) {
      return apiError(orgFindErr.message, 500);
    }

    let organisationId = existingOrgs?.[0]?.id as string | undefined;

    if (!organisationId) {
      const { data: orgInsert, error: orgInsertErr } = await supabase
        .from("organisations")
        .insert({ name: orgName })
        .select("id")
        .single();

      if (orgInsertErr || !orgInsert) {
        return apiError(orgInsertErr?.message || "Failed to create organisation", 500);
      }
      organisationId = orgInsert.id;
    }

    const runRow: Record<string, unknown> = {
      organisation_id: organisationId,
      title: runTitle,
      status: "live",
      opens_at: new Date().toISOString(),
      mode,
    };
    if (ownerUserId) runRow.owner_user_id = ownerUserId;

    const { data: runInsert, error: runErr } = await supabase
      .from("survey_runs")
      .insert(runRow)
      .select("id")
      .single();

    if (runErr || !runInsert) {
      return apiError(runErr?.message || "Failed to create survey run", 500);
    }

    const runId = runInsert.id as string;
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
      return apiError(inviteErr.message, 500);
    }

    // Save survey scope (hierarchy selections)
    const scope = body.scope as Array<{
      subsidiaryId?: string;
      functionId?: string;
      teamId?: string;
    }> | undefined;

    if (scope?.length) {
      const scopeRows = scope.map((s) => ({
        survey_run_id: runId,
        subsidiary_id: s.subsidiaryId || null,
        function_id: s.functionId || null,
        team_id: s.teamId || null,
      }));
      await supabase.from("survey_scope").insert(scopeRows);
    }

    return apiOk({
      runId,
      tokens,
      mode,
      surveyLinks: tokens.map((t) => `/survey/${t}`),
      dashboardLink: `/dashboard/surveys/${runId}`,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return apiError(message, 500);
  }
}
