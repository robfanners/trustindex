import { NextRequest, NextResponse } from "next/server";
import { requireTier } from "@/lib/requireTier";
import { supabaseServer } from "@/lib/supabaseServer";
import { linkModelToSystemSchema, firstZodError } from "@/lib/validations";
import { writeAuditLog } from "@/lib/audit";

// ---------------------------------------------------------------------------
// POST /api/model-registry/links — link a model to a system
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const check = await requireTier("Assure");
  if (!check.authorized) return check.response;
  if (!check.orgId) return NextResponse.json({ error: "No organisation linked" }, { status: 400 });

  const body = await req.json();
  const parsed = linkModelToSystemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 400 });
  }

  const { system_id, model_id, role } = parsed.data;
  const db = supabaseServer();

  // Verify system belongs to org
  const { data: system } = await db
    .from("systems")
    .select("id, owner_id, profiles!inner(organisation_id)")
    .eq("id", system_id)
    .single();

  if (!system) {
    return NextResponse.json({ error: "System not found" }, { status: 404 });
  }

  // Verify model belongs to org
  const { data: model } = await db
    .from("model_registry")
    .select("id, model_name")
    .eq("id", model_id)
    .eq("organisation_id", check.orgId)
    .single();

  if (!model) {
    return NextResponse.json({ error: "Model not found" }, { status: 404 });
  }

  const { data, error } = await db
    .from("system_model_links")
    .insert({
      system_id,
      model_id,
      role: role || "primary",
      added_by: check.userId,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "This model is already linked to this system" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await writeAuditLog({
    organisationId: check.orgId,
    entityType: "model_link",
    entityId: data.id,
    actionType: "created",
    performedBy: check.userId,
    metadata: { system_id, model_id, model_name: model.model_name, role: role || "primary" },
  });

  return NextResponse.json({ data }, { status: 201 });
}

// ---------------------------------------------------------------------------
// DELETE /api/model-registry/links — unlink a model from a system
// ---------------------------------------------------------------------------

export async function DELETE(req: NextRequest) {
  const check = await requireTier("Assure");
  if (!check.authorized) return check.response;
  if (!check.orgId) return NextResponse.json({ error: "No organisation linked" }, { status: 400 });

  const body = await req.json();
  const { system_id, model_id } = body;

  if (!system_id || !model_id) {
    return NextResponse.json({ error: "system_id and model_id are required" }, { status: 400 });
  }

  const db = supabaseServer();

  const { data: link } = await db
    .from("system_model_links")
    .select("id")
    .eq("system_id", system_id)
    .eq("model_id", model_id)
    .single();

  if (!link) {
    return NextResponse.json({ error: "Link not found" }, { status: 404 });
  }

  const { error } = await db
    .from("system_model_links")
    .delete()
    .eq("id", link.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAuditLog({
    organisationId: check.orgId,
    entityType: "model_link",
    entityId: link.id,
    actionType: "deleted",
    performedBy: check.userId,
    metadata: { system_id, model_id },
  });

  return NextResponse.json({ data: { status: "unlinked" } });
}
