import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-auth-server";
import { supabaseServer } from "@/lib/supabaseServer";
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
    const authClient = await createSupabaseServerClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const sb = supabaseServer();

    // Check current profile
    const { data: profile, error: profileErr } = await sb
      .from("profiles")
      .select("id, email, company_name, plan, organisation_id")
      .eq("id", user.id)
      .single();

    if (profileErr || !profile) {
      return NextResponse.json(
        { error: "Could not load profile" },
        { status: 500 }
      );
    }

    // Already has an org — nothing to do
    if (profile.organisation_id) {
      return NextResponse.json({
        organisation_id: profile.organisation_id,
        created: false,
      });
    }

    // Only auto-create for paid users
    if (!isPaidPlan(profile.plan)) {
      return NextResponse.json(
        { error: "Upgrade to a paid plan to create an organisation" },
        { status: 403 }
      );
    }

    // Derive a name: company_name → email domain → "My Organisation"
    const orgName =
      profile.company_name ||
      (profile.email
        ? profile.email.split("@")[1]?.split(".")[0] ?? "My Organisation"
        : "My Organisation");

    // Create the organisation
    const { data: org, error: orgErr } = await sb
      .from("organisations")
      .insert({ name: orgName })
      .select("id")
      .single();

    if (orgErr || !org) {
      console.error("[org/ensure] Failed to create org:", orgErr);
      return NextResponse.json(
        { error: "Failed to create organisation" },
        { status: 500 }
      );
    }

    // Link to profile
    const { error: linkErr } = await sb
      .from("profiles")
      .update({ organisation_id: org.id })
      .eq("id", user.id);

    if (linkErr) {
      console.error("[org/ensure] Failed to link org to profile:", linkErr);
      return NextResponse.json(
        { error: "Failed to link organisation" },
        { status: 500 }
      );
    }

    console.log(
      `[org/ensure] Created org "${orgName}" (${org.id}) for user ${user.id}`
    );

    return NextResponse.json({
      organisation_id: org.id,
      created: true,
    });
  } catch (err: unknown) {
    console.error("[org/ensure] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
