import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { createSupabaseServerClient } from "@/lib/supabase-auth-server";
import { validateCredentials } from "@/lib/hibob";

export async function POST(req: Request) {
  // Auth check
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
  if (!orgId) return NextResponse.json({ error: "No organisation found" }, { status: 400 });

  const { serviceId, token } = await req.json();
  if (!serviceId || !token) {
    return NextResponse.json({ error: "serviceId and token are required" }, { status: 400 });
  }

  // Validate credentials against HiBob API
  const valid = await validateCredentials(serviceId, token);
  if (!valid) {
    return NextResponse.json({ error: "Invalid HiBob credentials" }, { status: 401 });
  }

  // Upsert into integration_connections
  const { error } = await db
    .from("integration_connections")
    .upsert(
      {
        organisation_id: orgId,
        provider: "hibob",
        status: "connected",
        access_token: serviceId,
        refresh_token: token,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organisation_id,provider" }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, status: "connected" });
}
