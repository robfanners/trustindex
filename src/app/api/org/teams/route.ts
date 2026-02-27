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

export async function GET(req: Request) {
  const orgId = await getAuthedOrgId();
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const functionIds = searchParams.get("functionIds"); // comma-separated

  const db = supabaseServer();
  let query = db
    .from("teams")
    .select("id, name, function_id, is_adhoc, created_at")
    .eq("organisation_id", orgId)
    .order("name");

  if (functionIds) {
    const ids = functionIds.split(",").filter(Boolean);
    query = query.in("function_id", ids);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ teams: data });
}

export async function POST(req: Request) {
  const orgId = await getAuthedOrgId();
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, function_id, is_adhoc } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (!function_id) return NextResponse.json({ error: "function_id is required" }, { status: 400 });

  const db = supabaseServer();
  const { data, error } = await db
    .from("teams")
    .insert({
      organisation_id: orgId,
      function_id,
      name: name.trim(),
      is_adhoc: is_adhoc ?? false,
    })
    .select("id, name, function_id, is_adhoc, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ team: data }, { status: 201 });
}

export async function DELETE(req: Request) {
  const orgId = await getAuthedOrgId();
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id param required" }, { status: 400 });

  const db = supabaseServer();
  const { error } = await db
    .from("teams")
    .delete()
    .eq("id", id)
    .eq("organisation_id", orgId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
