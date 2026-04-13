import { NextRequest } from "next/server";
import { requireAuth, apiError, apiOk } from "@/lib/apiHelpers";
import { authenticateApiKey } from "@/lib/apiKeyAuth";
import { writeAuditLog } from "@/lib/audit";

type Ctx = { params: Promise<{ decisionId: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  // Try session auth first, then API key
  const sessionAuth = await requireAuth({ orgOptional: false });
  let organisationId: string;
  let userId: string | null;
  let apiKeyId: string | null;

  if (!sessionAuth.error) {
    organisationId = sessionAuth.orgId;
    userId = sessionAuth.user.id;
    apiKeyId = null;
  } else {
    // Try API key
    const apiKeyAuth = await authenticateApiKey(req, "Verify", "decisions:read");
    if (!apiKeyAuth) {
      return apiError("Not authenticated", 401);
    }
    organisationId = apiKeyAuth.organisationId;
    userId = null;
    apiKeyId = apiKeyAuth.apiKeyId;
  }

  const { supabaseServer } = await import("@/lib/supabase/admin");
  const db = sessionAuth.error ? supabaseServer() : sessionAuth.db;
  const { decisionId } = await ctx.params;

  const { data, error } = await db
    .from("decision_records")
    .select(
      `*,
      ai_outputs(*, context),
      policy_versions(title, version, policy_hash, status),
      systems(name),
      profiles!decision_records_human_reviewer_id_fkey(full_name, email),
      prove_approvals(title, status),
      prove_provenance(title, verification_id)`
    )
    .eq("id", decisionId)
    .eq("organisation_id", organisationId)
    .single();

  if (error || !data) return apiError("Decision not found", 404);

  // Resolve model info from ai_output if model_id is set
  let model = null;
  if (data.ai_outputs?.model_id) {
    const { data: m } = await db
      .from("model_registry")
      .select("model_name, model_version, provider")
      .eq("id", data.ai_outputs.model_id)
      .single();
    model = m;
  }

  return apiOk({ ...data, model });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  // Try session auth first, then API key
  const sessionAuth = await requireAuth({ orgOptional: false });
  let organisationId: string;
  let userId: string | null;
  let apiKeyId: string | null;

  if (!sessionAuth.error) {
    organisationId = sessionAuth.orgId;
    userId = sessionAuth.user.id;
    apiKeyId = null;
  } else {
    // Try API key
    const apiKeyAuth = await authenticateApiKey(req, "Verify", "decisions:write");
    if (!apiKeyAuth) {
      return apiError("Not authenticated", 401);
    }
    organisationId = apiKeyAuth.organisationId;
    userId = null;
    apiKeyId = apiKeyAuth.apiKeyId;
  }

  const { decisionId } = await ctx.params;
  const body = await req.json();

  const { supabaseServer } = await import("@/lib/supabase/admin");
  const db = sessionAuth.error ? supabaseServer() : sessionAuth.db;

  // Fetch current record
  const { data: current, error: fetchErr } = await db
    .from("decision_records")
    .select("*")
    .eq("id", decisionId)
    .eq("organisation_id", organisationId)
    .single();

  if (fetchErr || !current) return apiError("Decision not found", 404);

  if (current.chain_status === "anchored") {
    return apiError("Cannot update an anchored decision", 400);
  }

  const update: Record<string, unknown> = {};
  const now = new Date().toISOString();

  if (body.decision_status !== undefined) update.decision_status = body.decision_status;
  if (body.human_rationale !== undefined) update.human_rationale = body.human_rationale;
  if (body.approval_id !== undefined) update.approval_id = body.approval_id || null;
  if (body.provenance_id !== undefined) update.provenance_id = body.provenance_id || null;

  if (body.human_decision !== undefined) {
    update.human_decision = body.human_decision;
    update.reviewed_at = now;

    // If reviewing a pending_review decision, promote to review_completed with silver grade
    if (current.decision_status === "pending_review") {
      update.decision_status = "review_completed";
      update.assurance_grade = "silver";
      update.human_reviewer_id = userId;
    }
  }

  if (Object.keys(update).length === 0) {
    return apiError("No valid fields to update", 400);
  }

  const { data, error } = await db
    .from("decision_records")
    .update(update)
    .eq("id", decisionId)
    .select()
    .single();

  if (error) return apiError(error.message, 500);

  await writeAuditLog({
    organisationId,
    entityType: "decision",
    entityId: decisionId,
    actionType: "status_change",
    performedBy: userId || apiKeyId!,
    metadata: { updated_fields: Object.keys(update) },
  });

  return apiOk(data);
}
