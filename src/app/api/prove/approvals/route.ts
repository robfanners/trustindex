import { NextRequest, NextResponse } from "next/server";
import { requireTier } from "@/lib/requireTier";
import { supabaseServer } from "@/lib/supabaseServer";
import { hashPayload, anchorOnChain } from "@/lib/prove/chain";
import { createApprovalSchema, approvalDecisionSchema, firstZodError } from "@/lib/validations";

// ---------------------------------------------------------------------------
// Helper: authenticate + check Verify tier + get org_id
// ---------------------------------------------------------------------------

async function getAuthenticatedOrg() {
  const check = await requireTier("Verify");
  if (!check.authorized) {
    return { error: check.response };
  }

  if (!check.orgId) {
    return { error: NextResponse.json({ error: "No organisation linked" }, { status: 400 }) };
  }

  return { user: { id: check.userId }, orgId: check.orgId };
}

// ---------------------------------------------------------------------------
// GET /api/prove/approvals — list approvals for the user's org
// ---------------------------------------------------------------------------
// Query params: status, risk_level, page, per_page

export async function GET(req: NextRequest) {
  try {
    const result = await getAuthenticatedOrg();
    if ("error" in result) return result.error;

    const { orgId } = result;
    const db = supabaseServer();
    const params = req.nextUrl.searchParams;

    const status = params.get("status") || "";
    const riskLevel = params.get("risk_level") || "";
    const page = Math.max(1, Number(params.get("page") || 1));
    const perPage = Math.min(100, Math.max(1, Number(params.get("per_page") || 20)));
    const offset = (page - 1) * perPage;

    let query = db
      .from("prove_approvals")
      .select("*", { count: "exact" })
      .eq("organisation_id", orgId)
      .order("created_at", { ascending: false })
      .range(offset, offset + perPage - 1);

    if (status) query = query.eq("status", status);
    if (riskLevel) query = query.eq("risk_level", riskLevel);

    const { data, count, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ approvals: data ?? [], total: count ?? 0 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/prove/approvals — create a new approval request
// ---------------------------------------------------------------------------
// Body: { title, description?, risk_level?, assigned_to? }

export async function POST(req: NextRequest) {
  try {
    const result = await getAuthenticatedOrg();
    if ("error" in result) return result.error;

    const { user, orgId } = result;
    const db = supabaseServer();
    const body = await req.json();
    const parsed = createApprovalSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 400 });
    }
    const { title, description, risk_level, assigned_to } = parsed.data;

    const { data, error } = await db
      .from("prove_approvals")
      .insert({
        organisation_id: orgId,
        title,
        description: description || null,
        risk_level: risk_level || "medium",
        requested_by: user.id,
        assigned_to: assigned_to || null,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/prove/approvals — decide (approve/reject) an approval
// ---------------------------------------------------------------------------
// Body: { approval_id, decision: "approved"|"rejected", decision_note? }

export async function PATCH(req: NextRequest) {
  try {
    const result = await getAuthenticatedOrg();
    if ("error" in result) return result.error;

    const { user, orgId } = result;
    const db = supabaseServer();
    const body = await req.json();

    const parsed = approvalDecisionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 400 });
    }
    const { approval_id, decision, decision_note } = parsed.data;

    // Verify the approval belongs to this org and is pending
    const { data: existing } = await db
      .from("prove_approvals")
      .select("id, status, title, risk_level")
      .eq("id", approval_id)
      .eq("organisation_id", orgId)
      .single();

    if (!existing) return NextResponse.json({ error: "Approval not found" }, { status: 404 });
    if (existing.status !== "pending") {
      return NextResponse.json({ error: "Approval is not pending" }, { status: 400 });
    }

    // Compute event hash for the decision
    const eventHash = hashPayload({
      type: "approval_decision",
      approval_id,
      decision,
      decided_by: user.id,
      decided_at: new Date().toISOString(),
      title: existing.title,
      risk_level: existing.risk_level,
    });

    // Attempt chain anchoring (returns "skipped" if chain not configured)
    const chainResult = await anchorOnChain(eventHash);

    const { data, error } = await db
      .from("prove_approvals")
      .update({
        status: decision,
        decision_note: decision_note || null,
        decided_at: new Date().toISOString(),
        decided_by: user.id,
        event_hash: eventHash,
        chain_tx_hash: chainResult.txHash,
        chain_status: chainResult.status,
      })
      .eq("id", approval_id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
