import { requireAuth, apiOk, withErrorHandling } from "@/lib/apiHelpers";

// GET — list tokens + declaration stats for org (dashboard view)
export async function GET() {
  return withErrorHandling(async () => {
    const auth = await requireAuth();
    if (auth.error) return auth.error;
    const { orgId, db } = auth;

    // Fetch tokens
    const { data: tokens } = await db
      .from("declaration_tokens")
      .select("id, token, label, is_active, created_at")
      .eq("organisation_id", orgId)
      .order("created_at", { ascending: false });

    // Fetch declaration count
    const { count: totalDeclarations } = await db
      .from("staff_declarations")
      .select("id", { count: "exact", head: true })
      .eq("organisation_id", orgId);

    // Fetch invite stats per token
    const tokenIds = (tokens ?? []).map((t: { id: string }) => t.id);
    const inviteStats: Record<string, { sent: number; submitted: number }> = {};
    if (tokenIds.length > 0) {
      const { data: invites } = await db
        .from("declaration_invites")
        .select("token_id, submitted_at")
        .in("token_id", tokenIds);

      for (const inv of invites ?? []) {
        if (!inviteStats[inv.token_id]) inviteStats[inv.token_id] = { sent: 0, submitted: 0 };
        inviteStats[inv.token_id].sent++;
        if (inv.submitted_at) inviteStats[inv.token_id].submitted++;
      }
    }

    return apiOk({
      tokens: tokens ?? [],
      tokenCount: (tokens ?? []).filter((t: { is_active: boolean }) => t.is_active).length,
      totalDeclarations: totalDeclarations ?? 0,
      inviteStats,
    });
  });
}
