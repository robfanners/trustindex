import { NextRequest, NextResponse } from "next/server";
import { requireTier } from "@/lib/requireTier";
import { supabaseServer } from "@/lib/supabaseServer";
import { writeAuditLog } from "@/lib/audit";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ keyId: string }> }
) {
  const check = await requireTier("Assure");
  if (!check.authorized) return check.response;
  if (!check.orgId) return NextResponse.json({ error: "No organisation linked" }, { status: 400 });

  const { keyId } = await params;
  const db = supabaseServer();
  const { data, error } = await db
    .from("api_keys")
    .select("id, name, key_prefix, scopes, status, tier_at_creation, last_used_at, expires_at, revoked_at, created_at, profiles!api_keys_created_by_fkey(full_name, email)")
    .eq("id", keyId)
    .eq("organisation_id", check.orgId)
    .single();

  if (error || !data) return NextResponse.json({ error: "API key not found" }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ keyId: string }> }
) {
  const check = await requireTier("Assure");
  if (!check.authorized) return check.response;
  if (!check.orgId) return NextResponse.json({ error: "No organisation linked" }, { status: 400 });

  const { keyId } = await params;
  const body = await req.json();
  const db = supabaseServer();

  // Fetch existing key
  const { data: existing, error: fetchErr } = await db
    .from("api_keys")
    .select("id, status")
    .eq("id", keyId)
    .eq("organisation_id", check.orgId)
    .single();

  if (fetchErr || !existing) return NextResponse.json({ error: "API key not found" }, { status: 404 });

  const updates: Record<string, unknown> = {};

  if (body.name !== undefined) updates.name = body.name;
  if (body.scopes !== undefined && existing.status === "active") updates.scopes = body.scopes;
  if (body.status === "revoked" && existing.status === "active") {
    updates.status = "revoked";
    updates.revoked_at = new Date().toISOString();
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid updates" }, { status: 400 });
  }

  const { data, error } = await db
    .from("api_keys")
    .update(updates)
    .eq("id", keyId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAuditLog({
    organisationId: check.orgId,
    entityType: "api_key",
    entityId: keyId,
    actionType: updates.status === "revoked" ? "revoked" : "updated",
    performedBy: check.userId,
    metadata: updates,
  });

  return NextResponse.json(data);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ keyId: string }> }
) {
  const check = await requireTier("Assure");
  if (!check.authorized) return check.response;
  if (!check.orgId) return NextResponse.json({ error: "No organisation linked" }, { status: 400 });

  const { keyId } = await params;
  const db = supabaseServer();

  const { data: existing } = await db
    .from("api_keys")
    .select("id, status")
    .eq("id", keyId)
    .eq("organisation_id", check.orgId)
    .single();

  if (!existing) return NextResponse.json({ error: "API key not found" }, { status: 404 });
  if (existing.status !== "revoked") {
    return NextResponse.json({ error: "Only revoked keys can be deleted. Revoke the key first." }, { status: 400 });
  }

  const { error } = await db.from("api_keys").delete().eq("id", keyId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAuditLog({
    organisationId: check.orgId,
    entityType: "api_key",
    entityId: keyId,
    actionType: "deleted",
    performedBy: check.userId,
    metadata: {},
  });

  return NextResponse.json({ success: true });
}
