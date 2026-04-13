import { requireAuth, apiOk, apiError, parseBody, withErrorHandling } from "@/lib/apiHelpers";
import { z } from "zod";

const completeStepSchema = z.object({
  notes: z.string().max(2000).optional(),
});

// POST — mark a playbook step as complete
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; runId: string; stepOrder: string }> }
) {
  return withErrorHandling(async () => {
    const auth = await requireAuth();
    if (auth.error) return auth.error;
    const { user, orgId, db } = auth;
    const { id: incidentId, runId, stepOrder: stepOrderStr } = await params;
    const stepOrder = parseInt(stepOrderStr, 10);

    if (isNaN(stepOrder)) {
      return apiError("Invalid step order", 400);
    }

    // Verify incident belongs to org
    const { data: incident } = await db
      .from("incidents")
      .select("id")
      .eq("id", incidentId)
      .eq("organisation_id", orgId)
      .single();

    if (!incident) {
      return apiError("Incident not found", 404);
    }

    // Verify run belongs to incident
    const { data: run } = await db
      .from("incident_playbook_runs")
      .select("id, status")
      .eq("id", runId)
      .eq("incident_id", incidentId)
      .single();

    if (!run) {
      return apiError("Playbook run not found", 404);
    }

    if (run.status !== "in_progress") {
      return apiError("Playbook run is not in progress", 400);
    }

    const parsed = await parseBody(req, completeStepSchema);
    if (parsed.error) return parsed.error;
    const { notes } = parsed.data;

    // Upsert step run
    const { data: stepRun, error } = await db
      .from("incident_playbook_step_runs")
      .upsert(
        {
          run_id: runId,
          step_order: stepOrder,
          completed_at: new Date().toISOString(),
          completed_by: user.id,
          notes: notes || null,
        },
        { onConflict: "run_id,step_order" }
      )
      .select("*")
      .single();

    if (error) {
      throw new Error("Failed to complete step");
    }

    return apiOk({ step_run: stepRun });
  });
}
