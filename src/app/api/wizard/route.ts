export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-auth-server";
import { supabaseServer } from "@/lib/supabaseServer";
import { getUserPlan, canAccessWizard } from "@/lib/entitlements";

// GET — load latest wizard run for the user's org
export async function GET() {
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

    const { data: wizard, error } = await sb
      .from("governance_wizard")
      .select("*")
      .eq("organisation_id", profile.organisation_id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[wizard] Error loading wizard run:", error);
      return NextResponse.json({ error: "Failed to load wizard" }, { status: 500 });
    }

    return NextResponse.json({ wizard });
  } catch (err: unknown) {
    console.error("[wizard] GET error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST — save wizard responses (upsert pattern)
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
    const { responses } = body;

    if (!responses || typeof responses !== "object") {
      return NextResponse.json(
        { error: "responses must be an object" },
        { status: 400 }
      );
    }

    // Check for existing in-progress run
    const { data: existing, error: fetchError } = await sb
      .from("governance_wizard")
      .select("*")
      .eq("organisation_id", profile.organisation_id)
      .is("completed_at", null)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      console.error("[wizard] Error checking existing run:", fetchError);
      return NextResponse.json({ error: "Failed to check existing wizard run" }, { status: 500 });
    }

    if (existing) {
      // Update existing in-progress run
      const { data: wizard, error: updateError } = await sb
        .from("governance_wizard")
        .update({ responses })
        .eq("id", existing.id)
        .eq("organisation_id", profile.organisation_id)
        .select()
        .single();

      if (updateError) {
        console.error("[wizard] Error updating wizard run:", updateError);
        return NextResponse.json({ error: "Failed to update wizard" }, { status: 500 });
      }

      return NextResponse.json({ wizard });
    }

    // No in-progress run — create new one
    const { count } = await sb
      .from("governance_wizard")
      .select("id", { count: "exact", head: true })
      .eq("organisation_id", profile.organisation_id);

    const nextVersion = (count ?? 0) + 1;

    const { data: wizard, error: insertError } = await sb
      .from("governance_wizard")
      .insert({
        organisation_id: profile.organisation_id,
        version: nextVersion,
        responses,
        created_by: user.id,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[wizard] Error creating wizard run:", insertError);
      return NextResponse.json({ error: "Failed to create wizard run" }, { status: 500 });
    }

    return NextResponse.json({ wizard });
  } catch (err: unknown) {
    console.error("[wizard] POST error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
