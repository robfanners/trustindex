import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-auth-server";
import { supabaseServer } from "@/lib/supabaseServer";

type RouteContext = { params: Promise<{ systemId: string }> };

/**
 * Authenticate the request and verify the user owns this system.
 * Returns { user, system } on success, or a NextResponse error.
 */
async function authenticateAndAuthorise(systemId: string) {
  const authClient = await createSupabaseServerClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  }

  const db = supabaseServer();
  const { data: system, error: sysErr } = await db
    .from("systems")
    .select("id, owner_id, name, version_label, archived, created_at")
    .eq("id", systemId)
    .single();

  if (sysErr || !system) {
    return { error: NextResponse.json({ error: "System not found" }, { status: 404 }) };
  }

  if (system.owner_id !== user.id) {
    return { error: NextResponse.json({ error: "Not authorised" }, { status: 403 }) };
  }

  return { user, system };
}

// ---------------------------------------------------------------------------
// GET /api/systems/[systemId] — system detail + all runs
// ---------------------------------------------------------------------------

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { systemId } = await context.params;
    const result = await authenticateAndAuthorise(systemId);
    if ("error" in result) return result.error;

    const { system } = result;
    const db = supabaseServer();

    const { data: runs, error: runsErr } = await db
      .from("system_runs")
      .select(
        "id, version_label, status, overall_score, dimension_scores, risk_flags, created_at, submitted_at"
      )
      .eq("system_id", systemId)
      .order("created_at", { ascending: false });

    if (runsErr) {
      return NextResponse.json({ error: runsErr.message }, { status: 500 });
    }

    return NextResponse.json({
      system: {
        id: system.id,
        name: system.name,
        version_label: system.version_label,
        archived: system.archived,
        created_at: system.created_at,
      },
      runs: runs || [],
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/systems/[systemId] — update name / version_label
// ---------------------------------------------------------------------------

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { systemId } = await context.params;
    const result = await authenticateAndAuthorise(systemId);
    if ("error" in result) return result.error;

    const body = await req.json();
    const updates: Record<string, string> = {};

    if (typeof body.name === "string" && body.name.trim()) {
      updates.name = body.name.trim();
    }
    if (typeof body.version_label === "string") {
      updates.version_label = body.version_label.trim();
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const db = supabaseServer();
    const { data: updated, error: updateErr } = await db
      .from("systems")
      .update(updates)
      .eq("id", systemId)
      .select("id, name, version_label, created_at")
      .single();

    if (updateErr || !updated) {
      return NextResponse.json(
        { error: updateErr?.message || "Failed to update system" },
        { status: 500 }
      );
    }

    return NextResponse.json({ system: updated });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/systems/[systemId] — soft-delete (archive)
// ---------------------------------------------------------------------------

export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const { systemId } = await context.params;
    const result = await authenticateAndAuthorise(systemId);
    if ("error" in result) return result.error;

    const db = supabaseServer();
    const { error: archiveErr } = await db
      .from("systems")
      .update({ archived: true })
      .eq("id", systemId);

    if (archiveErr) {
      return NextResponse.json({ error: archiveErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
