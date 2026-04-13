import { NextRequest, NextResponse } from "next/server";
import { requireAuth, apiError, apiOk } from "@/lib/apiHelpers";
import { hasTierAccess } from "@/lib/tiers";

type RouteContext = { params: Promise<{ modelId: string }> };

type LineageNode = {
  id: string;
  model_name: string;
  model_version: string;
  provider: string | null;
  model_type: string | null;
  status: string;
};

// ---------------------------------------------------------------------------
// GET /api/model-registry/[modelId]/lineage — walk parent chain + children
// ---------------------------------------------------------------------------

export async function GET(_req: NextRequest, context: RouteContext) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  if (!hasTierAccess(auth.plan, "Assure")) {
    return apiError("Plan upgrade required", 403);
  }

  const { modelId } = await context.params;
  const db = auth.db;

  // Fetch the model itself
  const { data: model, error } = await db
    .from("model_registry")
    .select("id, model_name, model_version, provider, model_type, status, parent_model_id")
    .eq("id", modelId)
    .eq("organisation_id", auth.orgId)
    .single();

  if (error || !model) {
    return apiError("Model not found", 404);
  }

  // Walk ancestors (parent chain upward, max 10 levels)
  const ancestors: LineageNode[] = [];
  let currentParentId = model.parent_model_id;
  const visited = new Set<string>([modelId]);

  while (currentParentId && ancestors.length < 10) {
    if (visited.has(currentParentId)) break; // circular reference guard
    visited.add(currentParentId);

    const { data: parent } = await db
      .from("model_registry")
      .select("id, model_name, model_version, provider, model_type, status, parent_model_id")
      .eq("id", currentParentId)
      .eq("organisation_id", auth.orgId)
      .single();

    if (!parent) break;
    ancestors.unshift({
      id: parent.id,
      model_name: parent.model_name,
      model_version: parent.model_version,
      provider: parent.provider,
      model_type: parent.model_type,
      status: parent.status,
    });
    currentParentId = parent.parent_model_id;
  }

  // Fetch direct children
  const { data: children } = await db
    .from("model_registry")
    .select("id, model_name, model_version, provider, model_type, status")
    .eq("parent_model_id", modelId)
    .eq("organisation_id", auth.orgId)
    .order("created_at", { ascending: true });

  const current: LineageNode = {
    id: model.id,
    model_name: model.model_name,
    model_version: model.model_version,
    provider: model.provider,
    model_type: model.model_type,
    status: model.status,
  };

  return apiOk({
    data: {
      ancestors,
      current,
      children: children ?? [],
    },
  });
}
