import { requireAuth, apiOk, apiError, parseBody, withErrorHandling } from "@/lib/apiHelpers";
import { z } from "zod";

const updatePlaybookSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  applies_to_severity: z.array(z.enum(["sev1", "sev2", "sev3", "sev4"])).optional(),
  steps: z.array(
    z.object({
      order: z.number().int().positive(),
      title: z.string().min(1).max(200),
      owner_role: z.string().max(100),
      sla_minutes: z.number().int().positive(),
      required: z.boolean(),
    })
  ).optional(),
});

// GET — fetch single playbook
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandling(async () => {
    const auth = await requireAuth();
    if (auth.error) return auth.error;
    const { orgId, db } = auth;
    const { id } = await params;

    const { data: playbook, error } = await db
      .from("incident_playbooks")
      .select("*")
      .eq("id", id)
      .or(`organisation_id.eq.${orgId},organisation_id.is.null`)
      .single();

    if (error || !playbook) {
      return apiError("Playbook not found", 404);
    }

    return apiOk({ playbook });
  });
}

// PATCH — update playbook (custom ones only)
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandling(async () => {
    const auth = await requireAuth();
    if (auth.error) return auth.error;
    const { orgId, db } = auth;
    const { id } = await params;

    // Check ownership
    const { data: playbook } = await db
      .from("incident_playbooks")
      .select("organisation_id")
      .eq("id", id)
      .single();

    if (!playbook || playbook.organisation_id !== orgId) {
      return apiError("Cannot update global or non-owned playbooks", 403);
    }

    const parsed = await parseBody(req, updatePlaybookSchema);
    if (parsed.error) return parsed.error;
    const { name, description, applies_to_severity, steps } = parsed.data;

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (applies_to_severity !== undefined) updates.applies_to_severity = applies_to_severity;
    if (steps !== undefined) updates.steps = steps;

    const { data: updated, error } = await db
      .from("incident_playbooks")
      .update(updates)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      throw new Error("Failed to update playbook");
    }

    return apiOk({ playbook: updated });
  });
}

// DELETE — remove custom playbook
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandling(async () => {
    const auth = await requireAuth();
    if (auth.error) return auth.error;
    const { orgId, db } = auth;
    const { id } = await params;

    const { data: playbook } = await db
      .from("incident_playbooks")
      .select("organisation_id")
      .eq("id", id)
      .single();

    if (!playbook || playbook.organisation_id !== orgId) {
      return apiError("Cannot delete global or non-owned playbooks", 403);
    }

    const { error } = await db.from("incident_playbooks").delete().eq("id", id);

    if (error) {
      throw new Error("Failed to delete playbook");
    }

    return apiOk({ deleted: true });
  });
}
