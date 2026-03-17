import { NextRequest, NextResponse } from "next/server";
import { resolveAuth } from "@/lib/resolveAuth";
import { supabaseServer } from "@/lib/supabaseServer";
import { hashPayload, generateVerificationId } from "@/lib/prove/chain";
import {
  createDecisionRecordSchema,
  createDecisionWithOutputSchema,
  apiIngestDecisionSchema,
  firstZodError,
} from "@/lib/validations";
import { writeAuditLog } from "@/lib/audit";
import { computeAssuranceGrade } from "@/lib/assuranceGrade";

export async function GET(req: NextRequest) {
  const auth = await resolveAuth(req, "Verify", "decisions:read");
  if (!auth.authorized) return auth.response;

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
  const sourceType = params.get("source_type");
  const assuranceGrade = params.get("assurance_grade");
  const oversightMode = params.get("oversight_mode");

  const db = supabaseServer();
  let query = db
    .from("decision_records")
    .select(
      "*, systems(name), profiles!decision_records_human_reviewer_id_fkey(full_name), policy_versions(title, version), ai_outputs(output_summary, output_type)",
      { count: "exact" }
    )
    .eq("organisation_id", auth.organisationId)
    .order("created_at", { ascending: false })
    .range(offset, offset + perPage - 1);

  if (systemId) query = query.eq("system_id", systemId);
  if (reviewerId) query = query.eq("human_reviewer_id", reviewerId);
  if (decisionStatus) query = query.eq("decision_status", decisionStatus);
  if (humanDecision) query = query.eq("human_decision", humanDecision);
  if (policyVersionId) query = query.eq("policy_version_id", policyVersionId);
  if (dateFrom) query = query.gte("reviewed_at", dateFrom);
  if (dateTo) query = query.lte("reviewed_at", dateTo);
  if (sourceType) query = query.eq("source_type", sourceType);
  if (assuranceGrade) query = query.eq("assurance_grade", assuranceGrade);
  if (oversightMode) query = query.eq("oversight_mode", oversightMode);

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ records: data ?? [], total: count ?? 0 });
}

export async function POST(req: NextRequest) {
  const auth = await resolveAuth(req, "Verify", "decisions:write");
  if (!auth.authorized) return auth.response;

  const body = await req.json();
  const db = supabaseServer();
  const now = new Date().toISOString();

  // ── API Key auth path ──────────────────────────────────────────────
  if (auth.source === "api_key") {
    const parsed = apiIngestDecisionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 400 });
    }
    const d = parsed.data;

    // Validate system belongs to org
    const { data: system, error: sysErr } = await db
      .from("systems")
      .select("id")
      .eq("id", d.system_id)
      .eq("organisation_id", auth.organisationId)
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
        .eq("organisation_id", auth.organisationId)
        .single();
      if (modErr || !model) {
        return NextResponse.json({ error: "Model not found in your organisation" }, { status: 404 });
      }
    }

    // Validate policy version
    const { data: pv, error: pvErr } = await db
      .from("policy_versions")
      .select("id, status")
      .eq("id", d.policy_version_id)
      .eq("organisation_id", auth.organisationId)
      .single();
    if (pvErr || !pv) {
      return NextResponse.json({ error: "Policy version not found in your organisation" }, { status: 404 });
    }
    if (pv.status !== "active") {
      return NextResponse.json({ error: "Policy version must be active" }, { status: 400 });
    }

    // Create AI output
    const outputHash = d.output_hash || hashPayload({ output_summary: d.output_summary, occurred_at: d.occurred_at });

    const { data: output, error: outErr } = await db
      .from("ai_outputs")
      .insert({
        organisation_id: auth.organisationId,
        system_id: d.system_id,
        model_id: d.model_id || null,
        source_type: "api",
        external_event_id: d.external_event_id || null,
        output_hash: outputHash,
        output_summary: d.output_summary,
        output_type: d.output_type || null,
        confidence_score: d.confidence_score ?? null,
        risk_signal: d.risk_signal || null,
        occurred_at: d.occurred_at,
        created_by: null,
        api_key_id: auth.apiKeyId,
        context: d.context || null,
      })
      .select()
      .single();

    if (outErr || !output) {
      return NextResponse.json({ error: outErr?.message || "Failed to create output" }, { status: 500 });
    }

    // Compute assurance grade
    const grade = d.human_decision
      ? computeAssuranceGrade({
          source_type: "api",
          review_mode: d.review_mode,
          identity_assurance_level: d.identity_assurance?.level,
          action_binding_level: d.action_binding?.level,
          external_reviewer_email: d.identity_assurance?.reviewer_email,
          external_reviewed_at: d.action_binding?.reviewed_at,
        })
      : null;

    // Determine status
    const isPendingReview = !d.human_decision;
    const decisionStatus = isPendingReview ? "pending_review" : "review_completed";
    const reviewedAt = isPendingReview ? null : (d.action_binding?.reviewed_at || now);

    const verificationId = generateVerificationId({
      type: "decision",
      org: auth.organisationId,
      system_id: d.system_id,
      output_id: output.id,
      policy_version_id: d.policy_version_id,
      reviewer: d.identity_assurance?.reviewer_email || "api",
      reviewed_at: reviewedAt || now,
    });

    const { data: decision, error: decErr } = await db
      .from("decision_records")
      .insert({
        organisation_id: auth.organisationId,
        system_id: d.system_id,
        ai_output_id: output.id,
        policy_version_id: d.policy_version_id,
        human_reviewer_id: null,
        created_by: null,
        source_type: "api",
        review_mode: d.review_mode,
        decision_status: decisionStatus,
        human_decision: d.human_decision || null,
        human_rationale: d.human_rationale || null,
        reviewed_at: reviewedAt,
        verification_id: verificationId,
        chain_status: "pending",
        oversight_mode: d.oversight_mode,
        assurance_grade: grade,
        api_key_id: auth.apiKeyId,
        external_reviewer_email: d.identity_assurance?.reviewer_email || null,
        external_reviewer_name: d.identity_assurance?.reviewer_name || null,
        external_reviewed_at: d.action_binding?.reviewed_at || null,
        identity_assurance_level: d.identity_assurance?.level || null,
        identity_assurance_method: d.identity_assurance?.method || null,
        action_binding_level: d.action_binding?.level || null,
        action_binding_method: d.action_binding?.method || null,
      })
      .select()
      .single();

    if (decErr) return NextResponse.json({ error: decErr.message }, { status: 500 });

    await writeAuditLog({
      organisationId: auth.organisationId,
      entityType: "decision",
      entityId: decision.id,
      actionType: "created",
      performedBy: auth.apiKeyId!,
      metadata: {
        source: "api",
        system_id: d.system_id,
        human_decision: d.human_decision || null,
        assurance_grade: grade,
        oversight_mode: d.oversight_mode,
        verification_id: verificationId,
      },
    });

    return NextResponse.json({
      id: decision.id,
      verification_id: verificationId,
      assurance_grade: grade,
      decision_status: decisionStatus,
      chain_status: "pending",
      oversight_mode: d.oversight_mode,
      created_at: decision.created_at,
    }, { status: 201 });
  }

  // ── Session auth path (existing behaviour, extended) ───────────────
  let aiOutputId: string;
  let systemId: string;

  if (body.ai_output_id) {
    const parsed = createDecisionRecordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 400 });
    }
    aiOutputId = parsed.data.ai_output_id;

    const { data: output, error: outErr } = await db
      .from("ai_outputs")
      .select("id, system_id, organisation_id")
      .eq("id", aiOutputId)
      .single();
    if (outErr || !output) {
      return NextResponse.json({ error: "AI output not found" }, { status: 404 });
    }
    if (output.organisation_id !== auth.organisationId) {
      return NextResponse.json({ error: "AI output does not belong to your organisation" }, { status: 403 });
    }
    systemId = output.system_id;
  } else {
    const parsed = createDecisionWithOutputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 400 });
    }
    const d = parsed.data;

    const { data: system, error: sysErr } = await db
      .from("systems")
      .select("id")
      .eq("id", d.system_id)
      .eq("organisation_id", auth.organisationId)
      .single();
    if (sysErr || !system) {
      return NextResponse.json({ error: "System not found in your organisation" }, { status: 404 });
    }

    if (d.model_id) {
      const { data: model, error: modErr } = await db
        .from("model_registry")
        .select("id")
        .eq("id", d.model_id)
        .eq("organisation_id", auth.organisationId)
        .single();
      if (modErr || !model) {
        return NextResponse.json({ error: "Model not found in your organisation" }, { status: 404 });
      }
    }

    const outputHash = d.output_hash || hashPayload({ output_summary: d.output_summary, occurred_at: d.occurred_at });

    const { data: output, error: outErr } = await db
      .from("ai_outputs")
      .insert({
        organisation_id: auth.organisationId,
        system_id: d.system_id,
        model_id: d.model_id || null,
        source_type: "manual",
        output_hash: outputHash,
        output_summary: d.output_summary,
        output_type: d.output_type || null,
        confidence_score: d.confidence_score ?? null,
        risk_signal: d.risk_signal || null,
        occurred_at: d.occurred_at,
        created_by: auth.userId,
      })
      .select()
      .single();

    if (outErr || !output) {
      return NextResponse.json({ error: outErr?.message || "Failed to create output" }, { status: 500 });
    }
    aiOutputId = output.id;
    systemId = d.system_id;
  }

  const policyVersionId = body.policy_version_id;
  const { data: pv, error: pvErr } = await db
    .from("policy_versions")
    .select("id, status")
    .eq("id", policyVersionId)
    .eq("organisation_id", auth.organisationId)
    .single();
  if (pvErr || !pv) {
    return NextResponse.json({ error: "Policy version not found in your organisation" }, { status: 404 });
  }
  if (pv.status !== "active") {
    return NextResponse.json({ error: "Policy version must be active" }, { status: 400 });
  }

  const verificationId = generateVerificationId({
    type: "decision",
    org: auth.organisationId,
    system_id: systemId,
    output_id: aiOutputId,
    policy_version_id: policyVersionId,
    reviewer: auth.userId,
    reviewed_at: now,
  });

  const { data: decision, error: decErr } = await db
    .from("decision_records")
    .insert({
      organisation_id: auth.organisationId,
      system_id: systemId,
      ai_output_id: aiOutputId,
      policy_version_id: policyVersionId,
      human_reviewer_id: auth.userId,
      created_by: auth.userId,
      source_type: "manual",
      review_mode: body.review_mode,
      decision_status: "review_completed",
      human_decision: body.human_decision,
      human_rationale: body.human_rationale || null,
      reviewed_at: now,
      verification_id: verificationId,
      chain_status: "pending",
      oversight_mode: body.oversight_mode || "in_the_loop",
      assurance_grade: "silver",
    })
    .select()
    .single();

  if (decErr) return NextResponse.json({ error: decErr.message }, { status: 500 });

  await writeAuditLog({
    organisationId: auth.organisationId,
    entityType: "decision",
    entityId: decision.id,
    actionType: "created",
    performedBy: auth.userId!,
    metadata: { source: "manual", system_id: systemId, human_decision: body.human_decision, verification_id: verificationId },
  });

  return NextResponse.json(decision, { status: 201 });
}
