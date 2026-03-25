import { NextRequest } from "next/server";
import { requireAuth, apiError, apiOk } from "@/lib/apiHelpers";

type RouteContext = { params: Promise<{ actionId: string }> };

// ---------------------------------------------------------------------------
// GET /api/actions/[actionId]/updates — list immutable audit trail
// ---------------------------------------------------------------------------

export async function GET(_req: NextRequest, context: RouteContext) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const { orgId, db } = auth;

  try {
    const { actionId } = await context.params;

    // Verify action exists and user has access
    const { data: action } = await db
      .from("actions")
      .select("id, organisation_id")
      .eq("id", actionId)
      .single();

    if (!action) {
      return apiError("Action not found", 404);
    }

    if (action.organisation_id !== orgId) {
      return apiError("Not authorised", 403);
    }

    const { data: updates, error: fetchErr } = await db
      .from("action_updates")
      .select("id, update_type, previous_value, new_value, updated_by, updated_at")
      .eq("action_id", actionId)
      .order("updated_at", { ascending: false });

    if (fetchErr) {
      return apiError(fetchErr.message, 500);
    }

    return apiOk({ updates: updates || [] });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return apiError(message, 500);
  }
}

// ---------------------------------------------------------------------------
// POST /api/actions/[actionId]/updates — add evidence note / comment
// ---------------------------------------------------------------------------
// Body: { type: "note" | "evidence", content: string, metadata?: object }

export async function POST(req: NextRequest, context: RouteContext) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const { user, orgId, db } = auth;

  try {
    const { actionId } = await context.params;

    // Verify action exists and user has access
    const { data: action } = await db
      .from("actions")
      .select("id, organisation_id")
      .eq("id", actionId)
      .single();

    if (!action) {
      return apiError("Action not found", 404);
    }

    if (action.organisation_id !== orgId) {
      return apiError("Not authorised", 403);
    }

    const body = await req.json();
    const updateType = body.type === "evidence" ? "evidence_added" : "note_added";
    const content = String(body.content || "").trim();

    if (!content) {
      return apiError("content is required", 400);
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
      return apiError(insertErr.message, 500);
    }

    return apiOk({ update }, 201);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return apiError(message, 500);
  }
}
