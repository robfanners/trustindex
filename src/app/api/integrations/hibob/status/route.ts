import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { createSupabaseServerClient } from "@/lib/supabase-auth-server";

export async function GET() {
  const authClient = await createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = supabaseServer();
  const { data: profile } = await db
    .from("profiles")
    .select("organisation_id")
    .eq("id", user.id)
    .single();

  const orgId = profile?.organisation_id as string | null;
  if (!orgId) return NextResponse.json({ status: "disconnected" });

  const { data: conn } = await db
    .from("integration_connections")
    .select("status, last_synced_at")
    .eq("organisation_id", orgId)
    .eq("provider", "hibob")
    .single();

  if (!conn) return NextResponse.json({ status: "disconnected" });

  return NextResponse.json({
    status: conn.status,
    last_synced_at: conn.last_synced_at,
  });
}
