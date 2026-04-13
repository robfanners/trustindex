import { NextRequest } from "next/server";
import { requireAuth, apiError, apiOk, parseBody } from "@/lib/apiHelpers";
import { computeOverallStatus, type FairnessMetricType } from "@/lib/fairness";
import { z } from "zod";

// ---------------------------------------------------------------------------
// POST /api/systems/[systemId]/fairness/assess — compute overall status
// ---------------------------------------------------------------------------

const assessSchema = z.object({
  summary: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ systemId: string }> }
) {
  try {
    const { systemId } = await params;
    const auth = await requireAuth();
    if (auth.error) return auth.error;

    const { user, orgId, db } = auth;

    const parsed = await parseBody(req, assessSchema);
    if (parsed.error) return parsed.error;

    // Fetch all metrics for this system
    const { data: metrics } = await db
      .from("fairness_metrics")
      .select("*")
      .eq("system_id", systemId)
      .eq("org_id", orgId);

    if (!metrics || metrics.length === 0) {
      return apiError("No metrics found for assessment", 400);
    }

    // Convert to metric results for scoring
    type RawMetric = { metric_type: FairnessMetricType; value: number; threshold: number; passed: boolean; notes?: string | null };
    const metricResults = (metrics as RawMetric[]).map((m) => ({
      metricType: m.metric_type,
      value: m.value,
      threshold: m.threshold,
      passed: m.passed,
      explanation: m.notes || "",
    }));

    const overallStatus = computeOverallStatus(metricResults);
    const passCount = metricResults.filter((m) => m.passed).length;

    // Upsert assessment
    const { data: assessment, error: assessErr } = await db
      .from("fairness_assessments")
      .upsert({
        system_id: systemId,
        org_id: orgId,
        summary: parsed.data.summary || null,
        overall_status: overallStatus,
        last_assessed_at: new Date().toISOString(),
        assessed_by: user.id,
        metric_count: metrics.length,
        pass_count: passCount,
      })
      .select("*")
      .single();

    if (assessErr || !assessment) {
      return apiError(assessErr?.message || "Failed to save assessment", 500);
    }

    return apiOk({ assessment }, 201);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return apiError(message, 500);
  }
}
