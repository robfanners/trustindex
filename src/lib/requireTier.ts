// src/lib/requireTier.ts

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-auth-server";
import { supabaseServer } from "@/lib/supabaseServer";
import { hasTierAccess, type VersiumTier } from "@/lib/tiers";

type TierCheckResult =
  | { authorized: true; userId: string; plan: string; orgId: string | null }
  | { authorized: false; response: NextResponse };

/**
 * Check that the authenticated user's plan meets the required Verisum tier.
 * Returns user info if authorized, or a NextResponse to return if not.
 *
 * Usage in API routes:
 * ```ts
 * const check = await requireTier("Assure");
 * if (!check.authorized) return check.response;
 * // check.userId, check.plan, check.orgId available
 * ```
 */
export async function requireTier(requiredTier: VersiumTier): Promise<TierCheckResult> {
  const authClient = await createSupabaseServerClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    return {
      authorized: false,
      response: NextResponse.json({ error: "Not authenticated" }, { status: 401 }),
    };
  }

  const db = supabaseServer();
  const { data: profile } = await db
    .from("profiles")
    .select("plan, organisation_id")
    .eq("id", user.id)
    .single();

  const plan = profile?.plan ?? "explorer";

  if (!hasTierAccess(plan, requiredTier)) {
    return {
      authorized: false,
      response: NextResponse.json(
        {
          error: "Plan upgrade required",
          required_tier: requiredTier,
          current_plan: plan,
        },
        { status: 403 }
      ),
    };
  }

  return {
    authorized: true,
    userId: user.id,
    plan,
    orgId: profile?.organisation_id ?? null,
  };
}
