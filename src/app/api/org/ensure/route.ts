import { requireAuth, apiError, apiOk } from "@/lib/apiHelpers";
import { isPaidPlan } from "@/lib/entitlements";

/**
 * POST /api/org/ensure
 *
 * Ensures the authenticated user has an organisation linked to their profile.
 * If they are on a paid plan and have no org, creates one automatically using
 * their profile company_name (or a fallback) and links it.
 *
 * Returns { organisation_id, created } — where created is true if a new org was made.
 */
export async function POST() {
  try {
    const auth = await requireAuth({ orgOptional: true });
    if (auth.error) return auth.error;
    const { user, orgId, plan, db: sb } = auth;

    // Already has an org — nothing to do
    if (orgId) {
      return apiOk({
        organisation_id: orgId,
        created: false,
      });
    }

    // Only auto-create for paid users
    if (!isPaidPlan(plan)) {
      return apiError("Upgrade to a paid plan to create an organisation", 403);
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
