// src/lib/apiKeyAuth.ts
// Authenticates API key from Authorization header.
// Used alongside requireTier() for dual-auth on HAPP routes.

import { createHash, randomBytes } from "crypto";
import { supabaseServer } from "@/lib/supabaseServer";
import { hasTierAccess, planToTier, type VersiumTier } from "@/lib/tiers";

export type ApiKeyAuthResult = {
  organisationId: string;
  apiKeyId: string;
  scopes: string[];
  tier: string;
};

/** Hash an API key for storage/lookup */
export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/** Generate a new API key: vsk_ + 40 random hex chars */
export function generateApiKey(): { key: string; prefix: string; hash: string } {
  const random = randomBytes(20).toString("hex"); // 40 hex chars
  const key = `vsk_${random}`;
  const prefix = key.slice(0, 12); // "vsk_" + first 8 of random
  const hash = hashApiKey(key);
  return { key, prefix, hash };
}

/**
 * Authenticate an API key from the Authorization header.
 * Returns org info if valid, or null if invalid/missing.
 */
export async function authenticateApiKey(
  req: Request,
  requiredTier: VersiumTier,
  requiredScope: string
): Promise<ApiKeyAuthResult | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer vsk_")) return null;

  const key = authHeader.slice(7); // strip "Bearer "
  const keyHash = hashApiKey(key);

  const db = supabaseServer();
  const { data: apiKey, error } = await db
    .from("api_keys")
    .select("id, organisation_id, scopes, status, tier_at_creation, expires_at")
    .eq("key_hash", keyHash)
    .single();

  if (error || !apiKey) return null;

  // Check key is active
  if (apiKey.status !== "active") return null;

  // Check not expired
  if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
    await db.from("api_keys").update({ status: "expired" }).eq("id", apiKey.id);
    return null;
  }

  // Check scope
  if (!apiKey.scopes.includes(requiredScope)) return null;

  // Check org tier — look up current org plan
  const { data: orgProfiles } = await db
    .from("profiles")
    .select("plan")
    .eq("organisation_id", apiKey.organisation_id)
    .limit(1);

  const orgPlan = orgProfiles?.[0]?.plan ?? "explorer";
  if (!hasTierAccess(orgPlan, requiredTier)) return null;

  // Update last_used_at (fire-and-forget)
  db.from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", apiKey.id)
    .then(() => {});

  return {
    organisationId: apiKey.organisation_id,
    apiKeyId: apiKey.id,
    scopes: apiKey.scopes,
    tier: planToTier(orgPlan),
  };
}
