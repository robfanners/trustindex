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

    // Fetch invite stats per token
    const tokenIds = (tokens ?? []).map((t: { id: string }) => t.id);
    let inviteStats: Record<string, { sent: number; submitted: number }> = {};
    if (tokenIds.length > 0) {
      const { data: invites } = await sb
        .from("declaration_invites")
        .select("token_id, submitted_at")
        .in("token_id", tokenIds);

      for (const inv of invites ?? []) {
        if (!inviteStats[inv.token_id]) inviteStats[inv.token_id] = { sent: 0, submitted: 0 };
        inviteStats[inv.token_id].sent++;
        if (inv.submitted_at) inviteStats[inv.token_id].submitted++;
      }
    }

    return NextResponse.json({
      tokens: tokens ?? [],
      tokenCount: (tokens ?? []).filter((t: { is_active: boolean }) => t.is_active).length,
      totalDeclarations: totalDeclarations ?? 0,
      inviteStats,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
