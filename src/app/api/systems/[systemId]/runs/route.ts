import { NextRequest } from "next/server";
import { requireAuth, apiError, apiOk } from "@/lib/apiHelpers";

type RouteContext = { params: Promise<{ systemId: string }> };

// ---------------------------------------------------------------------------
// Helper: verify system ownership
// ---------------------------------------------------------------------------

async function verifySystemOwnership(db: any, userId: string, systemId: string) {
  const { data: system, error: sysErr } = await db
    .from("systems")
    .select("id, owner_id")
    .eq("id", systemId)
    .single();

  if (sysErr || !system) {
    return {
      error: apiError("System not found", 404),
    };
  }

  if (system.owner_id !== userId) {
    return {
      error: apiError("Not authorised", 403),
    };
  }

  return { system };
}

// ---------------------------------------------------------------------------
// POST /api/systems/[systemId]/runs — create a new draft run
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest, context: RouteContext) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const { user, db } = auth;

  try {
    const { systemId } = await context.params;
    const result = await verifySystemOwnership(db, user.id, systemId);
    if ("error" in result) return result.error;

    const body = await req.json().catch(() => ({}));
    const versionLabel =
      typeof body.version_label === "string"
        ? body.version_label.trim() || null
        : null;

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
      return apiError(insertErr?.message || "Failed to create run", 500);
    }

    return apiOk({ run }, 201);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return apiError(message, 500);
  }
}

// ---------------------------------------------------------------------------
// GET /api/systems/[systemId]/runs — list all runs for a system
// ---------------------------------------------------------------------------

export async function GET(_req: NextRequest, context: RouteContext) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const { user, db } = auth;

  try {
    const { systemId } = await context.params;
    const result = await verifySystemOwnership(db, user.id, systemId);
    if ("error" in result) return result.error;

    const { data: runs, error: listErr } = await db
      .from("system_runs")
      .select(
        "id, system_id, version_label, status, question_set_version, overall_score, dimension_scores, risk_flags, created_at, submitted_at"
      )
      .eq("system_id", systemId)
      .order("created_at", { ascending: false });

    if (listErr) {
      return apiError(listErr.message, 500);
    }

    return apiOk({ runs: runs || [] });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return apiError(message, 500);
  }
}
