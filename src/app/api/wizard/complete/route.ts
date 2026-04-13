export const runtime = "nodejs";

import { requireAuth, apiError, apiOk } from "@/lib/apiHelpers";
import { canAccessWizard } from "@/lib/entitlements";

// POST — mark wizard complete and pre-populate vendor register
export async function POST(req: Request) {
  try {
    const auth = await requireAuth({ withPlan: true });
    if (auth.error) return auth.error;
    const { orgId, plan, db: sb } = auth;

    if (!canAccessWizard(plan)) {
      return apiError("Upgrade to access the governance wizard", 403);
    }

    const body = await req.json();
    const { wizardId } = body;

    if (!wizardId) {
      return apiError("wizardId is required", 400);
    }

    // Mark wizard as complete
    const { data: wizard, error: updateError } = await sb
      .from("governance_wizard")
      .update({ completed_at: new Date().toISOString() })
      .eq("id", wizardId)
      .eq("organisation_id", orgId)
      .select()
      .single();

    if (updateError) {
      console.error("[wizard] Error completing wizard:", updateError);
      return apiError("Failed to complete wizard", 500);
    }

    if (!wizard) {
      return apiError("Wizard run not found", 404);
    }

    // Extract tools from responses and pre-populate vendor register
    const responses = wizard.responses as Record<string, unknown>;
    const tools = (responses?.tools as Array<{
      name?: string;
      dataClassification?: string;
      purpose?: string;
      departments?: string[];
    }>) ?? [];

    for (const tool of tools) {
      if (!tool.name) continue;

      // Check if vendor already exists (case-insensitive)
      const { data: existingVendor } = await sb
        .from("ai_vendors")
        .select("id")
        .eq("organisation_id", orgId)
        .ilike("vendor_name", tool.name)
        .maybeSingle();

      if (existingVendor) continue;

      const departments = Array.isArray(tool.departments)
        ? tool.departments.join(", ")
        : "";

      const noteParts = [
        tool.purpose ? `Purpose: ${tool.purpose}.` : null,
        departments ? `Departments: ${departments}.` : null,
        "Added via governance wizard.",
      ].filter(Boolean);

      const { error: insertError } = await sb
        .from("ai_vendors")
        .insert({
          organisation_id: orgId,
          vendor_name: tool.name,
          data_types: tool.dataClassification ? [tool.dataClassification] : [],
          risk_category: "unassessed",
          source: "integration",
          notes: noteParts.join(" "),
        });

      if (insertError) {
        console.error("[wizard] Error inserting vendor:", tool.name, insertError);
        // Continue with remaining tools — don't fail the whole operation
      }
    }

    return apiOk({ wizard });
  } catch (err: unknown) {
    console.error("[wizard] complete POST error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return apiError(message, 500);
  }
}
