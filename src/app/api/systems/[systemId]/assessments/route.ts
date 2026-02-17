import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-auth-server";
import { supabaseServer } from "@/lib/supabaseServer";

type RouteContext = { params: Promise<{ systemId: string }> };

// ---------------------------------------------------------------------------
// POST /api/systems/[systemId]/assessments — save a completed assessment
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { systemId } = await context.params;

    // Authenticate
    const authClient = await createSupabaseServerClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Verify system ownership
    const db = supabaseServer();
    const { data: system, error: sysErr } = await db
      .from("systems")
      .select("id, owner_id")
      .eq("id", systemId)
      .single();

    if (sysErr || !system) {
      return NextResponse.json({ error: "System not found" }, { status: 404 });
    }

    if (system.owner_id !== user.id) {
      return NextResponse.json({ error: "Not authorised" }, { status: 403 });
    }

    // Parse and validate body
    const body = await req.json();

    const dimensionScores = body.dimension_scores;
    if (!dimensionScores || typeof dimensionScores !== "object") {
      return NextResponse.json(
        { error: "dimension_scores is required and must be an object" },
        { status: 400 }
      );
    }

    const overallScore =
      typeof body.overall_score === "number" ? body.overall_score : null;
    const notes =
      typeof body.notes === "string" ? body.notes.trim() || null : null;

    // Insert assessment
    const { data: assessment, error: insertErr } = await db
      .from("system_assessments")
      .insert({
        system_id: systemId,
        dimension_scores: dimensionScores,
        overall_score: overallScore,
        notes,
      })
      .select("id, system_id, dimension_scores, overall_score, notes, created_at")
      .single();

    if (insertErr || !assessment) {
      return NextResponse.json(
        { error: insertErr?.message || "Failed to save assessment" },
        { status: 500 }
      );
    }

    return NextResponse.json({ assessment }, { status: 201 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
