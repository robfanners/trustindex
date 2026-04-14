import { NextRequest } from "next/server";
import { requireAuth, apiError, apiOk } from "@/lib/apiHelpers";
import { writeAuditLog } from "@/lib/audit";
import { z } from "zod";
import { hasTierAccess } from "@/lib/tiers";

const revokeSchema = z.object({
  reason: z.string().min(1, "reason is required").max(2000),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  if (!hasTierAccess(auth.plan, "Verify")) {
    return apiError("Plan upgrade required", 403);
  }

  const body = await req.json();
  const parsed = revokeSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }

  const db = auth.db;

  // Verify attestation belongs to this org and isn't already revoked
  const { data: existing } = await db
    .from("prove_attestations")
    .select("id, revoked_at, verification_id")
    .eq("id", id)
    .eq("organisation_id", auth.orgId)
    .single();

  if (!existing) return apiError("Attestation not found", 404);
  if (existing.revoked_at) return apiError("Already revoked", 409);

  const { data, error } = await db
    .from("prove_attestations")
    .update({
      revoked_at: new Date().toISOString(),
      revoked_by: auth.user.id,
      revocation_reason: parsed.data.reason,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) return apiError(error.message, 500);

  await writeAuditLog({
    organisationId: auth.orgId,
    entityType: "attestation",
    entityId: id,
    actionType: "revoked",
    performedBy: auth.user.id,
    metadata: { verification_id: existing.verification_id, reason: parsed.data.reason },
  });

  return apiOk(data);
}
