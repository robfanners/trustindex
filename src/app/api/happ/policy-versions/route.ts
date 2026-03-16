import { NextRequest, NextResponse } from "next/server";
import { requireTier } from "@/lib/requireTier";
import { supabaseServer } from "@/lib/supabaseServer";
import { hashPayload } from "@/lib/prove/chain";
import { createPolicyVersionSchema, firstZodError } from "@/lib/validations";
import { writeAuditLog } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const check = await requireTier("Verify");
  if (!check.authorized) return check.response;
  if (!check.orgId) return NextResponse.json({ error: "No organisation linked" }, { status: 400 });

  const params = req.nextUrl.searchParams;
  const page = Math.max(1, Number(params.get("page") || 1));
  const perPage = Math.min(100, Math.max(1, Number(params.get("per_page") || 20)));
  const offset = (page - 1) * perPage;
  const policyId = params.get("policy_id");
  const status = params.get("status");

  const db = supabaseServer();
  let query = db
    .from("policy_versions")
    .select("*, ai_policies(title)", { count: "exact" })
    .eq("organisation_id", check.orgId)
    .order("created_at", { ascending: false })
    .range(offset, offset + perPage - 1);

  if (policyId) query = query.eq("policy_id", policyId);
  if (status) query = query.eq("status", status);

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ records: data ?? [], total: count ?? 0 });
}

export async function POST(req: NextRequest) {
  const check = await requireTier("Verify");
  if (!check.authorized) return check.response;
  if (!check.orgId) return NextResponse.json({ error: "No organisation linked" }, { status: 400 });

  const body = await req.json();
  const parsed = createPolicyVersionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 400 });
  }
  const { policy_id, title, content_snapshot, effective_from, effective_until } = parsed.data;

  const db = supabaseServer();

  // Validate policy belongs to org
  const { data: policy, error: policyErr } = await db
    .from("ai_policies")
    .select("id")
    .eq("id", policy_id)
    .eq("organisation_id", check.orgId)
    .single();
  if (policyErr || !policy) {
    return NextResponse.json({ error: "Policy not found in your organisation" }, { status: 404 });
  }

  // Auto-increment version
  const { data: maxRow } = await db
    .from("policy_versions")
    .select("version")
    .eq("policy_id", policy_id)
    .order("version", { ascending: false })
    .limit(1)
    .single();
  const nextVersion = (maxRow?.version ?? 0) + 1;

  const now = new Date().toISOString();
  const policyHash = hashPayload(content_snapshot as Record<string, unknown>);

  // Supersede previous active version for this policy
  await db
    .from("policy_versions")
    .update({ status: "superseded" })
    .eq("policy_id", policy_id)
    .eq("status", "active");

  const { data, error } = await db
    .from("policy_versions")
    .insert({
      organisation_id: check.orgId,
      policy_id,
      version: nextVersion,
      title,
      policy_hash: policyHash,
      content_snapshot,
      status: "active",
      effective_from: effective_from || null,
      effective_until: effective_until || null,
      published_by: check.userId,
      published_at: now,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Update superseded_by on previous version
  if (data) {
    await db
      .from("policy_versions")
      .update({ superseded_by: data.id })
      .eq("policy_id", policy_id)
      .eq("status", "superseded")
      .is("superseded_by", null);
  }

  await writeAuditLog({
    organisationId: check.orgId,
    entityType: "policy_version",
    entityId: data.id,
    actionType: "created",
    performedBy: check.userId,
    metadata: { title, version: nextVersion, policy_id },
  });

  return NextResponse.json(data, { status: 201 });
}
