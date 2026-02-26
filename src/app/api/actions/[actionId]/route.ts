import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-auth-server";
import { supabaseServer } from "@/lib/supabaseServer";

type RouteContext = { params: Promise<{ actionId: string }> };

// ---------------------------------------------------------------------------
// Helper: authenticate + verify org ownership of action
// ---------------------------------------------------------------------------

async function authenticateAndAuthorise(actionId: string) {
  const authClient = await createSupabaseServerClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  }

  const db = supabaseServer();

  const { data: profile } = await db
    .from("profiles")
    .select("organisation_id")
    .eq("id", user.id)
    .single();

  const { data: action, error: fetchErr } = await db
    .from("actions")
    .select("*")
    .eq("id", actionId)
    .single();

  if (fetchErr || !action) {
    return { error: NextResponse.json({ error: "Action not found" }, { status: 404 }) };
  }

  if (profile?.organisation_id && action.organisation_id !== profile.organisation_id) {
    return { error: NextResponse.json({ error: "Not authorised" }, { status: 403 }) };
  }

  return { user, action };
}

// ---------------------------------------------------------------------------
// GET /api/actions/[actionId] — action detail with updates
// ---------------------------------------------------------------------------

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { actionId } = await context.params;
    const result = await authenticateAndAuthorise(actionId);
    if ("error" in result) return result.error;

    const { action } = result;
    const db = supabaseServer();

    const { data: updates } = await db
      .from("action_updates")
      .select("id, update_type, previous_value, new_value, updated_by, updated_at")
      .eq("action_id", actionId)
      .order("updated_at", { ascending: false });

    return NextResponse.json({ action, updates: updates || [] });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/actions/[actionId] — update action fields
// ---------------------------------------------------------------------------
// Body: { status?, severity?, owner_id?, due_date?, title?, description?,
//         evidence_url?, evidence? }

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { actionId } = await context.params;
    const result = await authenticateAndAuthorise(actionId);
    if ("error" in result) return result.error;

    const { user, action } = result;
    const db = supabaseServer();
    const body = await req.json();

    // Build update object + track changes for audit
    const updates: Record<string, unknown> = {};
    const changes: { field: string; from: unknown; to: unknown }[] = [];

    // Status transition
    if (body.status && body.status !== action.status) {
      const validStatuses = ["open", "in_progress", "blocked", "done"];
      if (!validStatuses.includes(body.status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      changes.push({ field: "status", from: action.status, to: body.status });
      updates.status = body.status;
    }

    // Severity
    if (body.severity && body.severity !== action.severity) {
      const validSeverities = ["low", "medium", "high", "critical"];
      if (!validSeverities.includes(body.severity)) {
        return NextResponse.json({ error: "Invalid severity" }, { status: 400 });
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
      return NextResponse.json({ action }); // no changes
    }

    const { data: updated, error: updateErr } = await db
      .from("actions")
      .update(updates)
      .eq("id", actionId)
      .select("*")
      .single();

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
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

    return NextResponse.json({ action: updated });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/actions/[actionId] — soft delete an action (mark as done)
// ---------------------------------------------------------------------------

export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const { actionId } = await context.params;
    const result = await authenticateAndAuthorise(actionId);
    if ("error" in result) return result.error;

    const { user } = result;
    const db = supabaseServer();

    const { error: deleteErr } = await db
      .from("actions")
      .delete()
      .eq("id", actionId);

    if (deleteErr) {
      return NextResponse.json({ error: deleteErr.message }, { status: 500 });
    }

    // Record audit entry before deletion data is lost
    await db.from("action_updates").insert({
      action_id: actionId,
      update_type: "deleted",
      previous_value: null,
      new_value: null,
      updated_by: user.id,
    });

    return NextResponse.json({ deleted: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
