// src/lib/resolveAuth.ts
// Dual-auth resolver: tries session auth (requireTier) first, then API key.

import { NextRequest, NextResponse } from "next/server";
import { requireTier } from "@/lib/requireTier";
import { authenticateApiKey } from "@/lib/apiKeyAuth";
import type { VersiumTier } from "@/lib/tiers";

export type AuthSource = "session" | "api_key";

export type ResolvedAuth =
  | {
      authorized: true;
      source: AuthSource;
      organisationId: string;
      userId: string | null;
      apiKeyId: string | null;
    }
  | {
      authorized: false;
      response: NextResponse;
    };

/**
 * Resolve authentication from either session or API key.
 * Tries session first (fast path for UI), falls back to API key.
 */
export async function resolveAuth(
  req: NextRequest,
  requiredTier: VersiumTier,
  requiredScope: string
): Promise<ResolvedAuth> {
  // Try session auth first
  const sessionCheck = await requireTier(requiredTier);
  if (sessionCheck.authorized) {
    if (!sessionCheck.orgId) {
      return {
        authorized: false,
        response: NextResponse.json({ error: "No organisation linked" }, { status: 400 }),
      };
    }
    return {
      authorized: true,
      source: "session",
      organisationId: sessionCheck.orgId,
      userId: sessionCheck.userId,
      apiKeyId: null,
    };
  }

  // Try API key auth
  const apiKeyAuth = await authenticateApiKey(req, requiredTier, requiredScope);
  if (apiKeyAuth) {
    return {
      authorized: true,
      source: "api_key",
      organisationId: apiKeyAuth.organisationId,
      userId: null,
      apiKeyId: apiKeyAuth.apiKeyId,
    };
  }

  // Neither auth method succeeded
  return {
    authorized: false,
    response: NextResponse.json({ error: "Not authenticated" }, { status: 401 }),
  };
}
