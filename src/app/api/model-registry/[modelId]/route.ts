import { NextRequest, NextResponse } from "next/server";
import { requireTier } from "@/lib/requireTier";
import { supabaseServer } from "@/lib/supabaseServer";
import { updateModelSchema, firstZodError } from "@/lib/validations";
import { writeAuditLog } from "@/lib/audit";

type RouteContext = { params: Promise<{ modelId: string }> };

// ---------------------------------------------------------------------------
// GET /api/model-registry/[modelId] — model detail with parent and linked systems
// ---------------------------------------------------------------------------

export async function GET(_req: NextRequest, context: RouteContext) {
  const check = await requireTier("Assure");
  if (!check.authorized) return check.response;
  if (!check.orgId) return NextResponse.json({ error: "No organisation linked" }, { status: 400 });

  const { modelId } = await context.params;
  const db = supabaseServer();

  const { data: model, error } = await db
    .from("model_registry")
    .select("*, parent:model_registry!parent_model_id(id, model_name, model_version, provider), linked_systems:system_model_links(system_id, role, systems(id, name))")
    .eq("id", modelId)
    .eq("organisation_id", check.orgId)
    .single();

  if (error || !model) {
    return NextResponse.json({ error: "Model not found" }, { status: 404 });
  }

  // Fetch children (models that use this as parent)
  const { data: children } = await db
    .from("model_registry")
    .select("id, model_name, model_version, provider, model_type, status")
    .eq("parent_model_id", modelId)
    .eq("organisation_id", check.orgId);

  return NextResponse.json({ data: { ...model, children: children ?? [] } });
}

// ---------------------------------------------------------------------------
// PATCH /api/model-registry/[modelId] — update model card
// ---------------------------------------------------------------------------

export async function PATCH(req: NextRequest, context: RouteContext) {
  const check = await requireTier("Assure");
  if (!check.authorized) return check.response;
  if (!check.orgId) return NextResponse.json({ error: "No organisation linked" }, { status: 400 });

  const { modelId } = await context.params;
  const body = await req.json();
  const parsed = updateModelSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 400 });
  }

  // Build update object, only including provided fields
  const updates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(parsed.data)) {
    if (value !== undefined) {
      updates[key] = value === "" ? null : value;
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const db = supabaseServer();

  // Verify model belongs to org
  const { data: existing } = await db
    .from("model_registry")
    .select("id")
    .eq("id", modelId)
    .eq("organisation_id", check.orgId)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Model not found" }, { status: 404 });
  }

  const { data, error } = await db
    .from("model_registry")
    .update(updates)
    .eq("id", modelId)
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "A model with this name and version already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await writeAuditLog({
    organisationId: check.orgId,
    entityType: "model",
    entityId: modelId,
    actionType: "updated",
    performedBy: check.userId,
    metadata: { updated_fields: Object.keys(updates) },
  });

  return NextResponse.json({ data });
}

// ---------------------------------------------------------------------------
// DELETE /api/model-registry/[modelId] — retire model
// ---------------------------------------------------------------------------

export async function DELETE(_req: NextRequest, context: RouteContext) {
  const check = await requireTier("Assure");
  if (!check.authorized) return check.response;
  if (!check.orgId) return NextResponse.json({ error: "No organisation linked" }, { status: 400 });

  const { modelId } = await context.params;
  const db = supabaseServer();

  // Verify model belongs to org
  const { data: existing } = await db
    .from("model_registry")
    .select("id, model_name")
    .eq("id", modelId)
    .eq("organisation_id", check.orgId)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Model not found" }, { status: 404 });
  }

  // Check if any systems still link to this model
  const { count } = await db
    .from("system_model_links")
    .select("id", { count: "exact", head: true })
    .eq("model_id", modelId);

  if (count && count > 0) {
    // Soft retire instead of delete
    await db
      .from("model_registry")
      .update({ status: "retired", retired_date: new Date().toISOString().split("T")[0] })
      .eq("id", modelId);

    await writeAuditLog({
      organisationId: check.orgId,
      entityType: "model",
      entityId: modelId,
      actionType: "status_change",
      performedBy: check.userId,
      metadata: { new_status: "retired", reason: "has_linked_systems" },
    });

    return NextResponse.json({ data: { status: "retired" } });
  }

  // Hard delete if no linked systems
  const { error } = await db
    .from("model_registry")
    .delete()
    .eq("id", modelId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAuditLog({
    organisationId: check.orgId,
    entityType: "model",
    entityId: modelId,
    actionType: "deleted",
    performedBy: check.userId,
    metadata: { model_name: existing.model_name },
  });

  return NextResponse.json({ data: { status: "deleted" } });
}
