import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-auth-server";
import { supabaseServer } from "@/lib/supabaseServer";

// ---------------------------------------------------------------------------
// POST /api/settings/delete-account — Soft-delete account
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  try {
    // 1. Authenticate
    const authClient = await createSupabaseServerClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // 2. Parse body
    const body = await req.json();
    const confirmationName = body.confirmation_name;

    if (!confirmationName || typeof confirmationName !== "string") {
      return NextResponse.json(
        { error: "Confirmation name is required" },
        { status: 400 }
      );
    }

    // 3. Get profile to validate confirmation
    const db = supabaseServer();
    const { data: profile } = await db
      .from("profiles")
      .select("email, company_name")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Confirmation must match company_name or email
    const validTargets = [profile.company_name, profile.email].filter(Boolean);
    if (!validTargets.includes(confirmationName)) {
      return NextResponse.json(
        { error: "Confirmation does not match. Please type your organisation name or email exactly." },
        { status: 400 }
      );
    }

    // 4. Soft-delete: set suspended_at and reason
    const { error: updateErr } = await db
      .from("profiles")
      .update({
        suspended_at: new Date().toISOString(),
        suspended_reason: "user_self_delete",
      })
      .eq("id", user.id);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
