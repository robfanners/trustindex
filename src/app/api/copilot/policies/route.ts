import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-auth-server";
import { supabaseServer } from "@/lib/supabaseServer";

// GET — list policies for org (latest version of each type)
export async function GET() {
  try {
    const authClient = await createSupabaseServerClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const sb = supabaseServer();
    const { data: profile } = await sb
      .from("profiles")
      .select("organisation_id")
      .eq("id", user.id)
      .single();

    if (!profile?.organisation_id) {
      return NextResponse.json({ error: "No organisation" }, { status: 400 });
    }

    const { data: policies, error } = await sb
      .from("ai_policies")
      .select("id, policy_type, version, created_at")
      .eq("organisation_id", profile.organisation_id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: "Failed to fetch policies" }, { status: 500 });
    }

    // Deduplicate: keep latest version of each policy type
    const seen = new Set<string>();
    const latest = (policies ?? []).filter((p) => {
      if (seen.has(p.policy_type)) return false;
      seen.add(p.policy_type);
      return true;
    });

    return NextResponse.json({ policies: latest });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
