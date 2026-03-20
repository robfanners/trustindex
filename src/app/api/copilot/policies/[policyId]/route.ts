import { NextRequest } from "next/server";
import { requireAuth, apiOk, apiError, withErrorHandling, parseBody } from "@/lib/apiHelpers";
import { z } from "zod";

type RouteCtx = { params: Promise<{ policyId: string }> };

// ---------------------------------------------------------------------------
// GET — fetch single policy with linked systems count
// ---------------------------------------------------------------------------

export async function GET(_req: NextRequest, ctx: RouteCtx) {
  return withErrorHandling(async () => {
    const auth = await requireAuth();
    if (auth.error) return auth.error;
    const { orgId, db } = auth;
    const { policyId } = await ctx.params;

    const { data: policy, error } = await db
      .from("ai_policies")
      .select("*")
      .eq("id", policyId)
      .eq("organisation_id", orgId)
      .single();

    if (error || !policy) return apiError("Policy not found", 404);

    // Get linked systems count
    const { count } = await db
      .from("system_policy_links")
      .select("id", { count: "exact", head: true })
      .eq("policy_id", policyId);

    return apiOk({ policy, linked_systems_count: count ?? 0 });
  });
}

// ---------------------------------------------------------------------------
// PATCH — update policy with event logging + auto-actions
// ---------------------------------------------------------------------------

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().optional(),
  status: z.enum(["draft", "under_review", "active", "archived"]).optional(),
});

export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  return withErrorHandling(async () => {
    const auth = await requireAuth();
    if (auth.error) return auth.error;
    const { user, orgId, db } = auth;
    const { policyId } = await ctx.params;

    const parsed = await parseBody(req, updateSchema);
    if (parsed.error) return parsed.error;

    // Fetch current policy for comparison
    const { data: current } = await db
      .from("ai_policies")
      .select("status, title, policy_type, version")
      .eq("id", policyId)
      .eq("organisation_id", orgId)
      .single();
    if (!current) return apiError("Policy not found", 404);

    // Build update payload
    const updates: Record<string, unknown> = {
      ...parsed.data,
      updated_at: new Date().toISOString(),
    };

    if (parsed.data.content !== undefined) {
      updates.is_edited = true;
    }

    if (parsed.data.status === "active") {
      updates.approved_by = user.id;
      updates.approved_at = new Date().toISOString();
    }

    const { data: policy, error } = await db
      .from("ai_policies")
      .update(updates)
      .eq("id", policyId)
      .eq("organisation_id", orgId)
      .select("id, title, policy_type, version, status, content, is_edited, approved_by, approved_at, created_at, updated_at")
      .single();

    if (error || !policy) return apiError("Failed to update policy", 400);

    // --- Event logging ---

    // Content edit
    if (parsed.data.content !== undefined) {
      await db.from("policy_events").insert({
        organisation_id: orgId,
        policy_id: policyId,
        event_type: "content_edited",
        version: current.version,
        performed_by: user.id,
        metadata: { previous_length: (current as Record<string, unknown>).content ? 0 : 0 },
      });
    }

    // Status change
    if (parsed.data.status && parsed.data.status !== current.status) {
      await db.from("policy_events").insert({
        organisation_id: orgId,
        policy_id: policyId,
        event_type: parsed.data.status === "active" ? "approved" : "status_changed",
        version: current.version,
        performed_by: user.id,
        metadata: { from: current.status, to: parsed.data.status },
      });

      // --- Auto-actions on status change ---

      // When policy is approved → create action item to communicate changes
      if (parsed.data.status === "active" && current.status !== "active") {
        await db.from("actions").insert({
          organisation_id: orgId,
          title: `Review and communicate: ${policy.title ?? current.policy_type}`,
          description: `Policy "${policy.title ?? current.policy_type}" has been approved and is now active. Review the policy content and communicate changes to relevant stakeholders.`,
          severity: "medium",
          status: "open",
          owner_id: user.id,
          due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          source_type: "policy",
        });

        await db.from("policy_events").insert({
          organisation_id: orgId,
          policy_id: policyId,
          event_type: "action_created",
          version: current.version,
          performed_by: user.id,
          metadata: { action_title: `Review and communicate: ${policy.title ?? current.policy_type}` },
        });
      }

      // When acceptable_use policy becomes active → create declaration template reminder
      if (
        parsed.data.status === "active" &&
        current.policy_type === "acceptable_use" &&
        current.status !== "active"
      ) {
        await db.from("actions").insert({
          organisation_id: orgId,
          title: "Create staff declaration for AI Acceptable Use Policy",
          description: "An AI Acceptable Use Policy has been approved. Create a staff declaration template so employees can acknowledge and sign off on the policy.",
          severity: "high",
          status: "open",
          owner_id: user.id,
          due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
          source_type: "policy",
        });
      }
    }

    return apiOk({ policy });
  });
}

// ---------------------------------------------------------------------------
// DELETE — archive with event logging
// ---------------------------------------------------------------------------

export async function DELETE(_req: NextRequest, ctx: RouteCtx) {
  return withErrorHandling(async () => {
    const auth = await requireAuth();
    if (auth.error) return auth.error;
    const { user, orgId, db } = auth;
    const { policyId } = await ctx.params;

    const { error } = await db
      .from("ai_policies")
      .update({ status: "archived", updated_at: new Date().toISOString() })
      .eq("id", policyId)
      .eq("organisation_id", orgId);

    if (error) return apiError("Failed to archive policy", 400);

    // Log event
    await db.from("policy_events").insert({
      organisation_id: orgId,
      policy_id: policyId,
      event_type: "archived",
      performed_by: user.id,
    });

    return apiOk({ archived: true });
  });
}
