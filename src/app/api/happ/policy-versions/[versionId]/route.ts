import { NextRequest, NextResponse } from "next/server";
import { requireAuth, checkTierAccess } from "@/lib/apiHelpers";
import { hashPayload } from "@/lib/prove/chain";
import { writeAuditLog } from "@/lib/audit";

type Ctx = { params: Promise<{ versionId: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const tierCheck = checkTierAccess(auth.plan, "Verify");
  if (tierCheck) return tierCheck;

  const { versionId } = await ctx.params;
  const db = auth.db;

  const { data, error } = await db
    .from("policy_versions")
    .select("*, ai_policies(policy_type)")
    .eq("id", versionId)
    .eq("organisation_id", auth.orgId)
    .single();

  if (error || !data) return NextResponse.json({ error: "Policy version not found" }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const tierCheck = checkTierAccess(auth.plan, "Verify");
  if (tierCheck) return tierCheck;

  const { versionId } = await ctx.params;
  const body = await req.json();
  const db = auth.db;

  // Fetch current version
  const { data: current, error: fetchErr } = await db
    .from("policy_versions")
    .select("*")
    .eq("id", versionId)
    .eq("organisation_id", auth.orgId)
    .single();

  if (fetchErr || !current) return NextResponse.json({ error: "Policy version not found" }, { status: 404 });

  // Build update payload based on current status
  const update: Record<string, unknown> = {};
  const now = new Date().toISOString();

  if (current.status === "draft") {
    // Allow field edits on drafts
    if (body.title !== undefined) update.title = body.title;
    if (body.content_snapshot !== undefined) update.content_snapshot = body.content_snapshot;
    if (body.effective_from !== undefined) update.effective_from = body.effective_from || null;
    if (body.effective_until !== undefined) update.effective_until = body.effective_until || null;

    // Draft → active transition
    if (body.status === "active") {
      const snapshot = body.content_snapshot ?? current.content_snapshot;
      update.status = "active";
      update.policy_hash = hashPayload(snapshot as Record<string, unknown>);
      update.published_at = now;
      update.published_by = auth.user.id;

      // Supersede previous active version
      await db
        .from("policy_versions")
        .update({ status: "superseded", superseded_by: versionId })
        .eq("policy_id", current.policy_id)
        .eq("status", "active");
    }
  } else if (current.status === "active") {
    // Allow lifecycle transitions from active
    if (body.status === "superseded" || body.status === "retired") {
      update.status = body.status;
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No valid updates for current status" }, { status: 400 });
  }

  const { data, error } = await db
    .from("policy_versions")
    .update(update)
    .eq("id", versionId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAuditLog({
    organisationId: auth.orgId,
    entityType: "policy_version",
    entityId: versionId,
    actionType: "status_change",
    performedBy: auth.user.id,
    metadata: { from: current.status, to: data.status },
  });

  return NextResponse.json(data);
}
