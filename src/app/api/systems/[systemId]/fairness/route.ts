import { NextRequest } from "next/server";
import { requireAuth, apiError, apiOk, parseBody } from "@/lib/apiHelpers";
import { z } from "zod";

// ---------------------------------------------------------------------------
// GET /api/systems/[systemId]/fairness — fetch latest assessment + all metrics
// ---------------------------------------------------------------------------

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ systemId: string }> }
) {
  try {
    const { systemId } = await params;
    const auth = await requireAuth();
    if (auth.error) return auth.error;

    const { orgId, db } = auth;

    // Verify system belongs to org
    const { data: system, error: sysErr } = await db
      .from("systems")
      .select("id, owner_id")
      .eq("id", systemId)
      .single();

    if (sysErr || !system) {
      return apiError("System not found", 404);
    }

    // Fetch latest assessment
    const { data: assessment } = await db
      .from("fairness_assessments")
      .select("*")
      .eq("system_id", systemId)
      .eq("org_id", orgId)
      .single();

    // Fetch all metrics
    const { data: metrics } = await db
      .from("fairness_metrics")
      .select("*")
      .eq("system_id", systemId)
      .eq("org_id", orgId)
      .order("sampled_at", { ascending: false });

    return apiOk({
      assessment: assessment || null,
      metrics: metrics || [],
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return apiError(message, 500);
  }
}

// ---------------------------------------------------------------------------
// POST /api/systems/[systemId]/fairness — record a fairness metric
// ---------------------------------------------------------------------------

const recordMetricSchema = z.object({
  metric_type: z.enum([
    "demographic_parity",
    "equal_opportunity",
    "equalised_odds",
    "predictive_parity",
    "disparate_impact",
  ]),
  protected_attribute: z.string().min(1),
  group_a: z.string().min(1),
  group_b: z.string().min(1),
  value: z.number().min(0),
  threshold: z.number().min(0),
  passed: z.boolean(),
  sampled_at: z.string().datetime(),
  sample_size: z.number().int().positive().optional(),
  notes: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ systemId: string }> }
) {
  try {
    const { systemId } = await params;
    const auth = await requireAuth();
    if (auth.error) return auth.error;

    const { orgId, db } = auth;

    const parsed = await parseBody(req, recordMetricSchema);
    if (parsed.error) return parsed.error;

    const { data: metric } = await db
      .from("fairness_metrics")
      .insert({
        system_id: systemId,
        org_id: orgId,
        ...parsed.data,
      })
      .select("*")
      .single();

    return apiOk({ metric }, 201);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return apiError(message, 500);
  }
}
