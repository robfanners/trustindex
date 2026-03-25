import { NextRequest } from "next/server";
import { requireAuth, apiError, apiOk } from "@/lib/apiHelpers";

type RouteContext = { params: Promise<{ systemId: string }> };

/**
 * Verify the user owns this system.
 * Returns { system } on success, or an error response.
 */
async function verifySystemOwnership(db: SupabaseClient, userId: string, systemId: string) {
  const { data: system, error: sysErr } = await db
    .from("systems")
    .select("id, owner_id, name, version_label, archived, created_at")
    .eq("id", systemId)
    .single();

  if (sysErr || !system) {
    return { error: apiError("System not found", 404) };
  }

  if (system.owner_id !== userId) {
    return { error: apiError("Not authorised", 403) };
  }

  return { system };
}

// ---------------------------------------------------------------------------
// GET /api/systems/[systemId] — system detail + all runs
// ---------------------------------------------------------------------------

export async function GET(_req: NextRequest, context: RouteContext) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const { user, db } = auth;

  try {
    const { systemId } = await context.params;
    const result = await verifySystemOwnership(db, user.id, systemId);
    if ("error" in result) return result.error;

    const { system } = result;

    const { data: runs, error: runsErr } = await db
      .from("system_runs")
      .select(
        "id, version_label, status, overall_score, dimension_scores, risk_flags, created_at, submitted_at"
      )
      .eq("system_id", systemId)
      .order("created_at", { ascending: false });

    if (runsErr) {
      return apiError(runsErr.message, 500);
    }

    return apiOk({
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
    return apiError(message, 500);
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/systems/[systemId] — update name / version_label
// ---------------------------------------------------------------------------

export async function PATCH(req: NextRequest, context: RouteContext) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const { user, db } = auth;

  try {
    const { systemId } = await context.params;
    const result = await verifySystemOwnership(db, user.id, systemId);
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
      return apiError("No valid fields to update", 400);
    }

    const { data: updated, error: updateErr } = await db
      .from("systems")
      .update(updates)
      .eq("id", systemId)
      .select("id, name, version_label, created_at")
      .single();

    if (updateErr || !updated) {
      return apiError(updateErr?.message || "Failed to update system", 500);
    }

    return apiOk({ system: updated });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return apiError(message, 500);
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/systems/[systemId] — soft-delete (archive)
// ---------------------------------------------------------------------------

export async function DELETE(_req: NextRequest, context: RouteContext) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const { user, db } = auth;

  try {
    const { systemId } = await context.params;
    const result = await verifySystemOwnership(db, user.id, systemId);
    if ("error" in result) return result.error;

    const { error: archiveErr } = await db
      .from("systems")
      .update({ archived: true })
      .eq("id", systemId);

    if (archiveErr) {
      return apiError(archiveErr.message, 500);
    }

    return apiOk({ success: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return apiError(message, 500);
  }
}
