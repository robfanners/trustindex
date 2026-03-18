import { requireAuth, apiOk, withErrorHandling } from "@/lib/apiHelpers";

// GET — list policies for org (latest version of each type)
export async function GET() {
  return withErrorHandling(async () => {
    const auth = await requireAuth();
    if (auth.error) return auth.error;
    const { orgId, db } = auth;

    const { data: policies, error } = await db
      .from("ai_policies")
      .select("id, policy_type, version, created_at")
      .eq("organisation_id", orgId)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error("Failed to fetch policies");
    }

    // Deduplicate: keep latest version of each policy type
    const seen = new Set<string>();
    const latest = (policies ?? []).filter((p) => {
      if (seen.has(p.policy_type)) return false;
      seen.add(p.policy_type);
      return true;
    });

    return apiOk({ policies: latest });
  });
}
