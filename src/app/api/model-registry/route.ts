import { NextRequest } from "next/server";
import { requireAuth, apiError, apiOk } from "@/lib/apiHelpers";
import { createModelSchema, firstZodError } from "@/lib/validations";
import { writeAuditLog } from "@/lib/audit";
import { hasTierAccess } from "@/lib/tiers";

// ---------------------------------------------------------------------------
// GET /api/model-registry — list models for the organisation
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  if (!hasTierAccess(auth.plan, "Assure")) {
    return apiError("Plan upgrade required", 403);
  }

  const params = req.nextUrl.searchParams;
  const page = Math.max(1, Number(params.get("page") || 1));
  const perPage = Math.min(100, Math.max(1, Number(params.get("per_page") || 50)));
  const offset = (page - 1) * perPage;
  const statusFilter = params.get("status");
  const systemId = params.get("system_id");

  const db = auth.db;

  // If filtering by system_id, get model IDs linked to that system first
  let modelIds: string[] | null = null;
  if (systemId) {
    const { data: links } = await db
      .from("system_model_links")
      .select("model_id")
      .eq("system_id", systemId);
    modelIds = (links ?? []).map((l) => l.model_id);
    if (modelIds.length === 0) {
      return apiOk({ models: [], total: 0 });
    }
  }

  let query = db
    .from("model_registry")
    .select("*, linked_systems:system_model_links(count)", { count: "exact" })
    .eq("organisation_id", auth.orgId)
    .order("created_at", { ascending: false })
    .range(offset, offset + perPage - 1);

  if (statusFilter) {
    query = query.eq("status", statusFilter);
  }
  if (modelIds) {
    query = query.in("id", modelIds);
  }

  const { data, count, error } = await query;

  if (error) return apiError(error.message, 500);

  const models = (data ?? []).map((m) => ({
    ...m,
    linked_systems_count: Array.isArray(m.linked_systems) ? m.linked_systems[0]?.count ?? 0 : 0,
    linked_systems: undefined,
  }));

  return apiOk({ models, total: count ?? 0 });
}

// ---------------------------------------------------------------------------
// POST /api/model-registry — register a new model card
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  if (!hasTierAccess(auth.plan, "Assure")) {
    return apiError("Plan upgrade required", 403);
  }

  const body = await req.json();
  const parsed = createModelSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(firstZodError(parsed.error), 400);
  }

  const {
    model_name, model_version, provider, model_type, capabilities,
    training_data_sources, deployment_date, status, parent_model_id,
    model_card_url, notes,
  } = parsed.data;

  const db = auth.db;

  // Validate parent_model_id belongs to same org
  if (parent_model_id) {
    const { data: parent } = await db
      .from("model_registry")
      .select("id")
      .eq("id", parent_model_id)
      .eq("organisation_id", auth.orgId)
      .single();
    if (!parent) {
      return apiError("Parent model not found in your organisation", 400);
    }
  }

  const { data, error } = await db
    .from("model_registry")
    .insert({
      organisation_id: auth.orgId,
      model_name,
      model_version,
      provider: provider || null,
      model_type: model_type || null,
      capabilities: capabilities || null,
      training_data_sources: training_data_sources || null,
      deployment_date: deployment_date || null,
      status: status || "active",
      parent_model_id: parent_model_id || null,
      model_card_url: model_card_url || null,
      notes: notes || null,
      created_by: auth.user.id,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return apiError("A model with this name and version already exists", 409);
    }
    return apiError(error.message, 500);
  }

  await writeAuditLog({
    organisationId: auth.orgId,
    entityType: "model",
    entityId: data.id,
    actionType: "created",
    performedBy: auth.user.id,
    metadata: { model_name, model_version, provider: provider || null },
  });

  return apiOk({ data }, 201);
}
