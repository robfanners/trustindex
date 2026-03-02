export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-auth-server";
import { supabaseServer } from "@/lib/supabaseServer";
import { getUserPlan, canAccessWizard } from "@/lib/entitlements";

// POST — mark wizard complete and pre-populate vendor register
export async function POST(req: Request) {
  try {
    const authClient = await createSupabaseServerClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const plan = await getUserPlan(user.id);
    if (!canAccessWizard(plan)) {
      return NextResponse.json(
        { error: "Upgrade to access the governance wizard" },
        { status: 403 }
      );
    }

    const sb = supabaseServer();
    const { data: profile } = await sb
      .from("profiles")
      .select("organisation_id")
      .eq("id", user.id)
      .single();

    if (!profile?.organisation_id) {
      return NextResponse.json({ error: "No organisation found" }, { status: 400 });
    }

    const body = await req.json();
    const { wizardId } = body;

    if (!wizardId) {
      return NextResponse.json({ error: "wizardId is required" }, { status: 400 });
    }

    // Mark wizard as complete
    const { data: wizard, error: updateError } = await sb
      .from("governance_wizard")
      .update({ completed_at: new Date().toISOString() })
      .eq("id", wizardId)
      .eq("organisation_id", profile.organisation_id)
      .select()
      .single();

    if (updateError) {
      console.error("[wizard] Error completing wizard:", updateError);
      return NextResponse.json({ error: "Failed to complete wizard" }, { status: 500 });
    }

    if (!wizard) {
      return NextResponse.json({ error: "Wizard run not found" }, { status: 404 });
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
        .eq("organisation_id", profile.organisation_id)
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
          organisation_id: profile.organisation_id,
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

    return NextResponse.json({ wizard });
  } catch (err: unknown) {
    console.error("[wizard] complete POST error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
