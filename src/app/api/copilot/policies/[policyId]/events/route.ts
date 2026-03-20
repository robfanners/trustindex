import { NextRequest } from "next/server";
import { requireAuth, apiOk, withErrorHandling } from "@/lib/apiHelpers";

type RouteCtx = { params: Promise<{ policyId: string }> };

// ---------------------------------------------------------------------------
// GET — list audit events for a policy
// ---------------------------------------------------------------------------

export async function GET(_req: NextRequest, ctx: RouteCtx) {
  return withErrorHandling(async () => {
    const auth = await requireAuth();
    if (auth.error) return auth.error;
    const { orgId, db } = auth;
    const { policyId } = await ctx.params;

    const { data: events, error } = await db
      .from("policy_events")
      .select("id, event_type, version, performed_by, metadata, created_at, profiles(full_name)")
      .eq("organisation_id", orgId)
      .eq("policy_id", policyId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw new Error("Failed to fetch events");

    return apiOk({ events: events ?? [] });
  });
}
