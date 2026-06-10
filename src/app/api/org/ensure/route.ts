import { requireAuth, apiError, apiOk } from "@/lib/apiHelpers";

/**
 * POST /api/org/ensure
 *
 * Ensures the authenticated user has an organisation linked to their profile.
 * If they have no org, creates one automatically using their profile
 * company_name (or a fallback derived from their email) and links it.
 *
 * Available to all authenticated users (including Explorer/free) — every
 * profile must have an organisation_id linked or all org-scoped API endpoints
 * return 400 "No organisation linked".
 *
 * Returns { organisation_id, created } — where created is true if a new org was made.
 */
export async function POST() {
  try {
    const auth = await requireAuth({ orgOptional: true });
    if (auth.error) return auth.error;
    const { user, orgId, db: sb } = auth;

    // Already has an org — nothing to do
    if (orgId) {
      return apiOk({
        organisation_id: orgId,
        created: false,
      });
    }

    // Get email from user
    const userEmail = user.email ?? "";

    // Derive a name: email domain → "My Organisation"
    const orgName = userEmail
      ? userEmail.split("@")[1]?.split(".")[0] ?? "My Organisation"
      : "My Organisation";

    // Create the organisation
    const { data: org, error: orgErr } = await sb
      .from("organisations")
      .insert({ name: orgName })
      .select("id")
      .single();

    if (orgErr || !org) {
      console.error("[org/ensure] Failed to create org:", orgErr);
      return apiError("Failed to create organisation", 500);
    }

    // Link to profile
    const { error: linkErr } = await sb
      .from("profiles")
      .update({ organisation_id: org.id })
      .eq("id", user.id);

    if (linkErr) {
      console.error("[org/ensure] Failed to link org to profile:", linkErr);
      return apiError("Failed to link organisation", 500);
    }

    return apiOk({
      organisation_id: org.id,
      created: true,
    });
  } catch (err: unknown) {
    console.error("[org/ensure] Error:", err);
    return apiError(
      err instanceof Error ? err.message : "Internal server error",
      500
    );
  }
}
