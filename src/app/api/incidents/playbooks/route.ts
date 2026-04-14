import { requireAuth, apiOk, parseBody, withErrorHandling } from "@/lib/apiHelpers";
import { z } from "zod";

const createPlaybookSchema = z.object({
  name: z.string().min(1, "name is required").max(200),
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

// GET — list playbooks (including default/global ones)
export async function GET(_req: Request) {
  return withErrorHandling(async () => {
    const auth = await requireAuth();
    if (auth.error) return auth.error;
    const { orgId, db } = auth;

    const { data: playbooks, error } = await db
      .from("incident_playbooks")
      .select("*")
      .or(`organisation_id.eq.${orgId},organisation_id.is.null`)
      .order("name", { ascending: true });

    if (error) {
      throw new Error("Failed to fetch playbooks");
    }

    return apiOk({ playbooks: playbooks ?? [] });
  });
}

// POST — create custom playbook
export async function POST(req: Request) {
  return withErrorHandling(async () => {
    const auth = await requireAuth();
    if (auth.error) return auth.error;
    const { user, orgId, db } = auth;

    const parsed = await parseBody(req, createPlaybookSchema);
    if (parsed.error) return parsed.error;
    const { name, description, applies_to_severity, steps } = parsed.data;

    const { data: playbook, error } = await db
      .from("incident_playbooks")
      .insert({
        organisation_id: orgId,
        name,
        description: description || null,
        applies_to_severity: applies_to_severity || ["sev1", "sev2", "sev3", "sev4"],
        steps: steps || [],
        created_by: user.id,
      })
      .select("*")
      .single();

    if (error) {
      console.error("[playbooks] Error creating:", error);
      throw new Error("Failed to create playbook");
    }

    return apiOk({ playbook }, 201);
  });
}
