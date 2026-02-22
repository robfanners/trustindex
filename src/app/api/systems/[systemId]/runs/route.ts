import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-auth-server";
import { supabaseServer } from "@/lib/supabaseServer";

type RouteContext = { params: Promise<{ systemId: string }> };

// ---------------------------------------------------------------------------
// Helper: authenticate + verify system ownership
// ---------------------------------------------------------------------------

async function authenticateAndAuthorise(systemId: string) {
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
  const { data: system, error: sysErr } = await db
    .from("systems")
    .select("id, owner_id")
    .eq("id", systemId)
    .single();

  if (sysErr || !system) {
    return {
      error: NextResponse.json({ error: "System not found" }, { status: 404 }),
    };
  }

  if (system.owner_id !== user.id) {
    return {
      error: NextResponse.json({ error: "Not authorised" }, { status: 403 }),
    };
  }

  return { user, system };
}

// ---------------------------------------------------------------------------
// POST /api/systems/[systemId]/runs — create a new draft run
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { systemId } = await context.params;
    const result = await authenticateAndAuthorise(systemId);
    if ("error" in result) return result.error;

    const body = await req.json().catch(() => ({}));
    const versionLabel =
      typeof body.version_label === "string"
        ? body.version_label.trim() || null
        : null;

    const db = supabaseServer();

    const { data: run, error: insertErr } = await db
      .from("system_runs")
      .insert({
        system_id: systemId,
        version_label: versionLabel,
        status: "draft",
        question_set_version: "v1",
      })
      .select("id, system_id, version_label, status, question_set_version, created_at")
      .single();

    if (insertErr || !run) {
      return NextResponse.json(
        { error: insertErr?.message || "Failed to create run" },
        { status: 500 }
      );
    }

    return NextResponse.json({ run }, { status: 201 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// GET /api/systems/[systemId]/runs — list all runs for a system
// ---------------------------------------------------------------------------

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { systemId } = await context.params;
    const result = await authenticateAndAuthorise(systemId);
    if ("error" in result) return result.error;

    const db = supabaseServer();

    const { data: runs, error: listErr } = await db
      .from("system_runs")
      .select(
        "id, system_id, version_label, status, question_set_version, overall_score, dimension_scores, risk_flags, created_at, submitted_at"
      )
      .eq("system_id", systemId)
      .order("created_at", { ascending: false });

    if (listErr) {
      return NextResponse.json({ error: listErr.message }, { status: 500 });
    }

    return NextResponse.json({ runs: runs || [] });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
