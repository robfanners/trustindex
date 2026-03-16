import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-auth-server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function GET() {
  const authClient = await createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const db = supabaseServer();
  const { data: profile } = await db
    .from("profiles")
    .select("organisation_id")
    .eq("id", user.id)
    .single();

  if (!profile?.organisation_id) {
    return NextResponse.json({ error: "No organisation linked" }, { status: 400 });
  }

  const { data } = await db
    .from("integration_connections")
    .select("status, last_synced_at, sync_config")
    .eq("organisation_id", profile.organisation_id)
    .eq("provider", "github")
    .single();

  return NextResponse.json({
    data: {
      connected: data?.status === "connected",
      last_synced_at: data?.last_synced_at ?? null,
      repos: (data?.sync_config as { repos?: unknown[] } | null)?.repos ?? [],
    },
  });
}
