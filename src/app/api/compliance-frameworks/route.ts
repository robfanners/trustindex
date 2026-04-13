import { NextRequest, NextResponse } from "next/server";
import { requireAuth, apiError, apiOk } from "@/lib/apiHelpers";
import {
  createComplianceFrameworkSchema,
  updateComplianceFrameworkSchema,
  firstZodError,
} from "@/lib/validations";

// ---------------------------------------------------------------------------
// GET /api/compliance-frameworks — list all frameworks for the organisation
// ---------------------------------------------------------------------------

export async function GET() {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { data, error } = await auth.db
    .from("compliance_frameworks")
    .select("*")
    .eq("organisation_id", auth.orgId)
    .order("created_at", { ascending: false });

  if (error) {
    return apiError(error.message, 500);
  }

  return apiOk({ frameworks: data ?? [] });
}

// ---------------------------------------------------------------------------
// POST /api/compliance-frameworks — create a new framework
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const body = await req.json();
  const parsed = createComplianceFrameworkSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(firstZodError(parsed.error), 400);
  }

  const { name, short_name, coverage_pct, status, due_date, notes } =
    parsed.data;

  const { data, error } = await auth.db
    .from("compliance_frameworks")
    .insert({
      organisation_id: auth.orgId,
      name,
      short_name: short_name || null,
      coverage_pct,
      status,
      due_date: due_date || null,
      notes: notes || null,
      created_by: auth.user.id,
    })
    .select()
    .single();

  if (error) {
    return apiError(error.message, 500);
  }

  return apiOk({ data }, 201);
}

// ---------------------------------------------------------------------------
// PATCH /api/compliance-frameworks — update an existing framework
// ---------------------------------------------------------------------------

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const body = await req.json();
  const parsed = updateComplianceFrameworkSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(firstZodError(parsed.error), 400);
  }

  const { id, ...updates } = parsed.data;

  // Strip undefined keys so we only send actual updates
  const cleanUpdates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      cleanUpdates[key] = value;
    }
  }

  if (Object.keys(cleanUpdates).length === 0) {
    return apiError("No fields to update", 400);
  }

  const { data, error } = await auth.db
    .from("compliance_frameworks")
    .update(cleanUpdates)
    .eq("id", id)
    .eq("organisation_id", auth.orgId)
    .select()
    .single();

  if (error) {
    return apiError(error.message, 500);
  }

  if (!data) {
    return apiError("Framework not found", 404);
  }

  return apiOk({ data });
}
