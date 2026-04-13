import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth, apiError, apiOk, parseBody } from "@/lib/apiHelpers";
import { supabaseServer } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

type RouteContext = { params: Promise<{ systemId: string }> };

const createDataInventorySchema = z.object({
  data_type: z.string().min(1),
  classification: z.enum([
    "none",
    "public",
    "internal",
    "confidential",
    "pii",
    "sensitive_pii",
    "phi",
    "financial",
  ]),
  residency: z.enum(["uk", "eu", "us", "apac", "global", "unknown"]),
  volume_estimate: z.string().optional().nullable(),
  retention_days: z.number().int().positive().optional().nullable(),
  source_description: z.string().optional().nullable(),
  processor: z.string().optional().nullable(),
});

type DataInventoryCreate = z.infer<typeof createDataInventorySchema>;

/**
 * Verify the user owns this assessment and get its org_id.
 * Returns { assessment, orgId } on success, or an error response.
 */
async function verifyAssessmentOwnership(
  db: SupabaseClient,
  userId: string,
  assessmentId: string
) {
  // Get assessment's org_id
  const { data: assessment, error: sysErr } = await db
    .from("trustsys_assessments")
    .select("id, organisation_id")
    .eq("id", assessmentId)
    .single();

  if (sysErr || !assessment) {
    return { error: apiError("Assessment not found", 404) };
  }

  // Verify user belongs to this org
  const { data: profile } = await db
    .from("profiles")
    .select("organisation_id")
    .eq("id", userId)
    .single();

  const userOrgId = (profile as { organisation_id?: string } | null)?.organisation_id;
  if (userOrgId !== assessment.organisation_id) {
    return { error: apiError("Not authorised", 403) };
  }

  return { assessment, orgId: assessment.organisation_id as string };
}

// ---------------------------------------------------------------------------
// GET /api/systems/[systemId]/data-inventory — list inventory entries
// ---------------------------------------------------------------------------

export async function GET(_req: NextRequest, context: RouteContext) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const { user, db } = auth;

  try {
    const { systemId } = await context.params;
    const result = await verifyAssessmentOwnership(db, user.id, systemId);
    if ("error" in result) return result.error;

    const { orgId } = result;

    const { data: inventory, error: inventErr } = await db
      .from("system_data_inventory")
      .select(
        "id, data_type, classification, residency, volume_estimate, retention_days, source_description, processor, created_at, updated_at"
      )
      .eq("assessment_id", systemId)
      .eq("organisation_id", orgId)
      .order("created_at", { ascending: false });

    if (inventErr) {
      return apiError(inventErr.message, 500);
    }

    return apiOk({ entries: inventory || [] });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return apiError(message, 500);
  }
}

// ---------------------------------------------------------------------------
// POST /api/systems/[systemId]/data-inventory — create new inventory entry
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest, context: RouteContext) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const { user } = auth;

  try {
    const { systemId } = await context.params;

    // Parse body
    const parsed = await parseBody(req, createDataInventorySchema);
    if (parsed.error) return parsed.error;

    // Verify ownership
    const db = supabaseServer();
    const result = await verifyAssessmentOwnership(db, user.id, systemId);
    if ("error" in result) return result.error;

    const { orgId } = result;

    // Insert entry
    const { data: entry, error: insertErr } = await db
      .from("system_data_inventory")
      .insert({
        assessment_id: systemId,
        organisation_id: orgId,
        data_type: parsed.data.data_type,
        classification: parsed.data.classification,
        residency: parsed.data.residency,
        volume_estimate: parsed.data.volume_estimate ?? null,
        retention_days: parsed.data.retention_days ?? null,
        source_description: parsed.data.source_description ?? null,
        processor: parsed.data.processor ?? null,
      })
      .select(
        "id, data_type, classification, residency, volume_estimate, retention_days, source_description, processor, created_at, updated_at"
      )
      .single();

    if (insertErr || !entry) {
      return apiError(insertErr?.message || "Failed to create entry", 500);
    }

    // Update assessment's primary classification if this is the first PII entry
    if (
      (parsed.data.classification === "pii" ||
        parsed.data.classification === "sensitive_pii") &&
      parsed.data.residency !== "unknown"
    ) {
      await db
        .from("trustsys_assessments")
        .update({
          primary_data_classification: parsed.data.classification,
          primary_residency: parsed.data.residency,
          processes_pii: true,
        })
        .eq("id", systemId);
    }

    return apiOk({ entry }, 201);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return apiError(message, 500);
  }
}
