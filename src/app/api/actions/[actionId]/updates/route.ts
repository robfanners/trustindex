import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-auth-server";
import { supabaseServer } from "@/lib/supabaseServer";

type RouteContext = { params: Promise<{ actionId: string }> };

// ---------------------------------------------------------------------------
// GET /api/actions/[actionId]/updates — list immutable audit trail
// ---------------------------------------------------------------------------

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { actionId } = await context.params;

    const authClient = await createSupabaseServerClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const db = supabaseServer();

    // Verify action exists and user has access
    const { data: profile } = await db
      .from("profiles")
      .select("organisation_id")
      .eq("id", user.id)
      .single();

    const { data: action } = await db
      .from("actions")
      .select("id, organisation_id")
      .eq("id", actionId)
      .single();

    if (!action) {
      return NextResponse.json({ error: "Action not found" }, { status: 404 });
    }

    if (profile?.organisation_id && action.organisation_id !== profile.organisation_id) {
      return NextResponse.json({ error: "Not authorised" }, { status: 403 });
    }

    const { data: updates, error: fetchErr } = await db
      .from("action_updates")
      .select("id, update_type, previous_value, new_value, updated_by, updated_at")
      .eq("action_id", actionId)
      .order("updated_at", { ascending: false });

    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }

    return NextResponse.json({ updates: updates || [] });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/actions/[actionId]/updates — add evidence note / comment
// ---------------------------------------------------------------------------
// Body: { type: "note" | "evidence", content: string, metadata?: object }

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { actionId } = await context.params;

    const authClient = await createSupabaseServerClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const db = supabaseServer();

    // Verify action exists and user has access
    const { data: profile } = await db
      .from("profiles")
      .select("organisation_id")
      .eq("id", user.id)
      .single();

    const { data: action } = await db
      .from("actions")
      .select("id, organisation_id")
      .eq("id", actionId)
      .single();

    if (!action) {
      return NextResponse.json({ error: "Action not found" }, { status: 404 });
    }

    if (profile?.organisation_id && action.organisation_id !== profile.organisation_id) {
      return NextResponse.json({ error: "Not authorised" }, { status: 403 });
    }

    const body = await req.json();
    const updateType = body.type === "evidence" ? "evidence_added" : "note_added";
    const content = String(body.content || "").trim();

    if (!content) {
      return NextResponse.json({ error: "content is required" }, { status: 400 });
    }

    const { data: update, error: insertErr } = await db
      .from("action_updates")
      .insert({
        action_id: actionId,
        update_type: updateType,
        previous_value: null,
        new_value: {
          content,
          ...(body.metadata ? { metadata: body.metadata } : {}),
        },
        updated_by: user.id,
      })
      .select("id, update_type, new_value, updated_by, updated_at")
      .single();

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({ update }, { status: 201 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
