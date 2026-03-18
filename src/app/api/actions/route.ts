import { NextRequest } from "next/server";
import { requireAuth, apiOk, withErrorHandling, parseBody } from "@/lib/apiHelpers";
import { writeAuditLog } from "@/lib/audit";
import { createActionSchema } from "@/lib/validations";

// GET /api/actions — list actions for the user's org
// Query params: status, severity, source_type, linked_run_id, owner_id, page, per_page

export async function GET(req: NextRequest) {
  return withErrorHandling(async () => {
    const auth = await requireAuth();
    if (auth.error) return auth.error;

    const { orgId, db } = auth;
    const url = req.nextUrl;

    const status = url.searchParams.get("status");
    const severity = url.searchParams.get("severity");
    const sourceType = url.searchParams.get("source_type");
    const linkedRunId = url.searchParams.get("linked_run_id");
    const ownerId = url.searchParams.get("owner_id");
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
    const perPage = Math.min(100, Math.max(1, Number(url.searchParams.get("per_page")) || 50));

    let query = db
      .from("actions")
      .select("*", { count: "exact" })
      .eq("organisation_id", orgId)
      .order("created_at", { ascending: false })
      .range((page - 1) * perPage, page * perPage - 1);

    if (status) query = query.eq("status", status);
    if (severity) query = query.eq("severity", severity);
    if (sourceType) query = query.eq("source_type", sourceType);
    if (linkedRunId) query = query.eq("linked_run_id", linkedRunId);
    if (ownerId) query = query.eq("owner_id", ownerId);

    const { data: actions, error: fetchErr, count } = await query;

    if (fetchErr) {
      throw new Error(fetchErr.message);
    }

    return apiOk({
      actions: actions || [],
      total: count ?? 0,
      page,
      per_page: perPage,
    });
  });
}

// POST /api/actions — create a new action
// Body: { title, description?, severity?, owner_id?, due_date?,
//         linked_run_id?, linked_run_type?, linked_dimension?,
//         source_recommendation?, source_type? }

export async function POST(req: NextRequest) {
  return withErrorHandling(async () => {
    const auth = await requireAuth();
    if (auth.error) return auth.error;

    const { user, orgId, db } = auth;
    const parsed = await parseBody(req, createActionSchema);
    if (parsed.error) return parsed.error;
    const body = parsed.data;

    const title = body.title.trim();
    const description = body.description?.trim() ?? null;
    const severity = body.severity ?? "medium";
    const status = "open"; // always starts open
    const ownerId = body.owner_id ?? null;
    const dueDate = body.due_date ?? null;
    const linkedRunId = body.linked_run_id ?? null;
    const linkedRunType = body.linked_run_type ?? null;
    const linkedDimension = body.linked_dimension?.trim() ?? null;

    // Resolve dimension name to dimension_id if provided
    let dimensionId: string | null = null;
    if (linkedDimension) {
      const { data: dim } = await db
        .from("dimensions")
        .select("id")
        .eq("name", linkedDimension)
        .maybeSingle();
      dimensionId = dim?.id ?? null;
    }

    // Store source recommendation metadata if provided
    const evidence = body.source_recommendation
      ? { source: "recommendation", recommendation: body.source_recommendation }
      : null;

    const sourceType = body.source_type?.trim() ?? null;

    const { data: action, error: insertErr } = await db
      .from("actions")
      .insert({
        organisation_id: orgId,
        title,
        description,
        severity,
        status,
        owner_id: ownerId,
        due_date: dueDate,
        linked_run_id: linkedRunId,
        linked_run_type: linkedRunType,
        dimension_id: dimensionId,
        evidence,
        source_type: sourceType,
      })
      .select("*")
      .single();

    if (insertErr || !action) {
      throw new Error(insertErr?.message || "Failed to create action");
    }

    // Create initial audit entry
    await db.from("action_updates").insert({
      action_id: action.id,
      update_type: "created",
      previous_value: null,
      new_value: { title, severity, status: "open" },
      updated_by: user.id,
    });

    await writeAuditLog({
      organisationId: orgId,
      entityType: "action",
      entityId: action.id,
      actionType: "created",
      performedBy: user.id,
      metadata: { title, severity, source_type: sourceType },
    });

    return apiOk({ action }, 201);
  });
}
