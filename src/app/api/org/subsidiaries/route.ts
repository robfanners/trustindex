import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { createSupabaseServerClient } from "@/lib/supabase-auth-server";

async function getAuthedOrgId() {
  const authClient = await createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return null;
  const db = supabaseServer();
  const { data: profile } = await db
    .from("profiles")
    .select("organisation_id")
    .eq("id", user.id)
    .single();
  return profile?.organisation_id as string | null;
}

export async function GET() {
  const orgId = await getAuthedOrgId();
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = supabaseServer();
  const { data, error } = await db
    .from("subsidiaries")
    .select("id, name, created_at")
    .eq("organisation_id", orgId)
    .order("name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ subsidiaries: data });
}

export async function POST(req: Request) {
  const orgId = await getAuthedOrgId();
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const db = supabaseServer();
  const { data, error } = await db
    .from("subsidiaries")
    .insert({ organisation_id: orgId, name: name.trim() })
    .select("id, name, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ subsidiary: data }, { status: 201 });
}

export async function DELETE(req: Request) {
  const orgId = await getAuthedOrgId();
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id param required" }, { status: 400 });

  const db = supabaseServer();
  const { error } = await db
    .from("subsidiaries")
    .delete()
    .eq("id", id)
    .eq("organisation_id", orgId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
