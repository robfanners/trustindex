import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-auth-server";
import { supabaseServer } from "@/lib/supabaseServer";
import { canViewIBG } from "@/lib/entitlements";

// ---------------------------------------------------------------------------
// GET /api/ibg/[assessmentId]/history — list all IBG spec versions
// ---------------------------------------------------------------------------

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ assessmentId: string }> }
) {
  try {
    const { assessmentId } = await params;
    const authClient = await createSupabaseServerClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const db = supabaseServer();

    const { data: profile } = await db
      .from("profiles")
      .select("organisation_id, plan")
      .eq("id", user.id)
      .single();

    if (!profile?.organisation_id) {
      return NextResponse.json({ error: "No organisation" }, { status: 400 });
    }

    if (!canViewIBG(profile.plan)) {
      return NextResponse.json(
        { error: "Upgrade to view IBG specifications", upgrade: true },
        { status: 403 }
      );
    }

    const { data: specs, error: fetchErr } = await db
      .from("ibg_specifications")
      .select("id, version, status, created_at, approved_at, approved_by, effective_from, effective_until")
      .eq("assessment_id", assessmentId)
      .eq("organisation_id", profile.organisation_id)
      .order("version", { ascending: false });

    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }

    return NextResponse.json({ versions: specs ?? [] });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
