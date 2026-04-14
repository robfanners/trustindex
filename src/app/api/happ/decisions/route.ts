import { NextRequest } from "next/server";
import { requireAuth, apiError, apiOk } from "@/lib/apiHelpers";
import { authenticateApiKey } from "@/lib/apiKeyAuth";
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
  // Try session auth first, then API key
  // NOTE: GET only needs organisationId; user/apiKey identity reserved for future audit logging (TG-XX)
  const sessionAuth = await requireAuth({ orgOptional: false });
  let organisationId: string;

  if (!sessionAuth.error) {
    organisationId = sessionAuth.orgId;
  } else {
    // Try API key
    const apiKeyAuth = await authenticateApiKey(req, "Verify", "decisions:read");
    if (!apiKeyAuth) {
      return apiError("Not authenticated", 401);
    }
    organisationId = apiKeyAuth.organisationId;
  }

  const { supabaseServer } = await import("@/lib/supabase/admin");
  const db = sessionAuth.error ? supabaseServer() : sessionAuth.db;

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

  let query = db
    .from("decision_records")
    .select(
      "*, systems(name), profiles!decision_records_human_reviewer_id_fkey(full_name), policy_versions(title, version), ai_outputs(output_summary, output_type)",
      { count: "exact" }
    )
    .eq("organisation_id", organisationId)
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
  if (error) return apiError(error.message, 500);
  return apiOk({ records: data ?? [], total: count ?? 0 });
}

export async function POST(req: NextRequest) {
  // Try session auth first, then API key
  const sessionAuth = await requireAuth({ orgOptional: false });
  let authSource: "session" | "api_key";
  let organisationId: string;
  let userId: string | null;
  let apiKeyId: string | null;

  if (!sessionAuth.error) {
    authSource = "session";
    organisationId = sessionAuth.orgId;
    userId = sessionAuth.user.id;
    apiKeyId = null;
  } else {
    // Try API key
    const apiKeyAuth = await authenticateApiKey(req, "Verify", "decisions:write");
    if (!apiKeyAuth) {
      return apiError("Not authenticated", 401);
    }
    authSource = "api_key";
    organisationId = apiKeyAuth.organisationId;
    userId = null;
    apiKeyId = apiKeyAuth.apiKeyId;
  }

  const { supabaseServer } = await import("@/lib/supabase/admin");
  const body = await req.json();
  const db = sessionAuth.error ? supabaseServer() : sessionAuth.db;
  const now = new Date().toISOString();

  // ── API Key auth path ──────────────────────────────────────────────
  if (authSource === "api_key") {
    const parsed = apiIngestDecisionSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(firstZodError(parsed.error), 400);
    }
    const d = parsed.data;

    // Validate system belongs to org
    const { data: system, error: sysErr } = await db
      .from("systems")
      .select("id")
      .eq("id", d.system_id)
      .eq("organisation_id", organisationId)
      .single();
    if (sysErr || !system) {
      return apiError("System not found in your organisation", 404);
    }

    // Validate model if provided
    if (d.model_id) {
      const { data: model, error: modErr } = await db
        .from("model_registry")
        .select("id")
        .eq("id", d.model_id)
        .eq("organisation_id", organisationId)
        .single();
      if (modErr || !model) {
        return apiError("Model not found in your organisation", 404);
      }
    }

    // Validate policy version
    const { data: pv, error: pvErr } = await db
      .from("policy_versions")
      .select("id, status")
      .eq("id", d.policy_version_id)
      .eq("organisation_id", organisationId)
      .single();
    if (pvErr || !pv) {
      return apiError("Policy version not found in your organisation", 404);
    }
    if (pv.status !== "active") {
      return apiError("Policy version must be active", 400);
    }

    // Create AI output
    const outputHash = d.output_hash || hashPayload({ output_summary: d.output_summary, occurred_at: d.occurred_at });

    const { data: output, error: outErr } = await db
      .from("ai_outputs")
      .insert({
        organisation_id: organisationId,
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
        api_key_id: apiKeyId,
        context: d.context || null,
      })
      .select()
      .single();

    if (outErr || !output) {
      return apiError(outErr?.message || "Failed to create output", 500);
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
      org: organisationId,
      system_id: d.system_id,
      output_id: output.id,
      policy_version_id: d.policy_version_id,
      reviewer: d.identity_assurance?.reviewer_email || "api",
      reviewed_at: reviewedAt || now,
    });

    const { data: decision, error: decErr } = await db
      .from("decision_records")
      .insert({
        organisation_id: organisationId,
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
        api_key_id: apiKeyId,
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

    if (decErr) return apiError(decErr.message, 500);

    await writeAuditLog({
      organisationId,
      entityType: "decision",
      entityId: decision.id,
      actionType: "created",
      performedBy: apiKeyId!,
      metadata: {
        source: "api",
        system_id: d.system_id,
        human_decision: d.human_decision || null,
        assurance_grade: grade,
        oversight_mode: d.oversight_mode,
        verification_id: verificationId,
      },
    });

    return apiOk({
      id: decision.id,
      verification_id: verificationId,
      assurance_grade: grade,
      decision_status: decisionStatus,
      chain_status: "pending",
      oversight_mode: d.oversight_mode,
      created_at: decision.created_at,
    }, 201);
  }

  // ── Session auth path (existing behaviour, extended) ───────────────
  let aiOutputId: string;
  let systemId: string;

  if (body.ai_output_id) {
    const parsed = createDecisionRecordSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(firstZodError(parsed.error), 400);
    }
    aiOutputId = parsed.data.ai_output_id;

    const { data: output, error: outErr } = await db
      .from("ai_outputs")
      .select("id, system_id, organisation_id")
      .eq("id", aiOutputId)
      .single();
    if (outErr || !output) {
      return apiError("AI output not found", 404);
    }
    if (output.organisation_id !== organisationId) {
      return apiError("AI output does not belong to your organisation", 403);
    }
    systemId = output.system_id;
  } else {
    const parsed = createDecisionWithOutputSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(firstZodError(parsed.error), 400);
    }
    const d = parsed.data;

    const { data: system, error: sysErr } = await db
      .from("systems")
      .select("id")
      .eq("id", d.system_id)
      .eq("organisation_id", organisationId)
      .single();
    if (sysErr || !system) {
      return apiError("System not found in your organisation", 404);
    }

    if (d.model_id) {
      const { data: model, error: modErr } = await db
        .from("model_registry")
        .select("id")
        .eq("id", d.model_id)
        .eq("organisation_id", organisationId)
        .single();
      if (modErr || !model) {
        return apiError("Model not found in your organisation", 404);
      }
    }

    const outputHash = d.output_hash || hashPayload({ output_summary: d.output_summary, occurred_at: d.occurred_at });

    const { data: output, error: outErr } = await db
      .from("ai_outputs")
      .insert({
        organisation_id: organisationId,
        system_id: d.system_id,
        model_id: d.model_id || null,
        source_type: "manual",
        output_hash: outputHash,
        output_summary: d.output_summary,
        output_type: d.output_type || null,
        confidence_score: d.confidence_score ?? null,
        risk_signal: d.risk_signal || null,
        occurred_at: d.occurred_at,
        created_by: userId,
      })
      .select()
      .single();

    if (outErr || !output) {
      return apiError(outErr?.message || "Failed to create output", 500);
    }
    aiOutputId = output.id;
    systemId = d.system_id;
  }

  const policyVersionId = body.policy_version_id;
  const { data: pv, error: pvErr } = await db
    .from("policy_versions")
    .select("id, status")
    .eq("id", policyVersionId)
    .eq("organisation_id", organisationId)
    .single();
  if (pvErr || !pv) {
    return apiError("Policy version not found in your organisation", 404);
  }
  if (pv.status !== "active") {
    return apiError("Policy version must be active", 400);
  }

  const verificationId = generateVerificationId({
    type: "decision",
    org: organisationId,
    system_id: systemId,
    output_id: aiOutputId,
    policy_version_id: policyVersionId,
    reviewer: userId,
    reviewed_at: now,
  });

  const { data: decision, error: decErr } = await db
    .from("decision_records")
    .insert({
      organisation_id: organisationId,
      system_id: systemId,
      ai_output_id: aiOutputId,
      policy_version_id: policyVersionId,
      human_reviewer_id: userId,
      created_by: userId,
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

  if (decErr) return apiError(decErr.message, 500);

  await writeAuditLog({
    organisationId,
    entityType: "decision",
    entityId: decision.id,
    actionType: "created",
    performedBy: userId!,
    metadata: { source: "manual", system_id: systemId, human_decision: body.human_decision, verification_id: verificationId },
  });

  return apiOk(decision, 201);
}
