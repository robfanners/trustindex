import { requireAuth, apiOk, apiError, parseBody } from "@/lib/apiHelpers";
import { z } from "zod";

const updateSightingSchema = z.object({
  status: z.enum(["unreviewed", "approved", "blocked", "investigating"]).optional(),
  assigned_to: z.string().uuid().optional().nullable(),
  notes: z.string().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const parsed = await parseBody(req, updateSightingSchema);
  if (parsed.error) return parsed.error;

  const { data, error } = await auth.db
    .from("ai_tool_sightings")
    .update(parsed.data)
    .eq("id", params.id)
    .eq("org_id", auth.orgId)
    .select();

  if (error) return apiError(error.message, 500);
  if (!data || data.length === 0) return apiError("Not found", 404);
  return apiOk({ sighting: data[0] });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { error } = await auth.db
    .from("ai_tool_sightings")
    .delete()
    .eq("id", params.id)
    .eq("org_id", auth.orgId);

  if (error) return apiError(error.message, 500);
  return apiOk({ deleted: true });
}
