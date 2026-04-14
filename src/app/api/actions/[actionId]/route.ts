import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAuth, apiError, apiOk } from "@/lib/apiHelpers";
import { writeAuditLog } from "@/lib/audit";

type RouteContext = { params: Promise<{ actionId: string }> };

// ---------------------------------------------------------------------------
// Helper: verify org ownership of action
// ---------------------------------------------------------------------------

async function verifyActionOwnership(db: SupabaseClient, orgId: string, actionId: string) {
  const { data: action, error: fetchErr } = await db
    .from("actions")
    .select("*")
    .eq("id", actionId)
    .single();

  if (fetchErr || !action) {
    return { error: apiError("Action not found", 404) };
  }

  if (action.organisation_id !== orgId) {
    return { error: apiError("Not authorised", 403) };
  }

  return { action };
}

// ---------------------------------------------------------------------------
// GET /api/actions/[actionId] — action detail with updates
// ---------------------------------------------------------------------------

export async function GET(_req: NextRequest, context: RouteContext) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const { orgId, db } = auth;

  try {
    const { actionId } = await context.params;
    const authResult = await verifyActionOwnership(db, orgId, actionId);
    if ("error" in authResult) return authResult.error;

    const { action } = authResult;

    const { data: updates } = await db
      .from("action_updates")
      .select("id, update_type, previous_value, new_value, updated_by, updated_at")
      .eq("action_id", actionId)
      .order("updated_at", { ascending: false });

    return apiOk({ action, updates: updates || [] });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return apiError(message, 500);
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/actions/[actionId] — update action fields
// ---------------------------------------------------------------------------
// Body: { status?, severity?, owner_id?, due_date?, title?, description?,
//         evidence_url?, evidence? }

export async function PATCH(req: NextRequest, context: RouteContext) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const { user, orgId, db } = auth;

  try {
    const { actionId } = await context.params;
    const authResult = await verifyActionOwnership(db, orgId, actionId);
    if ("error" in authResult) return authResult.error;

    const { action } = authResult;
    const body = await req.json();

    // Build update object + track changes for audit
    const updates: Record<string, unknown> = {};
    const changes: { field: string; from: unknown; to: unknown }[] = [];

    // Status transition
    if (body.status && body.status !== action.status) {
      const validStatuses = ["open", "in_progress", "blocked", "done"];
      if (!validStatuses.includes(body.status)) {
        return apiError("Invalid status", 400);
      }
      changes.push({ field: "status", from: action.status, to: body.status });
      updates.status = body.status;
    }

    // Severity
    if (body.severity && body.severity !== action.severity) {
      const validSeverities = ["low", "medium", "high", "critical"];
      if (!validSeverities.includes(body.severity)) {
        return apiError("Invalid severity", 400);
      }
      changes.push({ field: "severity", from: action.severity, to: body.severity });
      updates.severity = body.severity;
    }

    // Owner
    if (body.owner_id !== undefined && body.owner_id !== action.owner_id) {
      changes.push({ field: "owner_id", from: action.owner_id, to: body.owner_id });
      updates.owner_id = body.owner_id || null;
    }

    // Due date
    if (body.due_date !== undefined && body.due_date !== action.due_date) {
      changes.push({ field: "due_date", from: action.due_date, to: body.due_date });
      updates.due_date = body.due_date || null;
    }

    // Title
    if (typeof body.title === "string" && body.title.trim() && body.title.trim() !== action.title) {
      changes.push({ field: "title", from: action.title, to: body.title.trim() });
      updates.title = body.title.trim();
    }

    // Description
    if (body.description !== undefined && body.description !== action.description) {
      changes.push({ field: "description", from: action.description, to: body.description });
      updates.description = body.description || null;
    }

    // Evidence URL
    if (body.evidence_url !== undefined && body.evidence_url !== action.evidence_url) {
      changes.push({ field: "evidence_url", from: action.evidence_url, to: body.evidence_url });
      updates.evidence_url = body.evidence_url || null;
    }

    // Evidence (jsonb merge)
    if (body.evidence !== undefined) {
      const merged = { ...(action.evidence || {}), ...body.evidence };
      changes.push({ field: "evidence", from: action.evidence, to: merged });
      updates.evidence = merged;
    }

    if (Object.keys(updates).length === 0) {
      return apiOk({ action }); // no changes
    }

    const { data: updated, error: updateErr } = await db
      .from("actions")
      .update(updates)
      .eq("id", actionId)
      .select("*")
      .single();

    if (updateErr) {
      return apiError(updateErr.message, 500);
    }

    // Record each change as an immutable audit entry
    for (const change of changes) {
      await db.from("action_updates").insert({
        action_id: actionId,
        update_type: `field_change:${change.field}`,
        previous_value: change.from != null ? { value: change.from } : null,
        new_value: { value: change.to },
        updated_by: user.id,
      });
    }

    await writeAuditLog({
      organisationId: updated.organisation_id,
      entityType: "action",
      entityId: actionId,
      actionType: "updated",
      performedBy: user.id,
      metadata: { changes: changes.map(c => ({ field: c.field, from: c.from, to: c.to })) },
    });

    return apiOk({ action: updated });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return apiError(message, 500);
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/actions/[actionId] — soft delete an action (mark as done)
// ---------------------------------------------------------------------------

export async function DELETE(_req: NextRequest, context: RouteContext) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const { user, orgId, db } = auth;

  try {
    const { actionId } = await context.params;
    const authResult = await verifyActionOwnership(db, orgId, actionId);
    if ("error" in authResult) return authResult.error;

    const { error: deleteErr } = await db
      .from("actions")
      .delete()
      .eq("id", actionId);

    if (deleteErr) {
      return apiError(deleteErr.message, 500);
    }

    // Record audit entry before deletion data is lost
    await db.from("action_updates").insert({
      action_id: actionId,
      update_type: "deleted",
      previous_value: null,
      new_value: null,
      updated_by: user.id,
    });

    return apiOk({ deleted: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return apiError(message, 500);
  }
}
