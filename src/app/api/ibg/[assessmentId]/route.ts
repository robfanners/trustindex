import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-auth-server";
import { supabaseServer } from "@/lib/supabaseServer";
import { canManageIBG, canViewIBG } from "@/lib/entitlements";

// ---------------------------------------------------------------------------
// GET /api/ibg/[assessmentId] — fetch active or latest draft IBG spec
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

    // Try active first, fall back to latest draft
    const { data: spec } = await db
      .from("ibg_specifications")
      .select("*")
      .eq("assessment_id", assessmentId)
      .eq("organisation_id", profile.organisation_id)
      .in("status", ["active", "draft"])
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Also get version count
    const { count } = await db
      .from("ibg_specifications")
      .select("id", { count: "exact", head: true })
      .eq("assessment_id", assessmentId);

    return NextResponse.json({
      spec: spec ?? null,
      versionCount: count ?? 0,
      canEdit: canManageIBG(profile.plan),
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/ibg/[assessmentId] — create a new draft IBG spec
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

    // Verify the assessment belongs to this org
    const { data: system } = await db
      .from("systems")
      .select("id, owner_id")
      .eq("id", assessmentId)
      .single();

    if (!system) {
      return NextResponse.json({ error: "System not found" }, { status: 404 });
    }

    const body = await req.json();

    const { data: spec, error: insertErr } = await db
      .from("ibg_specifications")
      .insert({
        assessment_id: assessmentId,
        organisation_id: profile.organisation_id,
        status: "draft",
        authorised_goals: body.authorised_goals ?? [],
        decision_authorities: body.decision_authorities ?? [],
        action_spaces: body.action_spaces ?? [],
        blast_radius: body.blast_radius ?? {},
        effective_from: body.effective_from ?? null,
        effective_until: body.effective_until ?? null,
        created_by: user.id,
      })
      .select("*")
      .single();

    if (insertErr || !spec) {
      return NextResponse.json(
        { error: insertErr?.message || "Failed to create IBG spec" },
        { status: 500 }
      );
    }

    return NextResponse.json({ spec }, { status: 201 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PUT /api/ibg/[assessmentId] — update an existing draft IBG spec
// ---------------------------------------------------------------------------

export async function PUT(
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

    // Only allow updating draft specs
    const { data: existing } = await db
      .from("ibg_specifications")
      .select("id, status")
      .eq("id", specId)
      .eq("assessment_id", assessmentId)
      .eq("organisation_id", profile.organisation_id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: "IBG spec not found" }, { status: 404 });
    }

    if (existing.status !== "draft") {
      return NextResponse.json(
        { error: "Only draft specs can be updated. Create a new version to modify an active spec." },
        { status: 400 }
      );
    }

    const { data: spec, error: updateErr } = await db
      .from("ibg_specifications")
      .update({
        authorised_goals: body.authorised_goals,
        decision_authorities: body.decision_authorities,
        action_spaces: body.action_spaces,
        blast_radius: body.blast_radius,
        effective_from: body.effective_from ?? null,
        effective_until: body.effective_until ?? null,
      })
      .eq("id", specId)
      .select("*")
      .single();

    if (updateErr || !spec) {
      return NextResponse.json(
        { error: updateErr?.message || "Failed to update IBG spec" },
        { status: 500 }
      );
    }

    return NextResponse.json({ spec });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
