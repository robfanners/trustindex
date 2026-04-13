import { requireAuth, apiOk, apiError } from "@/lib/apiHelpers";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { error } = await auth.db
    .from("raci_assignments")
    .delete()
    .eq("id", params.id)
    .eq("org_id", auth.orgId);

  if (error) return apiError(error.message, 500);
  return apiOk({ deleted: true });
}
