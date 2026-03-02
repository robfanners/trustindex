import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-auth-server";
import { supabaseServer } from "@/lib/supabaseServer";
import { getUserPlan, isPaidPlan } from "@/lib/entitlements";
import { getServerOrigin } from "@/lib/url";

export async function POST(req: Request) {
  try {
    // Auth
    const authClient = await createSupabaseServerClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Plan check
    const plan = await getUserPlan(user.id);
    if (!isPaidPlan(plan)) {
      return NextResponse.json(
        { error: "Upgrade to create declaration tokens" },
        { status: 403 }
      );
    }

    // Get org
    const sb = supabaseServer();
    const { data: profile } = await sb
      .from("profiles")
      .select("organisation_id")
      .eq("id", user.id)
      .single();

    if (!profile?.organisation_id) {
      return NextResponse.json(
        { error: "No organisation found" },
        { status: 400 }
      );
    }

    // Parse optional label and expiry
    let label: string | null = null;
    let expiresAt: string | null = null;
    try {
      const body = await req.json();
      if (body.label) label = body.label;
      if (body.expiresAt) expiresAt = body.expiresAt;
    } catch {
      // defaults
    }

    // Create token
    const { data: token, error } = await sb
      .from("declaration_tokens")
      .insert({
        organisation_id: profile.organisation_id,
        label,
        expires_at: expiresAt,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error("[declarations] Error creating token:", error);
      return NextResponse.json(
        { error: "Failed to create token" },
        { status: 500 }
      );
    }

    const origin = getServerOrigin(req);
    const shareableUrl = `${origin}/declare/${token.token}`;

    return NextResponse.json({ token, shareableUrl });
  } catch (err: unknown) {
    console.error("[declarations] create-token error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
