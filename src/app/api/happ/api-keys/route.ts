import { NextRequest } from "next/server";
import { requireAuth, apiError, apiOk } from "@/lib/apiHelpers";
import { generateApiKey } from "@/lib/apiKeyAuth";
import { createApiKeySchema, firstZodError } from "@/lib/validations";
import { writeAuditLog } from "@/lib/audit";
import { planToTier, hasTierAccess } from "@/lib/tiers";

export async function GET(_req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  if (!hasTierAccess(auth.plan, "Assure")) {
    return apiError("Plan upgrade required", 403);
  }

  const db = auth.db;
  const { data, error } = await db
    .from("api_keys")
    .select("id, name, key_prefix, scopes, status, tier_at_creation, last_used_at, expires_at, revoked_at, created_at, profiles!api_keys_created_by_fkey(full_name)")
    .eq("organisation_id", auth.orgId)
    .order("created_at", { ascending: false });

  if (error) return apiError(error.message, 500);
  return apiOk({ keys: data ?? [] });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  if (!hasTierAccess(auth.plan, "Assure")) {
    return apiError("Plan upgrade required", 403);
  }

  const body = await req.json();
  const parsed = createApiKeySchema.safeParse(body);
  if (!parsed.success) {
    return apiError(firstZodError(parsed.error), 400);
  }

  // Check key limit based on plan
  const db = auth.db;
  const { count } = await db
    .from("api_keys")
    .select("id", { count: "exact", head: true })
    .eq("organisation_id", auth.orgId)
    .eq("status", "active");

  const maxKeys = auth.plan === "enterprise" ? Infinity : 3;
  if ((count ?? 0) >= maxKeys) {
    return apiError(`Maximum ${maxKeys} active API keys allowed on your plan`, 403);
  }

  const { key, prefix, hash } = generateApiKey();

  const { data: apiKey, error } = await db
    .from("api_keys")
    .insert({
      organisation_id: auth.orgId,
      created_by: auth.user.id,
      name: parsed.data.name,
      key_hash: hash,
      key_prefix: prefix,
      scopes: parsed.data.scopes,
      tier_at_creation: planToTier(auth.plan),
      expires_at: parsed.data.expires_at || null,
    })
    .select("id, name, key_prefix, scopes, status, created_at")
    .single();

  if (error) return apiError(error.message, 500);

  await writeAuditLog({
    organisationId: auth.orgId,
    entityType: "api_key",
    entityId: apiKey.id,
    actionType: "created",
    performedBy: auth.user.id,
    metadata: { name: parsed.data.name, scopes: parsed.data.scopes },
  });

  // Return the plaintext key ONCE — never stored or retrievable again
  return apiOk({ ...apiKey, key }, 201);
}
