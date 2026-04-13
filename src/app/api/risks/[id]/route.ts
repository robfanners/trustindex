import { requireAuth, apiOk, apiError, parseBody } from "@/lib/apiHelpers";
import { z } from "zod";

const updateRiskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  likelihood: z.enum(["rare", "unlikely", "possible", "likely", "almost_certain"]).optional(),
  impact: z.enum(["insignificant", "minor", "moderate", "major", "catastrophic"]).optional(),
  residual_score: z.number().optional(),
  treatment: z.enum(["accept", "mitigate", "transfer", "avoid"]).optional(),
  owner_user_id: z.string().uuid().optional().nullable(),
  review_due_date: z.string().optional(),
  status: z.enum(["open", "mitigated", "accepted", "closed"]).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const parsed = await parseBody(req, updateRiskSchema);
  if (parsed.error) return parsed.error;

  const { data, error } = await auth.db
    .from("risk_registry")
    .update(parsed.data)
    .eq("id", params.id)
    .eq("org_id", auth.orgId)
    .select();

  if (error) return apiError(error.message, 500);
  if (!data || data.length === 0) return apiError("Not found", 404);
  return apiOk({ risk: data[0] });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { error } = await auth.db
    .from("risk_registry")
    .delete()
    .eq("id", params.id)
    .eq("org_id", auth.orgId);

  if (error) return apiError(error.message, 500);
  return apiOk({ deleted: true });
}
