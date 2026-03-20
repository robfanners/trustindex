import { NextRequest, NextResponse } from "next/server";
import { requireTier } from "@/lib/requireTier";
import { supabaseServer } from "@/lib/supabaseServer";
import { generateApiKey } from "@/lib/apiKeyAuth";
import { createApiKeySchema, firstZodError } from "@/lib/validations";
import { writeAuditLog } from "@/lib/audit";
import { planToTier } from "@/lib/tiers";

export async function GET(_req: NextRequest) {
  const check = await requireTier("Assure");
  if (!check.authorized) return check.response;
  if (!check.orgId) return NextResponse.json({ error: "No organisation linked" }, { status: 400 });

  const db = supabaseServer();
  const { data, error } = await db
    .from("api_keys")
    .select("id, name, key_prefix, scopes, status, tier_at_creation, last_used_at, expires_at, revoked_at, created_at, profiles!api_keys_created_by_fkey(full_name)")
    .eq("organisation_id", check.orgId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ keys: data ?? [] });
}

export async function POST(req: NextRequest) {
  const check = await requireTier("Assure");
  if (!check.authorized) return check.response;
  if (!check.orgId) return NextResponse.json({ error: "No organisation linked" }, { status: 400 });

  const body = await req.json();
  const parsed = createApiKeySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 400 });
  }

  // Check key limit based on plan
  const db = supabaseServer();
  const { count } = await db
    .from("api_keys")
    .select("id", { count: "exact", head: true })
    .eq("organisation_id", check.orgId)
    .eq("status", "active");

  const maxKeys = check.plan === "enterprise" ? Infinity : 3;
  if ((count ?? 0) >= maxKeys) {
    return NextResponse.json({ error: `Maximum ${maxKeys} active API keys allowed on your plan` }, { status: 403 });
  }

  const { key, prefix, hash } = generateApiKey();

  const { data: apiKey, error } = await db
    .from("api_keys")
    .insert({
      organisation_id: check.orgId,
      created_by: check.userId,
      name: parsed.data.name,
      key_hash: hash,
      key_prefix: prefix,
      scopes: parsed.data.scopes,
      tier_at_creation: planToTier(check.plan),
      expires_at: parsed.data.expires_at || null,
    })
    .select("id, name, key_prefix, scopes, status, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAuditLog({
    organisationId: check.orgId,
    entityType: "api_key",
    entityId: apiKey.id,
    actionType: "created",
    performedBy: check.userId,
    metadata: { name: parsed.data.name, scopes: parsed.data.scopes },
  });

  // Return the plaintext key ONCE — never stored or retrievable again
  return NextResponse.json({ ...apiKey, key }, { status: 201 });
}
