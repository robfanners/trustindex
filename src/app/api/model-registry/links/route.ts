import { NextRequest, NextResponse } from "next/server";
import { requireAuth, apiError, apiOk } from "@/lib/apiHelpers";
import { linkModelToSystemSchema, firstZodError } from "@/lib/validations";
import { writeAuditLog } from "@/lib/audit";
import { hasTierAccess } from "@/lib/tiers";

// ---------------------------------------------------------------------------
// POST /api/model-registry/links — link a model to a system
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  if (!hasTierAccess(auth.plan, "Assure")) {
    return apiError("Plan upgrade required", 403);
  }

  const body = await req.json();
  const parsed = linkModelToSystemSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(firstZodError(parsed.error), 400);
  }

  const { system_id, model_id, role } = parsed.data;
  const db = auth.db;

  // Verify system belongs to org
  const { data: system } = await db
    .from("systems")
    .select("id, owner_id, profiles!inner(organisation_id)")
    .eq("id", system_id)
    .single();

  if (!system) {
    return apiError("System not found", 404);
  }

  // Verify model belongs to org
  const { data: model } = await db
    .from("model_registry")
    .select("id, model_name")
    .eq("id", model_id)
    .eq("organisation_id", auth.orgId)
    .single();

  if (!model) {
    return apiError("Model not found", 404);
  }

  const { data, error } = await db
    .from("system_model_links")
    .insert({
      system_id,
      model_id,
      role: role || "primary",
      added_by: auth.user.id,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return apiError("This model is already linked to this system", 409);
    }
    return apiError(error.message, 500);
  }

  await writeAuditLog({
    organisationId: auth.orgId,
    entityType: "model_link",
    entityId: data.id,
    actionType: "created",
    performedBy: auth.user.id,
    metadata: { system_id, model_id, model_name: model.model_name, role: role || "primary" },
  });

  return apiOk({ data }, 201);
}

// ---------------------------------------------------------------------------
// DELETE /api/model-registry/links — unlink a model from a system
// ---------------------------------------------------------------------------

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  if (!hasTierAccess(auth.plan, "Assure")) {
    return apiError("Plan upgrade required", 403);
  }

  const body = await req.json();
  const { system_id, model_id } = body;

  if (!system_id || !model_id) {
    return apiError("system_id and model_id are required", 400);
  }

  const db = auth.db;

  const { data: link } = await db
    .from("system_model_links")
    .select("id")
    .eq("system_id", system_id)
    .eq("model_id", model_id)
    .single();

  if (!link) {
    return apiError("Link not found", 404);
  }

  const { error } = await db
    .from("system_model_links")
    .delete()
    .eq("id", link.id);

  if (error) return apiError(error.message, 500);

  await writeAuditLog({
    organisationId: auth.orgId,
    entityType: "model_link",
    entityId: link.id,
    actionType: "deleted",
    performedBy: auth.user.id,
    metadata: { system_id, model_id },
  });

  return apiOk({ data: { status: "unlinked" } });
}
