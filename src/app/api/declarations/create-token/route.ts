import { NextResponse } from "next/server";
import { requireAuth, apiError, apiOk, parseBody } from "@/lib/apiHelpers";
import { isPaidPlan } from "@/lib/entitlements";
import { getServerOrigin } from "@/lib/url";
import { createDeclarationTokenSchema } from "@/lib/validations";

export async function POST(req: Request) {
  try {
    const auth = await requireAuth({ withPlan: true });
    if (auth.error) return auth.error;

    if (!isPaidPlan(auth.plan)) {
      return apiError("Upgrade to create declaration tokens", 403);
    }

    // Parse optional label and expiry
    const parsed = await parseBody(req, createDeclarationTokenSchema);
    if (parsed.error) return parsed.error;
    const { label, assignee_email, expires_at } = parsed.data;

    // Create token
    const { data: token, error } = await auth.db
      .from("declaration_tokens")
      .insert({
        organisation_id: auth.orgId,
        label,
        assignee_email,
        expires_at,
        created_by: auth.user.id,
      })
      .select()
      .single();

    if (error) {
      console.error("[declarations] Error creating token:", error);
      return apiError("Failed to create token", 500);
    }

    const origin = getServerOrigin(req);
    const shareableUrl = `${origin}/declare/${token.token}`;

    return apiOk({ token, shareableUrl });
  } catch (err: unknown) {
    console.error("[declarations] create-token error:", err);
    return apiError(err instanceof Error ? err.message : "Internal server error", 500);
  }
}
