import { NextRequest } from "next/server";
import { requireAuth, apiOk, apiError, withErrorHandling, parseBody } from "@/lib/apiHelpers";
import { z } from "zod";

type RouteCtx = { params: Promise<{ policyId: string }> };

// ---------------------------------------------------------------------------
// GET — fetch single policy
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

    return apiOk({ policy });
  });
}

// ---------------------------------------------------------------------------
// PATCH — update policy (title, content, status)
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

    // Build update payload
    const updates: Record<string, unknown> = {
      ...parsed.data,
      updated_at: new Date().toISOString(),
    };

    // If content changed, mark as edited and bump version
    if (parsed.data.content !== undefined) {
      updates.is_edited = true;
    }

    // If moving to active, set approval fields
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

    return apiOk({ policy });
  });
}

// ---------------------------------------------------------------------------
// DELETE — archive (soft-delete) a policy
// ---------------------------------------------------------------------------

export async function DELETE(_req: NextRequest, ctx: RouteCtx) {
  return withErrorHandling(async () => {
    const auth = await requireAuth();
    if (auth.error) return auth.error;
    const { orgId, db } = auth;
    const { policyId } = await ctx.params;

    const { error } = await db
      .from("ai_policies")
      .update({ status: "archived", updated_at: new Date().toISOString() })
      .eq("id", policyId)
      .eq("organisation_id", orgId);

    if (error) return apiError("Failed to archive policy", 400);

    return apiOk({ archived: true });
  });
}
