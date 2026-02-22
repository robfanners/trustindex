// ---------------------------------------------------------------------------
// VCC — Server-side admin authentication + authorisation helper
// ---------------------------------------------------------------------------
// Called by every VCC API route. Authenticates the request and verifies the
// user has the required admin permission.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-auth-server";
import { supabaseServer } from "@/lib/supabaseServer";
import type { AdminRole, VCCPermission } from "./permissions";
import { hasPermission } from "./permissions";

export type AdminAuthSuccess = {
  user: { id: string; email: string };
  roles: AdminRole[];
};

export type AdminAuthResult =
  | { error: NextResponse }
  | AdminAuthSuccess;

/**
 * Authenticate the request and verify the user has the required admin permission.
 * Returns { user, roles } on success, or { error: NextResponse } on failure.
 */
export async function requireAdmin(
  requiredPermission: VCCPermission
): Promise<AdminAuthResult> {
  // Step 1: Authenticate via Supabase
  const authClient = await createSupabaseServerClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    return {
      error: NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      ),
    };
  }

  // Step 2: Look up admin roles from admin_roles table
  const db = supabaseServer();
  const { data: roleRows, error: roleErr } = await db
    .from("admin_roles")
    .select("role")
    .eq("user_id", user.id);

  if (roleErr || !roleRows || roleRows.length === 0) {
    return {
      error: NextResponse.json(
        { error: "Not authorised — no admin role assigned" },
        { status: 403 }
      ),
    };
  }

  const roles = roleRows.map((r) => r.role as AdminRole);

  // Step 3: Check permission
  if (!hasPermission(roles, requiredPermission)) {
    return {
      error: NextResponse.json(
        { error: `Insufficient permissions for: ${requiredPermission}` },
        { status: 403 }
      ),
    };
  }

  return {
    user: { id: user.id, email: user.email ?? "" },
    roles,
  };
}
