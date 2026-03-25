import { requireAuth, apiError, apiOk } from "@/lib/apiHelpers";

// ---------------------------------------------------------------------------
// GET /api/governance-pack — list governance packs for the user's org
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;
    const { orgId, db } = auth;

    const { data: packs, error } = await db
      .from("governance_packs")
      .select("id, version, status, generated_at, created_at")
      .eq("organisation_id", orgId)
      .order("version", { ascending: false });

    if (error) {
      return apiError("Failed to fetch governance packs", 500);
    }

    return apiOk({ packs: packs ?? [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return apiError(message, 500);
  }
}
