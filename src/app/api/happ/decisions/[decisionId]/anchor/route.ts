import { NextRequest } from "next/server";
import { requireAuth, apiError } from "@/lib/apiHelpers";
import { authenticateApiKey } from "@/lib/apiKeyAuth";
import { hashPayload, anchorOnChain } from "@/lib/prove/chain";
import { writeAuditLog } from "@/lib/audit";

type Ctx = { params: Promise<{ decisionId: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
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

  const { supabaseServer } = await import("@/lib/supabase/admin");
  const db = sessionAuth.error ? supabaseServer() : sessionAuth.db;
  const { decisionId } = await ctx.params;

  // Fetch decision record
  const { data: decision, error: decErr } = await db
    .from("decision_records")
    .select("*")
    .eq("id", decisionId)
    .eq("organisation_id", organisationId)
    .single();

  if (decErr || !decision) return apiError("Decision not found", 404);

  // Idempotent: if already anchored, return existing details
  if (decision.chain_status === "anchored") {
    return new Response(JSON.stringify({
      event_hash: decision.event_hash,
      chain_tx_hash: decision.chain_tx_hash,
      chain_status: decision.chain_status,
      anchored_at: decision.anchored_at,
    }), { status: 200, headers: { "content-type": "application/json" } });
  }

  // Fetch linked output and policy version for hashing
  const { data: output } = await db
    .from("ai_outputs")
    .select("output_hash")
    .eq("id", decision.ai_output_id)
    .single();

  const { data: policyVersion } = await db
    .from("policy_versions")
    .select("policy_hash")
    .eq("id", decision.policy_version_id)
    .single();

  if (!output || !policyVersion) {
    return apiError("Cannot resolve linked output or policy version", 500);
  }

  // Build canonical hash payload
  const payload = {
    decision_id: decision.id,
    organisation_id: decision.organisation_id,
    system_id: decision.system_id,
    ai_output_id: decision.ai_output_id,
    output_hash: output.output_hash,
    policy_version_id: decision.policy_version_id,
    policy_hash: policyVersion.policy_hash,
    human_reviewer_id: decision.human_reviewer_id,
    review_mode: decision.review_mode,
    human_decision: decision.human_decision,
    human_rationale_hash: decision.human_rationale ? hashPayload({ text: decision.human_rationale }) : null,
    reviewed_at: decision.reviewed_at,
    created_at: decision.created_at,
    assurance_grade: decision.assurance_grade,
    oversight_mode: decision.oversight_mode,
  };

  const eventHash = hashPayload(payload);
  // Value-slice Phase 4: only Verify (enterprise) triggers on-chain anchoring.
  // API-key path is already Verify-gated by authenticateApiKey above, so it's
  // safe to treat the API-key branch as enterprise. Session path uses the
  // authenticated user's actual plan.
  const chainPlan = sessionAuth.error ? "enterprise" : sessionAuth.plan;
  const chainResult = await anchorOnChain(eventHash, chainPlan);
  const now = new Date().toISOString();

  const update: Record<string, unknown> = {
    event_hash: eventHash,
    chain_tx_hash: chainResult.txHash,
    chain_status: chainResult.status,
  };

  if (chainResult.status === "anchored") {
    update.anchored_at = now;
    update.decision_status = "anchored";
  } else if (chainResult.status === "failed") {
    update.decision_status = "failed";
  }

  const { error: updateErr } = await db
    .from("decision_records")
    .update(update)
    .eq("id", decisionId);

  if (updateErr) return apiError(updateErr.message, 500);

  await writeAuditLog({
    organisationId,
    entityType: "decision",
    entityId: decisionId,
    actionType: "anchored",
    performedBy: userId || apiKeyId!,
    metadata: { event_hash: eventHash, chain_status: chainResult.status },
  });

  return new Response(JSON.stringify({
    event_hash: eventHash,
    chain_tx_hash: chainResult.txHash,
    chain_status: chainResult.status,
    anchored_at: chainResult.status === "anchored" ? now : null,
  }), { status: 200, headers: { "content-type": "application/json" } });
}
