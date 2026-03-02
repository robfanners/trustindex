import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-auth-server";
import { supabaseServer } from "@/lib/supabaseServer";

// ---------------------------------------------------------------------------
// GET /api/governance-pack — list governance packs for the user's org
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const authClient = await createSupabaseServerClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const db = supabaseServer();

    const { data: profile } = await db
      .from("profiles")
      .select("organisation_id")
      .eq("id", user.id)
      .single();

    if (!profile?.organisation_id) {
      return NextResponse.json({ error: "No organisation" }, { status: 400 });
    }

    const { data: packs, error } = await db
      .from("governance_packs")
      .select("id, version, status, generated_at, created_at")
      .eq("organisation_id", profile.organisation_id)
      .order("version", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch governance packs" },
        { status: 500 },
      );
    }

    return NextResponse.json({ packs: packs ?? [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
