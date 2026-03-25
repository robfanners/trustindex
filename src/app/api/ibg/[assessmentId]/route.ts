import { NextRequest } from "next/server";
import { requireAuth, apiError, apiOk } from "@/lib/apiHelpers";
import { canManageIBG, canViewIBG } from "@/lib/entitlements";

// ---------------------------------------------------------------------------
// GET /api/ibg/[assessmentId] — fetch active or latest draft IBG spec
// ---------------------------------------------------------------------------

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ assessmentId: string }> }
) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const { orgId, plan, db } = auth;

  try {
    const { assessmentId } = await params;

    if (!canViewIBG(plan)) {
      return apiError("Upgrade to view IBG specifications", 403);
    }

    // Try active first, fall back to latest draft
    const { data: spec } = await db
      .from("ibg_specifications")
      .select("*")
      .eq("assessment_id", assessmentId)
      .eq("organisation_id", orgId)
      .in("status", ["active", "draft"])
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Also get version count
    const { count } = await db
      .from("ibg_specifications")
      .select("id", { count: "exact", head: true })
      .eq("assessment_id", assessmentId);

    return apiOk({
      spec: spec ?? null,
      versionCount: count ?? 0,
      canEdit: canManageIBG(plan),
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return apiError(message, 500);
  }
}

// ---------------------------------------------------------------------------
// POST /api/ibg/[assessmentId] — create a new draft IBG spec
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

    // Verify the assessment belongs to this org
    const { data: system } = await db
      .from("systems")
      .select("id, owner_id")
      .eq("id", assessmentId)
      .single();

    if (!system) {
      return apiError("System not found", 404);
    }

    const body = await req.json();

    const { data: spec, error: insertErr } = await db
      .from("ibg_specifications")
      .insert({
        assessment_id: assessmentId,
        organisation_id: orgId,
        status: "draft",
        authorised_goals: body.authorised_goals ?? [],
        decision_authorities: body.decision_authorities ?? [],
        action_spaces: body.action_spaces ?? [],
        blast_radius: body.blast_radius ?? {},
        effective_from: body.effective_from ?? null,
        effective_until: body.effective_until ?? null,
        created_by: user.id,
      })
      .select("*")
      .single();

    if (insertErr || !spec) {
      return apiError(insertErr?.message || "Failed to create IBG spec", 500);
    }

    return apiOk({ spec }, 201);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return apiError(message, 500);
  }
}

// ---------------------------------------------------------------------------
// PUT /api/ibg/[assessmentId] — update an existing draft IBG spec
// ---------------------------------------------------------------------------

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ assessmentId: string }> }
) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const { orgId, plan, db } = auth;

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

    // Only allow updating draft specs
    const { data: existing } = await db
      .from("ibg_specifications")
      .select("id, status")
      .eq("id", specId)
      .eq("assessment_id", assessmentId)
      .eq("organisation_id", orgId)
      .single();

    if (!existing) {
      return apiError("IBG spec not found", 404);
    }

    if (existing.status !== "draft") {
      return apiError(
        "Only draft specs can be updated. Create a new version to modify an active spec.",
        400
      );
    }

    const { data: spec, error: updateErr } = await db
      .from("ibg_specifications")
      .update({
        authorised_goals: body.authorised_goals,
        decision_authorities: body.decision_authorities,
        action_spaces: body.action_spaces,
        blast_radius: body.blast_radius,
        effective_from: body.effective_from ?? null,
        effective_until: body.effective_until ?? null,
      })
      .eq("id", specId)
      .select("*")
      .single();

    if (updateErr || !spec) {
      return apiError(updateErr?.message || "Failed to update IBG spec", 500);
    }

    return apiOk({ spec });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return apiError(message, 500);
  }
}
