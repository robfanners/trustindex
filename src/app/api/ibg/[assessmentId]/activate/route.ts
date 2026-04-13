import { NextRequest } from "next/server";
import { requireAuth, apiError, apiOk } from "@/lib/apiHelpers";
import { canManageIBG } from "@/lib/entitlements";

// ---------------------------------------------------------------------------
// POST /api/ibg/[assessmentId]/activate — activate a draft IBG spec
// ---------------------------------------------------------------------------

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ assessmentId: string }> }
) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const { user, orgId, plan, db } = auth;

  try {
    const { assessmentId } = await params;

    if (!canManageIBG(plan)) {
      return apiError("Upgrade to Pro to manage IBG specifications", 403);
    }

    const body = await req.json();
    const specId = body.id;

    if (!specId) {
      return apiError("Spec id is required", 400);
    }

    // Verify spec exists, is draft, and belongs to this assessment + org
    const { data: spec } = await db
      .from("ibg_specifications")
      .select("id, status, authorised_goals")
      .eq("id", specId)
      .eq("assessment_id", assessmentId)
      .eq("organisation_id", orgId)
      .single();

    if (!spec) {
      return apiError("IBG spec not found", 404);
    }

    if (spec.status !== "draft") {
      return apiError("Only draft specs can be activated", 400);
    }

    // Require at least one authorised goal to activate
    const goals = spec.authorised_goals as unknown[];
    if (!goals || goals.length === 0) {
      return apiError(
        "At least one authorised goal is required to activate an IBG specification",
        400
      );
    }

    // Activate — the DB trigger will auto-supersede any existing active spec
    const { data: activated, error: activateErr } = await db
      .from("ibg_specifications")
      .update({
        status: "active",
        effective_from: new Date().toISOString(),
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      })
      .eq("id", specId)
      .select("*")
      .single();

    if (activateErr || !activated) {
      return apiError(activateErr?.message || "Failed to activate IBG spec", 500);
    }

    return apiOk({ spec: activated });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return apiError(message, 500);
  }
}
