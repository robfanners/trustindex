/**
 * Shared API route helpers — eliminates auth boilerplate and standardises responses.
 *
 * Usage:
 *   const auth = await requireAuth();
 *   if (auth.error) return auth.error;
 *   const { user, orgId, plan, db } = auth;
 *
 * Or with plan included:
 *   const auth = await requireAuth({ withPlan: true });
 */

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-auth-server";
import { supabaseServer } from "@/lib/supabaseServer";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import type { ZodSchema, ZodError } from "zod";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AuthSuccess = {
  error?: undefined;
  user: User;
  orgId: string;
  plan: string;
  db: SupabaseClient;
};

type AuthFailure = {
  error: NextResponse;
};

type AuthResult = AuthSuccess | AuthFailure;

type RequireAuthOptions = {
  /** If true, allows routes that don't require an organisation. Default: false */
  orgOptional?: boolean;
  /** If true, fetches the user's plan alongside auth. Default: false */
  withPlan?: boolean;
};

// ---------------------------------------------------------------------------
// requireAuth — single entry point for API route authentication
// ---------------------------------------------------------------------------

/**
 * Authenticate the request and resolve the user's organisation.
 *
 * Returns `{ user, orgId, plan, db }` on success, or `{ error: NextResponse }`
 * on failure. Callers should early-return the error:
 *
 * ```ts
 * const auth = await requireAuth();
 * if (auth.error) return auth.error;
 * ```
 */
export async function requireAuth(
  options: RequireAuthOptions = {}
): Promise<AuthResult> {
  const { withPlan: _withPlan = true, orgOptional = false } = options;

  // 1. Authenticate
  const authClient = await createSupabaseServerClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    return { error: apiError("Not authenticated", 401) };
  }

  // 2. Resolve profile + org
  const db = supabaseServer();

  const { data: profile } = await db
    .from("profiles")
    .select("organisation_id, plan")
    .eq("id", user.id)
    .single();

  const orgId = (profile as { organisation_id?: string } | null)?.organisation_id ?? "";
  const plan = (profile as { plan?: string } | null)?.plan ?? "explorer";

  if (!orgOptional && !orgId) {
    return { error: apiError("No organisation linked", 400) };
  }

  return { user, orgId, plan, db };
}

// ---------------------------------------------------------------------------
// Standardised API response helpers
// ---------------------------------------------------------------------------

/** Return a JSON error response with consistent shape: { error: string } */
export function apiError(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

/** Return a JSON success response */
export function apiOk<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

// ---------------------------------------------------------------------------
// Request body validation
// ---------------------------------------------------------------------------

/**
 * Parse and validate a JSON request body against a Zod schema.
 *
 * Returns `{ data }` on success or `{ error: NextResponse }` on failure.
 *
 * ```ts
 * const parsed = await parseBody(req, createVendorSchema);
 * if (parsed.error) return parsed.error;
 * const { vendorName, vendorUrl } = parsed.data;
 * ```
 */
export async function parseBody<T>(
  req: Request,
  schema: ZodSchema<T>
): Promise<{ data: T; error?: undefined } | { data?: undefined; error: NextResponse }> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { error: apiError("Invalid JSON body", 400) };
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    const message = (result.error as ZodError).issues[0]?.message ?? "Invalid input";
    return { error: apiError(message, 400) };
  }

  return { data: result.data };
}

// ---------------------------------------------------------------------------
// Error handling wrapper
// ---------------------------------------------------------------------------

/** Wrap an async handler with a standard try/catch that returns consistent errors */
export function withErrorHandling(
  handler: () => Promise<NextResponse | undefined>
): Promise<NextResponse> {
  return handler()
    .then((res) => res ?? apiError("No response", 500))
    .catch((err: unknown) => {
      const message =
        err instanceof Error ? err.message : "Internal server error";
      console.error("[api]", message);
      return apiError(message, 500);
    });
}
