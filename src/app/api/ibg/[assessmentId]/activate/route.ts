import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-auth-server";
import { supabaseServer } from "@/lib/supabaseServer";
import { canManageIBG } from "@/lib/entitlements";

// ---------------------------------------------------------------------------
// POST /api/ibg/[assessmentId]/activate — activate a draft IBG spec
// ---------------------------------------------------------------------------

export async function POST(
  req: NextRequest,
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

    if (!canManageIBG(profile.plan)) {
      return NextResponse.json(
        { error: "Upgrade to Pro to manage IBG specifications", upgrade: true },
        { status: 403 }
      );
    }

    const body = await req.json();
    const specId = body.id;

    if (!specId) {
      return NextResponse.json({ error: "Spec id is required" }, { status: 400 });
    }

    // Verify spec exists, is draft, and belongs to this assessment + org
    const { data: spec } = await db
      .from("ibg_specifications")
      .select("id, status, authorised_goals")
      .eq("id", specId)
      .eq("assessment_id", assessmentId)
      .eq("organisation_id", profile.organisation_id)
      .single();

    if (!spec) {
      return NextResponse.json({ error: "IBG spec not found" }, { status: 404 });
    }

    if (spec.status !== "draft") {
      return NextResponse.json(
        { error: "Only draft specs can be activated" },
        { status: 400 }
      );
    }

    // Require at least one authorised goal to activate
    const goals = spec.authorised_goals as unknown[];
    if (!goals || goals.length === 0) {
      return NextResponse.json(
        { error: "At least one authorised goal is required to activate an IBG specification" },
        { status: 400 }
      );
    }

    // Activate — the DB trigger will auto-supersede any existing active spec
    const { data: activated, error: activateErr } = await db
      .from("ibg_specifications")
      .update({
        status: "active",
        effective_from: new Date().toISOString(),
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      })
      .eq("id", specId)
      .select("*")
      .single();

    if (activateErr || !activated) {
      return NextResponse.json(
        { error: activateErr?.message || "Failed to activate IBG spec" },
        { status: 500 }
      );
    }

    return NextResponse.json({ spec: activated });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
