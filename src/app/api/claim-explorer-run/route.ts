import { NextRequest } from "next/server";
import { requireAuth, apiError, apiOk } from "@/lib/apiHelpers";

// ---------------------------------------------------------------------------
// POST /api/claim-explorer-run
// Links an anonymous Explorer survey run to the authenticated user's account,
// and optionally saves onboarding profile fields.
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    // 1. Require authentication
    const auth = await requireAuth({ orgOptional: true });
    if (auth.error) return auth.error;
    const { user, db } = auth;

    // 2. Parse body
    const body = await req.json();
    const runId = body.runId as string | undefined;
    const fullName = body.fullName as string | undefined;
    const companyName = body.companyName as string | undefined;
    const companySize = body.companySize as string | undefined;
    const role = body.role as string | undefined;

    if (!runId) {
      return apiError("runId is required", 400);
    }

    // 3. Verify the run exists and is unclaimed (owner_user_id IS NULL)
    const { data: run, error: runErr } = await db
      .from("survey_runs")
      .select("id, owner_user_id")
      .eq("id", runId)
      .single();

    if (runErr || !run) {
      return apiError("Survey not found", 404);
    }

    if (run.owner_user_id) {
      // Already claimed — not an error if it's the same user
      if (run.owner_user_id === user.id) {
        return apiOk({ ok: true, alreadyClaimed: true });
      }
      return apiError("This survey is already linked to another account", 403);
    }

    // 4. Claim the run
    const { error: claimErr } = await db
      .from("survey_runs")
      .update({ owner_user_id: user.id })
      .eq("id", runId);

    if (claimErr) {
      return apiError(claimErr.message, 500);
    }

    // 5. Update profile with onboarding data (if provided)
    const profileUpdates: Record<string, string> = {};
    if (fullName?.trim()) profileUpdates.full_name = fullName.trim();
    if (companyName?.trim()) profileUpdates.company_name = companyName.trim();
    if (companySize?.trim()) profileUpdates.company_size = companySize.trim();
    if (role?.trim()) profileUpdates.role = role.trim();

    if (Object.keys(profileUpdates).length > 0) {
      await db
        .from("profiles")
        .update(profileUpdates)
        .eq("id", user.id);
    }

    return apiOk({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return apiError(msg, 500);
  }
}
