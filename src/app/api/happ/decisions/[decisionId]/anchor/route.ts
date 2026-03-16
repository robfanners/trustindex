import { NextRequest, NextResponse } from "next/server";
import { requireTier } from "@/lib/requireTier";
import { supabaseServer } from "@/lib/supabaseServer";
import { hashPayload, anchorOnChain } from "@/lib/prove/chain";
import { writeAuditLog } from "@/lib/audit";

type Ctx = { params: Promise<{ decisionId: string }> };

export async function POST(_req: NextRequest, ctx: Ctx) {
  const check = await requireTier("Verify");
  if (!check.authorized) return check.response;
  if (!check.orgId) return NextResponse.json({ error: "No organisation linked" }, { status: 400 });

  const { decisionId } = await ctx.params;
  const db = supabaseServer();

  // Fetch decision record
  const { data: decision, error: decErr } = await db
    .from("decision_records")
    .select("*")
    .eq("id", decisionId)
    .eq("organisation_id", check.orgId)
    .single();

  if (decErr || !decision) return NextResponse.json({ error: "Decision not found" }, { status: 404 });

  // Idempotent: if already anchored, return existing details
  if (decision.chain_status === "anchored") {
    return NextResponse.json({
      event_hash: decision.event_hash,
      chain_tx_hash: decision.chain_tx_hash,
      chain_status: decision.chain_status,
      anchored_at: decision.anchored_at,
    });
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
    return NextResponse.json({ error: "Cannot resolve linked output or policy version" }, { status: 500 });
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
  };

  const eventHash = hashPayload(payload);
  const chainResult = await anchorOnChain(eventHash);
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

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  await writeAuditLog({
    organisationId: check.orgId,
    entityType: "decision",
    entityId: decisionId,
    actionType: "anchored",
    performedBy: check.userId,
    metadata: { event_hash: eventHash, chain_status: chainResult.status },
  });

  return NextResponse.json({
    event_hash: eventHash,
    chain_tx_hash: chainResult.txHash,
    chain_status: chainResult.status,
    anchored_at: chainResult.status === "anchored" ? now : null,
  });
}
