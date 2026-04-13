export const runtime = "nodejs";

import { requireAuth, apiError, apiOk } from "@/lib/apiHelpers";
import { canAccessWizard } from "@/lib/entitlements";

// GET — load latest wizard run for the user's org
export async function GET() {
  try {
    const auth = await requireAuth({ withPlan: true });
    if (auth.error) return auth.error;
    const { orgId, plan, db: sb } = auth;

    if (!canAccessWizard(plan)) {
      return apiError("Upgrade to access the governance wizard", 403);
    }

    const { data: wizard, error } = await sb
      .from("governance_wizard")
      .select("*")
      .eq("organisation_id", orgId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[wizard] Error loading wizard run:", error);
      return apiError("Failed to load wizard", 500);
    }

    return apiOk({ wizard });
  } catch (err: unknown) {
    console.error("[wizard] GET error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return apiError(message, 500);
  }
}

// POST — save wizard responses (upsert pattern)
export async function POST(req: Request) {
  try {
    const auth = await requireAuth({ withPlan: true });
    if (auth.error) return auth.error;
    const { orgId, plan, db: sb } = auth;

    if (!canAccessWizard(plan)) {
      return apiError("Upgrade to access the governance wizard", 403);
    }

    const body = await req.json();
    const { responses } = body;

    if (!responses || typeof responses !== "object") {
      return apiError("responses must be an object", 400);
    }

    // Check for existing in-progress run
    const { data: existing, error: fetchError } = await sb
      .from("governance_wizard")
      .select("*")
      .eq("organisation_id", orgId)
      .is("completed_at", null)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      console.error("[wizard] Error checking existing run:", fetchError);
      return apiError("Failed to check existing wizard run", 500);
    }

    if (existing) {
      // Update existing in-progress run
      const { data: wizard, error: updateError } = await sb
        .from("governance_wizard")
        .update({ responses })
        .eq("id", existing.id)
        .eq("organisation_id", orgId)
        .select()
        .single();

      if (updateError) {
        console.error("[wizard] Error updating wizard run:", updateError);
        return apiError("Failed to update wizard", 500);
      }

      return apiOk({ wizard });
    }

    // No in-progress run — create new one
    const { count } = await sb
      .from("governance_wizard")
      .select("id", { count: "exact", head: true })
      .eq("organisation_id", orgId);

    const nextVersion = (count ?? 0) + 1;

    const { data: wizard, error: insertError } = await sb
      .from("governance_wizard")
      .insert({
        organisation_id: orgId,
        version: nextVersion,
        responses,
        created_by: auth.user.id,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[wizard] Error creating wizard run:", insertError);
      return apiError("Failed to create wizard run", 500);
    }

    return apiOk({ wizard });
  } catch (err: unknown) {
    console.error("[wizard] POST error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return apiError(message, 500);
  }
}
