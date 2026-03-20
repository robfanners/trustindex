import { NextRequest } from "next/server";
import { requireAuth, apiOk, apiError, withErrorHandling, parseBody } from "@/lib/apiHelpers";
import { z } from "zod";

type RouteCtx = { params: Promise<{ policyId: string }> };

// ---------------------------------------------------------------------------
// GET — list systems linked to a policy
// ---------------------------------------------------------------------------

export async function GET(_req: NextRequest, ctx: RouteCtx) {
  return withErrorHandling(async () => {
    const auth = await requireAuth();
    if (auth.error) return auth.error;
    const { orgId, db } = auth;
    const { policyId } = await ctx.params;

    const { data: links, error } = await db
      .from("system_policy_links")
      .select("id, system_id, policy_id, link_type, created_at, systems(id, name, risk_category, type)")
      .eq("organisation_id", orgId)
      .eq("policy_id", policyId)
      .order("created_at", { ascending: false });

    if (error) throw new Error("Failed to fetch links");

    return apiOk({ links: links ?? [] });
  });
}

// ---------------------------------------------------------------------------
// POST — link a system to a policy
// ---------------------------------------------------------------------------

const linkSchema = z.object({
  system_id: z.string().uuid("Invalid system ID"),
  link_type: z.enum(["applies_to", "references", "supersedes"]).optional().default("applies_to"),
});

export async function POST(req: NextRequest, ctx: RouteCtx) {
  return withErrorHandling(async () => {
    const auth = await requireAuth();
    if (auth.error) return auth.error;
    const { user, orgId, db } = auth;
    const { policyId } = await ctx.params;

    const parsed = await parseBody(req, linkSchema);
    if (parsed.error) return parsed.error;
    const { system_id, link_type } = parsed.data;

    // Verify policy belongs to org
    const { data: policy } = await db
      .from("ai_policies")
      .select("id, title, policy_type")
      .eq("id", policyId)
      .eq("organisation_id", orgId)
      .single();
    if (!policy) return apiError("Policy not found", 404);

    // Verify system belongs to org
    const { data: system } = await db
      .from("systems")
      .select("id, name")
      .eq("id", system_id)
      .eq("owner_id", user.id)
      .single();
    if (!system) return apiError("System not found", 404);

    // Create link
    const { data: link, error } = await db
      .from("system_policy_links")
      .upsert({
        organisation_id: orgId,
        system_id,
        policy_id: policyId,
        link_type,
        created_by: user.id,
      }, { onConflict: "system_id,policy_id,link_type" })
      .select("id, system_id, policy_id, link_type, created_at")
      .single();

    if (error) throw new Error("Failed to link system");

    // Log event
    await db.from("policy_events").insert({
      organisation_id: orgId,
      policy_id: policyId,
      event_type: "system_linked",
      performed_by: user.id,
      metadata: { system_id, system_name: system.name, link_type },
    });

    return apiOk({ link }, 201);
  });
}

// ---------------------------------------------------------------------------
// DELETE — unlink a system from a policy (via query param ?link_id=)
// ---------------------------------------------------------------------------

export async function DELETE(req: NextRequest, ctx: RouteCtx) {
  return withErrorHandling(async () => {
    const auth = await requireAuth();
    if (auth.error) return auth.error;
    const { user, orgId, db } = auth;
    const { policyId } = await ctx.params;

    const linkId = req.nextUrl.searchParams.get("link_id");
    if (!linkId) return apiError("link_id required", 400);

    // Get link details before deleting (for audit)
    const { data: link } = await db
      .from("system_policy_links")
      .select("id, system_id, systems(name)")
      .eq("id", linkId)
      .eq("organisation_id", orgId)
      .eq("policy_id", policyId)
      .single();

    if (!link) return apiError("Link not found", 404);

    const { error } = await db
      .from("system_policy_links")
      .delete()
      .eq("id", linkId)
      .eq("organisation_id", orgId);

    if (error) throw new Error("Failed to unlink");

    // Log event
    await db.from("policy_events").insert({
      organisation_id: orgId,
      policy_id: policyId,
      event_type: "system_unlinked",
      performed_by: user.id,
      metadata: {
        system_id: link.system_id,
        system_name: (link as Record<string, unknown>).systems
          ? ((link as Record<string, unknown>).systems as Record<string, unknown>).name
          : null,
      },
    });

    return apiOk({ unlinked: true });
  });
}
