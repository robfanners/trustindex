import { requireAuth, apiError, apiOk, withErrorHandling } from "@/lib/apiHelpers";

// ---------------------------------------------------------------------------
// POST /api/settings/delete-account — Soft-delete account
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  return withErrorHandling(async () => {
    // 1. Authenticate
    const auth = await requireAuth({ orgOptional: true });
    if (auth.error) return auth.error;
    const { user, db } = auth;

    // 2. Parse body
    const body = await req.json();
    const confirmationName = body.confirmation_name;

    if (!confirmationName || typeof confirmationName !== "string") {
      return apiError("Confirmation name is required", 400);
    }

    // 3. Get profile to validate confirmation
    const { data: profile } = await db
      .from("profiles")
      .select("email, company_name")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return apiError("Profile not found", 404);
    }

    // Confirmation must match company_name or email
    const validTargets = [profile.company_name, profile.email].filter(Boolean);
    if (!validTargets.includes(confirmationName)) {
      return apiError(
        "Confirmation does not match. Please type your organisation name or email exactly.",
        400
      );
    }

    // 4. Soft-delete: set suspended_at and reason
    const { error: updateErr } = await db
      .from("profiles")
      .update({
        suspended_at: new Date().toISOString(),
        suspended_reason: "user_self_delete",
      })
      .eq("id", user.id);

    if (updateErr) {
      return apiError(updateErr.message, 500);
    }

    return apiOk({ ok: true });
  });
}
