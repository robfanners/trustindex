import { requireAuth, apiError, apiOk, withErrorHandling } from "@/lib/apiHelpers";

// ---------------------------------------------------------------------------
// PATCH /api/settings/profile — update profile fields
// ---------------------------------------------------------------------------

const ALLOWED_FIELDS = ["full_name", "company_name", "company_size", "role"] as const;
const MAX_LENGTH = 200;

export async function PATCH(req: Request) {
  return withErrorHandling(async () => {
    // 1. Authenticate
    const auth = await requireAuth({ orgOptional: true });
    if (auth.error) return auth.error;
    const { user, db } = auth;

    // 2. Parse + validate body
    const body = await req.json();
    const updates: Record<string, string> = {};

    for (const field of ALLOWED_FIELDS) {
      if (field in body) {
        const val = body[field];
        if (typeof val !== "string") {
          return apiError(`${field} must be a string`, 400);
        }
        if (val.length > MAX_LENGTH) {
          return apiError(`${field} must be at most ${MAX_LENGTH} characters`, 400);
        }
        updates[field] = val;
      }
    }

    if (Object.keys(updates).length === 0) {
      return apiError("No valid fields to update", 400);
    }

    // 3. Update profile
    const { data, error } = await db
      .from("profiles")
      .update(updates)
      .eq("id", user.id)
      .select("id, email, plan, full_name, company_name, company_size, role, created_at")
      .single();

    if (error) {
      return apiError(error.message, 500);
    }

    return apiOk({ profile: data });
  });
}
