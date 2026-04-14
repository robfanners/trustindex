import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth, apiError, apiOk, parseBody } from "@/lib/apiHelpers";
import { supabaseServer } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

type RouteContext = { params: Promise<{ systemId: string; entryId: string }> };

const updateDataInventorySchema = z.object({
  data_type: z.string().min(1).optional(),
  classification: z
    .enum(["none", "public", "internal", "confidential", "pii", "sensitive_pii", "phi", "financial"])
    .optional(),
  residency: z.enum(["uk", "eu", "us", "apac", "global", "unknown"]).optional(),
  volume_estimate: z.string().optional().nullable(),
  retention_days: z.number().int().positive().optional().nullable(),
  source_description: z.string().optional().nullable(),
  processor: z.string().optional().nullable(),
});

/**
 * Verify the entry belongs to the assessment and user has access.
 * Returns { entry, assessment, orgId } on success, or an error response.
 */
async function verifyEntryOwnership(
  db: SupabaseClient,
  userId: string,
  assessmentId: string,
  entryId: string
) {
  // Get entry with its assessment
  const { data: entry, error: entErr } = await db
    .from("system_data_inventory")
    .select("id, assessment_id, organisation_id")
    .eq("id", entryId)
    .single();

  if (entErr || !entry) {
    return { error: apiError("Entry not found", 404) };
  }

  // Verify entry belongs to the given assessment
  if (entry.assessment_id !== assessmentId) {
    return { error: apiError("Entry does not belong to this assessment", 400) };
  }

  // Verify user belongs to the org
  const { data: profile } = await db
    .from("profiles")
    .select("organisation_id")
    .eq("id", userId)
    .single();

  const userOrgId = (profile as { organisation_id?: string } | null)?.organisation_id;
  if (userOrgId !== entry.organisation_id) {
    return { error: apiError("Not authorised", 403) };
  }

  return { entry, orgId: entry.organisation_id as string };
}

// ---------------------------------------------------------------------------
// PATCH /api/systems/[systemId]/data-inventory/[entryId] — update entry
// ---------------------------------------------------------------------------

export async function PATCH(req: NextRequest, context: RouteContext) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const { user } = auth;

  try {
    const { systemId, entryId } = await context.params;

    // Parse body
    const parsed = await parseBody(req, updateDataInventorySchema);
    if (parsed.error) return parsed.error;

    // Verify ownership
    const db = supabaseServer();
    const result = await verifyEntryOwnership(db, user.id, systemId, entryId);
    if ("error" in result) return result.error;

    const updates: Record<string, unknown> = {};
    if (parsed.data.data_type !== undefined)
      updates.data_type = parsed.data.data_type;
    if (parsed.data.classification !== undefined)
      updates.classification = parsed.data.classification;
    if (parsed.data.residency !== undefined)
      updates.residency = parsed.data.residency;
    if (parsed.data.volume_estimate !== undefined)
      updates.volume_estimate = parsed.data.volume_estimate;
    if (parsed.data.retention_days !== undefined)
      updates.retention_days = parsed.data.retention_days;
    if (parsed.data.source_description !== undefined)
      updates.source_description = parsed.data.source_description;
    if (parsed.data.processor !== undefined)
      updates.processor = parsed.data.processor;

    if (Object.keys(updates).length === 0) {
      return apiError("No fields to update", 400);
    }

    const { data: updated, error: updateErr } = await db
      .from("system_data_inventory")
      .update(updates)
      .eq("id", entryId)
      .select(
        "id, data_type, classification, residency, volume_estimate, retention_days, source_description, processor, created_at, updated_at"
      )
      .single();

    if (updateErr || !updated) {
      return apiError(updateErr?.message || "Failed to update entry", 500);
    }

    return apiOk({ entry: updated });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return apiError(message, 500);
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/systems/[systemId]/data-inventory/[entryId] — delete entry
// ---------------------------------------------------------------------------

export async function DELETE(_req: NextRequest, context: RouteContext) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const { user } = auth;

  try {
    const { systemId, entryId } = await context.params;

    // Verify ownership
    const db = supabaseServer();
    const result = await verifyEntryOwnership(db, user.id, systemId, entryId);
    if ("error" in result) return result.error;

    // Delete entry
    const { error: deleteErr } = await db
      .from("system_data_inventory")
      .delete()
      .eq("id", entryId);

    if (deleteErr) {
      return apiError(deleteErr.message, 500);
    }

    return apiOk({ success: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return apiError(message, 500);
  }
}
