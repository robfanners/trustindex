import { NextRequest } from "next/server";
import { requireAuth, apiError, apiOk } from "@/lib/apiHelpers";
import { hashPayload, anchorOnChain } from "@/lib/prove/chain";
import { createApprovalSchema, approvalDecisionSchema, firstZodError } from "@/lib/validations";
import { writeAuditLog } from "@/lib/audit";
import { hasTierAccess } from "@/lib/tiers";

// ---------------------------------------------------------------------------
// GET /api/prove/approvals — list approvals for the user's org
// ---------------------------------------------------------------------------
// Query params: status, risk_level, page, per_page

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;
    if (!hasTierAccess(auth.plan, "Verify")) {
      return apiError("Plan upgrade required", 403);
    }

    const db = auth.db;
    const params = req.nextUrl.searchParams;

    const status = params.get("status") || "";
    const riskLevel = params.get("risk_level") || "";
    const page = Math.max(1, Number(params.get("page") || 1));
    const perPage = Math.min(100, Math.max(1, Number(params.get("per_page") || 20)));
    const offset = (page - 1) * perPage;

    let query = db
      .from("prove_approvals")
      .select("*", { count: "exact" })
      .eq("organisation_id", auth.orgId)
      .order("created_at", { ascending: false })
      .range(offset, offset + perPage - 1);

    if (status) query = query.eq("status", status);
    if (riskLevel) query = query.eq("risk_level", riskLevel);

    const { data, count, error } = await query;
    if (error) return apiError(error.message, 500);

    return apiOk({ approvals: data ?? [], total: count ?? 0 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return apiError(message, 500);
  }
}

// ---------------------------------------------------------------------------
// POST /api/prove/approvals — create a new approval request
// ---------------------------------------------------------------------------
// Body: { title, description?, risk_level?, assigned_to? }

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;
    if (!hasTierAccess(auth.plan, "Verify")) {
      return apiError("Plan upgrade required", 403);
    }

    const db = auth.db;
    const body = await req.json();
    const parsed = createApprovalSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(firstZodError(parsed.error), 400);
    }
    const { title, description, risk_level, assigned_to } = parsed.data;

    const { data, error } = await db
      .from("prove_approvals")
      .insert({
        organisation_id: auth.orgId,
        title,
        description: description || null,
        risk_level: risk_level || "medium",
        requested_by: auth.user.id,
        assigned_to: assigned_to || null,
      })
      .select()
      .single();

    if (error) return apiError(error.message, 500);

    await writeAuditLog({
      organisationId: auth.orgId,
      entityType: "approval",
      entityId: data.id,
      actionType: "created",
      performedBy: auth.user.id,
      metadata: { title, risk_level: risk_level || "medium" },
    });

    return apiOk(data, 201);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return apiError(message, 500);
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/prove/approvals — decide (approve/reject) an approval
// ---------------------------------------------------------------------------
// Body: { approval_id, decision: "approved"|"rejected", decision_note? }

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;
    if (!hasTierAccess(auth.plan, "Verify")) {
      return apiError("Plan upgrade required", 403);
    }

    const db = auth.db;
    const body = await req.json();

    const parsed = approvalDecisionSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(firstZodError(parsed.error), 400);
    }
    const { approval_id, decision, decision_note } = parsed.data;

    // Verify the approval belongs to this org and is pending
    const { data: existing } = await db
      .from("prove_approvals")
      .select("id, status, title, risk_level")
      .eq("id", approval_id)
      .eq("organisation_id", auth.orgId)
      .single();

    if (!existing) return apiError("Approval not found", 404);
    if (existing.status !== "pending") {
      return apiError("Approval is not pending", 400);
    }

    // Compute event hash for the decision
    const eventHash = hashPayload({
      type: "approval_decision",
      approval_id,
      decision,
      decided_by: auth.user.id,
      decided_at: new Date().toISOString(),
      title: existing.title,
      risk_level: existing.risk_level,
    });

    // Attempt chain anchoring — only Verify (enterprise) plans anchor.
    // Returns "skipped" for non-enterprise or when chain env not configured.
    const chainResult = await anchorOnChain(eventHash, auth.plan);

    const { data, error } = await db
      .from("prove_approvals")
      .update({
        status: decision,
        decision_note: decision_note || null,
        decided_at: new Date().toISOString(),
        decided_by: auth.user.id,
        event_hash: eventHash,
        chain_tx_hash: chainResult.txHash,
        chain_status: chainResult.status,
      })
      .eq("id", approval_id)
      .select()
      .single();

    if (error) return apiError(error.message, 500);

    await writeAuditLog({
      organisationId: auth.orgId,
      entityType: "approval",
      entityId: approval_id,
      actionType: "decided",
      performedBy: auth.user.id,
      metadata: { decision, decision_note: decision_note || null },
    });

    return apiOk(data);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return apiError(message, 500);
  }
}
