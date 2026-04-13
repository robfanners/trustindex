import { NextRequest, NextResponse } from "next/server";
import { requireAuth, apiError, apiOk } from "@/lib/apiHelpers";
import { writeAuditLog } from "@/lib/audit";
import { hasTierAccess } from "@/lib/tiers";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ keyId: string }> }
) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  if (!hasTierAccess(auth.plan, "Assure")) {
    return apiError("Plan upgrade required", 403);
  }

  const { keyId } = await params;
  const db = auth.db;
  const { data, error } = await db
    .from("api_keys")
    .select("id, name, key_prefix, scopes, status, tier_at_creation, last_used_at, expires_at, revoked_at, created_at, profiles!api_keys_created_by_fkey(full_name, email)")
    .eq("id", keyId)
    .eq("organisation_id", auth.orgId)
    .single();

  if (error || !data) return apiError("API key not found", 404);
  return apiOk(data);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ keyId: string }> }
) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  if (!hasTierAccess(auth.plan, "Assure")) {
    return apiError("Plan upgrade required", 403);
  }

  const { keyId } = await params;
  const body = await req.json();
  const db = auth.db;

  // Fetch existing key
  const { data: existing, error: fetchErr } = await db
    .from("api_keys")
    .select("id, status")
    .eq("id", keyId)
    .eq("organisation_id", auth.orgId)
    .single();

  if (fetchErr || !existing) return apiError("API key not found", 404);

  const updates: Record<string, unknown> = {};

  if (body.name !== undefined) updates.name = body.name;
  if (body.scopes !== undefined && existing.status === "active") updates.scopes = body.scopes;
  if (body.status === "revoked" && existing.status === "active") {
    updates.status = "revoked";
    updates.revoked_at = new Date().toISOString();
  }

  if (Object.keys(updates).length === 0) {
    return apiError("No valid updates", 400);
  }

  const { data, error } = await db
    .from("api_keys")
    .update(updates)
    .eq("id", keyId)
    .select()
    .single();

  if (error) return apiError(error.message, 500);

  await writeAuditLog({
    organisationId: auth.orgId,
    entityType: "api_key",
    entityId: keyId,
    actionType: updates.status === "revoked" ? "revoked" : "updated",
    performedBy: auth.user.id,
    metadata: updates,
  });

  return apiOk(data);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ keyId: string }> }
) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  if (!hasTierAccess(auth.plan, "Assure")) {
    return apiError("Plan upgrade required", 403);
  }

  const { keyId } = await params;
  const db = auth.db;

  const { data: existing } = await db
    .from("api_keys")
    .select("id, status")
    .eq("id", keyId)
    .eq("organisation_id", auth.orgId)
    .single();

  if (!existing) return apiError("API key not found", 404);
  if (existing.status !== "revoked") {
    return apiError("Only revoked keys can be deleted. Revoke the key first.", 400);
  }

  const { error } = await db.from("api_keys").delete().eq("id", keyId);
  if (error) return apiError(error.message, 500);

  await writeAuditLog({
    organisationId: auth.orgId,
    entityType: "api_key",
    entityId: keyId,
    actionType: "deleted",
    performedBy: auth.user.id,
    metadata: {},
  });

  return apiOk({ success: true });
}
