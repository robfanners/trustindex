import { NextRequest, NextResponse } from "next/server";
import { requireTier } from "@/lib/requireTier";
import { supabaseServer } from "@/lib/supabaseServer";
import { hashPayload, generateVerificationId } from "@/lib/prove/chain";
import { createDecisionRecordSchema, createDecisionWithOutputSchema, firstZodError } from "@/lib/validations";
import { writeAuditLog } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const check = await requireTier("Verify");
  if (!check.authorized) return check.response;
  if (!check.orgId) return NextResponse.json({ error: "No organisation linked" }, { status: 400 });

  const params = req.nextUrl.searchParams;
  const page = Math.max(1, Number(params.get("page") || 1));
  const perPage = Math.min(100, Math.max(1, Number(params.get("per_page") || 20)));
  const offset = (page - 1) * perPage;

  const systemId = params.get("system_id");
  const reviewerId = params.get("reviewer_id");
  const decisionStatus = params.get("decision_status");
  const humanDecision = params.get("human_decision");
  const policyVersionId = params.get("policy_version_id");
  const dateFrom = params.get("date_from");
  const dateTo = params.get("date_to");

  const db = supabaseServer();
  let query = db
    .from("decision_records")
    .select(
      "*, systems(name), profiles!decision_records_human_reviewer_id_fkey(full_name), policy_versions(title, version), ai_outputs(output_summary, output_type)",
      { count: "exact" }
    )
    .eq("organisation_id", check.orgId)
    .order("created_at", { ascending: false })
    .range(offset, offset + perPage - 1);

  if (systemId) query = query.eq("system_id", systemId);
  if (reviewerId) query = query.eq("human_reviewer_id", reviewerId);
  if (decisionStatus) query = query.eq("decision_status", decisionStatus);
  if (humanDecision) query = query.eq("human_decision", humanDecision);
  if (policyVersionId) query = query.eq("policy_version_id", policyVersionId);
  if (dateFrom) query = query.gte("reviewed_at", dateFrom);
  if (dateTo) query = query.lte("reviewed_at", dateTo);

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ records: data ?? [], total: count ?? 0 });
}

export async function POST(req: NextRequest) {
  const check = await requireTier("Verify");
  if (!check.authorized) return check.response;
  if (!check.orgId) return NextResponse.json({ error: "No organisation linked" }, { status: 400 });

  const body = await req.json();
  const db = supabaseServer();
  const now = new Date().toISOString();

  let aiOutputId: string;
  let systemId: string;

  if (body.ai_output_id) {
    // Mode 1: existing output
    const parsed = createDecisionRecordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 400 });
    }
    aiOutputId = parsed.data.ai_output_id;

    // Fetch and validate output belongs to org
    const { data: output, error: outErr } = await db
      .from("ai_outputs")
      .select("id, system_id, organisation_id")
      .eq("id", aiOutputId)
      .single();
    if (outErr || !output) {
      return NextResponse.json({ error: "AI output not found" }, { status: 404 });
    }
    if (output.organisation_id !== check.orgId) {
      return NextResponse.json({ error: "AI output does not belong to your organisation" }, { status: 403 });
    }
    systemId = output.system_id;
  } else {
    // Mode 2: inline output creation
    const parsed = createDecisionWithOutputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 400 });
    }
    const d = parsed.data;

    // Validate system belongs to org
    const { data: system, error: sysErr } = await db
      .from("systems")
      .select("id")
      .eq("id", d.system_id)
      .eq("organisation_id", check.orgId)
      .single();
    if (sysErr || !system) {
      return NextResponse.json({ error: "System not found in your organisation" }, { status: 404 });
    }

    // Validate model if provided
    if (d.model_id) {
      const { data: model, error: modErr } = await db
        .from("model_registry")
        .select("id")
        .eq("id", d.model_id)
        .eq("organisation_id", check.orgId)
        .single();
      if (modErr || !model) {
        return NextResponse.json({ error: "Model not found in your organisation" }, { status: 404 });
      }
    }

    const outputHash = d.output_hash || hashPayload({ output_summary: d.output_summary, occurred_at: d.occurred_at });

    const { data: output, error: outErr } = await db
      .from("ai_outputs")
      .insert({
        organisation_id: check.orgId,
        system_id: d.system_id,
        model_id: d.model_id || null,
        source_type: "manual",
        output_hash: outputHash,
        output_summary: d.output_summary,
        output_type: d.output_type || null,
        confidence_score: d.confidence_score ?? null,
        risk_signal: d.risk_signal || null,
        occurred_at: d.occurred_at,
        created_by: check.userId,
      })
      .select()
      .single();

    if (outErr || !output) {
      return NextResponse.json({ error: outErr?.message || "Failed to create output" }, { status: 500 });
    }
    aiOutputId = output.id;
    systemId = d.system_id;
  }

  // Validate policy version belongs to org and is active
  const policyVersionId = body.policy_version_id;
  const { data: pv, error: pvErr } = await db
    .from("policy_versions")
    .select("id, status")
    .eq("id", policyVersionId)
    .eq("organisation_id", check.orgId)
    .single();
  if (pvErr || !pv) {
    return NextResponse.json({ error: "Policy version not found in your organisation" }, { status: 404 });
  }
  if (pv.status !== "active") {
    return NextResponse.json({ error: "Policy version must be active" }, { status: 400 });
  }

  const verificationId = generateVerificationId({
    type: "decision",
    org: check.orgId,
    system_id: systemId,
    output_id: aiOutputId,
    policy_version_id: policyVersionId,
    reviewer: check.userId,
    reviewed_at: now,
  });

  const { data: decision, error: decErr } = await db
    .from("decision_records")
    .insert({
      organisation_id: check.orgId,
      system_id: systemId,
      ai_output_id: aiOutputId,
      policy_version_id: policyVersionId,
      human_reviewer_id: check.userId,
      created_by: check.userId,
      source_type: "manual",
      review_mode: body.review_mode,
      decision_status: "review_completed",
      human_decision: body.human_decision,
      human_rationale: body.human_rationale || null,
      reviewed_at: now,
      verification_id: verificationId,
      chain_status: "pending",
    })
    .select()
    .single();

  if (decErr) return NextResponse.json({ error: decErr.message }, { status: 500 });

  await writeAuditLog({
    organisationId: check.orgId,
    entityType: "decision",
    entityId: decision.id,
    actionType: "created",
    performedBy: check.userId,
    metadata: { system_id: systemId, human_decision: body.human_decision, verification_id: verificationId },
  });

  return NextResponse.json(decision, { status: 201 });
}
