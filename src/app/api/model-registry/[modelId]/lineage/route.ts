import { NextRequest, NextResponse } from "next/server";
import { requireTier } from "@/lib/requireTier";
import { supabaseServer } from "@/lib/supabaseServer";

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
  const check = await requireTier("Assure");
  if (!check.authorized) return check.response;
  if (!check.orgId) return NextResponse.json({ error: "No organisation linked" }, { status: 400 });

  const { modelId } = await context.params;
  const db = supabaseServer();

  // Fetch the model itself
  const { data: model, error } = await db
    .from("model_registry")
    .select("id, model_name, model_version, provider, model_type, status, parent_model_id")
    .eq("id", modelId)
    .eq("organisation_id", check.orgId)
    .single();

  if (error || !model) {
    return NextResponse.json({ error: "Model not found" }, { status: 404 });
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
      .eq("organisation_id", check.orgId)
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
    .eq("organisation_id", check.orgId)
    .order("created_at", { ascending: true });

  const current: LineageNode = {
    id: model.id,
    model_name: model.model_name,
    model_version: model.model_version,
    provider: model.provider,
    model_type: model.model_type,
    status: model.status,
  };

  return NextResponse.json({
    data: {
      ancestors,
      current,
      children: children ?? [],
    },
  });
}
