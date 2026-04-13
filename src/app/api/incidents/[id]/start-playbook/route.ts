import { requireAuth, apiOk, apiError, parseBody, withErrorHandling } from "@/lib/apiHelpers";
import { z } from "zod";

const startPlaybookSchema = z.object({
  playbook_id: z.string().uuid("Invalid playbook ID"),
});

// POST — start a playbook run for an incident
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withErrorHandling(async () => {
    const auth = await requireAuth();
    if (auth.error) return auth.error;
    const { user, orgId, db } = auth;
    const { id: incidentId } = await params;

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

    const parsed = await parseBody(req, startPlaybookSchema);
    if (parsed.error) return parsed.error;
    const { playbook_id } = parsed.data;

    // Verify playbook is accessible
    const { data: playbook } = await db
      .from("incident_playbooks")
      .select("id")
      .eq("id", playbook_id)
      .or(`organisation_id.eq.${orgId},organisation_id.is.null`)
      .single();

    if (!playbook) {
      return apiError("Playbook not found", 404);
    }

    // Create run
    const { data: run, error: runError } = await db
      .from("incident_playbook_runs")
      .insert({
        incident_id: incidentId,
        playbook_id,
        started_by: user.id,
      })
      .select("*")
      .single();

    if (runError) {
      throw new Error("Failed to start playbook run");
    }

    // Update incident to link playbook
    await db
      .from("incidents")
      .update({ playbook_id })
      .eq("id", incidentId);

    return apiOk({ run }, 201);
  });
}
