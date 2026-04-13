import { requireAuth, apiOk, apiError } from "@/lib/apiHelpers";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ framework: string; controlId: string; linkId: string }> }
) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { error } = await auth.db
    .from("control_evidence_links")
    .delete()
    .eq("id", (await params).linkId)
    .eq("org_id", auth.orgId);

  if (error) return apiError(error.message, 500);
  return apiOk({ deleted: true });
}
