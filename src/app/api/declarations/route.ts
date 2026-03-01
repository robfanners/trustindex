import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-auth-server";
import { supabaseServer } from "@/lib/supabaseServer";

// GET — list tokens + declaration stats for org (dashboard view)
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

    // Fetch tokens
    const { data: tokens } = await sb
      .from("declaration_tokens")
      .select("id, token, label, is_active, created_at")
      .eq("organisation_id", profile.organisation_id)
      .order("created_at", { ascending: false });

    // Fetch declaration count
    const { count: totalDeclarations } = await sb
      .from("staff_declarations")
      .select("id", { count: "exact", head: true })
      .eq("organisation_id", profile.organisation_id);

    return NextResponse.json({
      tokens: tokens ?? [],
      tokenCount: (tokens ?? []).filter((t) => t.is_active).length,
      totalDeclarations: totalDeclarations ?? 0,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
