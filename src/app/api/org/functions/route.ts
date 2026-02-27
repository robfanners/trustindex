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
  const subsidiaryIds = searchParams.get("subsidiaryIds"); // comma-separated or empty

  const db = supabaseServer();
  let query = db
    .from("functions")
    .select("id, name, subsidiary_id, is_project_type, created_at")
    .eq("organisation_id", orgId)
    .order("name");

  // If subsidiaryIds provided, filter to those subsidiaries + org-wide (null subsidiary_id) + project type
  if (subsidiaryIds) {
    const ids = subsidiaryIds.split(",").filter(Boolean);
    query = query.or(
      `subsidiary_id.in.(${ids.join(",")}),subsidiary_id.is.null,is_project_type.eq.true`
    );
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ functions: data });
}

export async function POST(req: Request) {
  const orgId = await getAuthedOrgId();
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, subsidiary_id } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const db = supabaseServer();
  const { data, error } = await db
    .from("functions")
    .insert({
      organisation_id: orgId,
      name: name.trim(),
      subsidiary_id: subsidiary_id || null,
    })
    .select("id, name, subsidiary_id, is_project_type, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ function: data }, { status: 201 });
}

export async function DELETE(req: Request) {
  const orgId = await getAuthedOrgId();
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id param required" }, { status: 400 });

  // Prevent deleting the Project function
  const db = supabaseServer();
  const { data: fn } = await db.from("functions").select("is_project_type").eq("id", id).single();
  if (fn?.is_project_type) {
    return NextResponse.json({ error: "Cannot delete the Project function" }, { status: 403 });
  }

  const { error } = await db
    .from("functions")
    .delete()
    .eq("id", id)
    .eq("organisation_id", orgId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
