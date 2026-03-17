import { NextRequest, NextResponse } from "next/server";
import { resolveAuth } from "@/lib/resolveAuth";
import { supabaseServer } from "@/lib/supabaseServer";
import { writeAuditLog } from "@/lib/audit";

type Ctx = { params: Promise<{ decisionId: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const auth = await resolveAuth(req, "Verify", "decisions:read");
  if (!auth.authorized) return auth.response;

  const { decisionId } = await ctx.params;
  const db = supabaseServer();

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
    .eq("organisation_id", auth.organisationId)
    .single();

  if (error || !data) return NextResponse.json({ error: "Decision not found" }, { status: 404 });

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

  return NextResponse.json({ ...data, model });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const auth = await resolveAuth(req, "Verify", "decisions:write");
  if (!auth.authorized) return auth.response;

  const { decisionId } = await ctx.params;
  const body = await req.json();
  const db = supabaseServer();

  // Fetch current record
  const { data: current, error: fetchErr } = await db
    .from("decision_records")
    .select("*")
    .eq("id", decisionId)
    .eq("organisation_id", auth.organisationId)
    .single();

  if (fetchErr || !current) return NextResponse.json({ error: "Decision not found" }, { status: 404 });

  if (current.chain_status === "anchored") {
    return NextResponse.json({ error: "Cannot update an anchored decision" }, { status: 400 });
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
      update.human_reviewer_id = auth.userId;
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { data, error } = await db
    .from("decision_records")
    .update(update)
    .eq("id", decisionId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAuditLog({
    organisationId: auth.organisationId,
    entityType: "decision",
    entityId: decisionId,
    actionType: "status_change",
    performedBy: auth.userId || auth.apiKeyId!,
    metadata: { updated_fields: Object.keys(update) },
  });

  return NextResponse.json(data);
}
