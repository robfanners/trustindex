import { NextRequest } from "next/server";
import { requireAuth, apiError, apiOk } from "@/lib/apiHelpers";
import { writeAuditLog } from "@/lib/audit";
import {
  getRunAdminTokensColumnNames,
} from "@/lib/runAdminTokensSchema";

// ---------------------------------------------------------------------------
// /api/security/survey-tokens — list + rotate survey admin codes
// ---------------------------------------------------------------------------
// Task #36 Phase C. Backs the "Reset survey admin codes" section on
// /dashboard/settings/security.
//
// GET  → returns surveys owned by the caller with basic metadata used to
//        identify them (title, created_at, respondent_count). Does NOT
//        return the actual admin tokens — they should never round-trip
//        the client except at rotation time.
//
// POST → { surveyIds: string[] } rotates the admin tokens for each
//        selected survey, then returns { rotated: number, results: [{ id,
//        title, newToken }] }. New tokens are shown once and never
//        retrievable after that.
// ---------------------------------------------------------------------------

// Reuse the same token generator style as create-run to stay consistent.
function randomToken(length = 28): string {
  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

type SurveyRun = {
  id: string;
  title: string;
  created_at: string;
  invites: { count: number }[] | null;
};

export async function GET() {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const db = auth.db;

  // Only surveys owned by THIS user — not the whole org. Security context.
  const { data, error } = await db
    .from("survey_runs")
    .select("id, title, created_at, invites(count)")
    .eq("owner_user_id", auth.user.id)
    .order("created_at", { ascending: false });

  if (error) return apiError(error.message, 500);

  const surveys = ((data ?? []) as SurveyRun[]).map((row) => ({
    id: row.id,
    title: row.title,
    created_at: row.created_at,
    respondent_count: row.invites?.[0]?.count ?? 0,
  }));

  return apiOk({ surveys });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body", 400);
  }

  const surveyIds =
    body &&
    typeof body === "object" &&
    Array.isArray((body as { surveyIds?: unknown }).surveyIds)
      ? ((body as { surveyIds: unknown[] }).surveyIds as unknown[]).filter(
          (v): v is string => typeof v === "string"
        )
      : null;

  if (!surveyIds || surveyIds.length === 0) {
    return apiError("surveyIds must be a non-empty array of strings", 400);
  }

  const db = auth.db;

  // Verify ownership of every requested survey — never rotate someone
  // else's token even if the ID leaks. Match owner_user_id explicitly.
  const { data: ownedRuns, error: ownerErr } = await db
    .from("survey_runs")
    .select("id, title")
    .eq("owner_user_id", auth.user.id)
    .in("id", surveyIds);

  if (ownerErr) return apiError(ownerErr.message, 500);
  if (!ownedRuns || ownedRuns.length === 0) {
    return apiError("No matching surveys found for your account", 404);
  }

  // Resolve dynamic column names (run_id / token) — the schema lets these
  // vary, see runAdminTokensSchema.ts.
  const { runIdCol, tokenCol } = await getRunAdminTokensColumnNames();

  const rotations: { id: string; title: string; newToken: string }[] = [];

  for (const run of ownedRuns) {
    const newToken = randomToken(28);

    // Upsert-style rotation — either UPDATE the existing token row for this
    // run, or INSERT a new one if for some reason none exists. Since the
    // schema is dynamic, we do a two-step check.
    const { data: existing } = await db
      .from("run_admin_tokens")
      .select(runIdCol)
      .eq(runIdCol, run.id)
      .limit(1);

    if (existing && existing.length > 0) {
      // Terminate with .select().single() so callers can inspect the
      // rotated row if needed (also aligns with the shared test mock's
      // terminal methods).
      const { error: updateErr } = await db
        .from("run_admin_tokens")
        .update({ [tokenCol]: newToken })
        .eq(runIdCol, run.id)
        .select()
        .single();
      if (updateErr) {
        return apiError(
          `Failed to rotate token for survey ${run.id}: ${updateErr.message}`,
          500
        );
      }
    } else {
      const { error: insertErr } = await db
        .from("run_admin_tokens")
        .insert({ [runIdCol]: run.id, [tokenCol]: newToken })
        .select()
        .single();
      if (insertErr) {
        return apiError(
          `Failed to create token for survey ${run.id}: ${insertErr.message}`,
          500
        );
      }
    }

    rotations.push({ id: run.id, title: run.title, newToken });

    // Audit each rotation individually so admin panel can trace who did what.
    if (auth.orgId) {
      await writeAuditLog({
        organisationId: auth.orgId,
        entityType: "survey_admin_token",
        entityId: run.id,
        actionType: "rotated",
        performedBy: auth.user.id,
        metadata: { title: run.title },
      });
    }
  }

  return apiOk({ rotated: rotations.length, results: rotations });
}
