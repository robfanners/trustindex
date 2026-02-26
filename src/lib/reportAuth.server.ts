import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-auth-server";
import { supabaseServer } from "@/lib/supabaseServer";
import type { TrustGraphRole } from "@/lib/reportAuth";

// ---------------------------------------------------------------------------
// Server-side helper: authenticate + get org_id + role
// ---------------------------------------------------------------------------

export async function getAuthenticatedOrgWithRole() {
  const authClient = await createSupabaseServerClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    return {
      error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }),
    };
  }

  const db = supabaseServer();
  const { data: profile } = await db
    .from("profiles")
    .select("organisation_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.organisation_id) {
    return {
      error: NextResponse.json(
        { error: "No organisation linked" },
        { status: 400 }
      ),
    };
  }

  return {
    user,
    orgId: profile.organisation_id as string,
    role: (profile.role as TrustGraphRole) ?? null,
  };
}
