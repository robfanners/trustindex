import { NextRequest } from "next/server";
import { requireAuth, apiError, apiOk } from "@/lib/apiHelpers";
import { hashPayload, generateVerificationId, anchorOnChain } from "@/lib/prove/chain";
import { createAttestationSchema, firstZodError } from "@/lib/validations";
import { writeAuditLog } from "@/lib/audit";
import { hasTierAccess } from "@/lib/tiers";

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  if (!hasTierAccess(auth.plan, "Verify")) {
    return apiError("Plan upgrade required", 403);
  }

  const params = req.nextUrl.searchParams;
  const page = Math.max(1, Number(params.get("page") || 1));
  const perPage = Math.min(100, Math.max(1, Number(params.get("per_page") || 20)));
  const offset = (page - 1) * perPage;

  const db = auth.db;
  const { data, count, error } = await db
    .from("prove_attestations")
    .select("*", { count: "exact" })
    .eq("organisation_id", auth.orgId)
    .order("created_at", { ascending: false })
    .range(offset, offset + perPage - 1);

  if (error) return apiError(error.message, 500);

  const enriched = (data ?? []).map((a: Record<string, unknown>) => ({
    ...a,
    is_valid: !a.revoked_at && (!a.valid_until || new Date(a.valid_until as string) > new Date()),
  }));
  return apiOk({ attestations: enriched, total: count ?? 0 });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  if (!hasTierAccess(auth.plan, "Verify")) {
    return apiError("Plan upgrade required", 403);
  }

  const body = await req.json();
  const parsed = createAttestationSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(firstZodError(parsed.error), 400);
  }
  const { title, statement, posture_snapshot, valid_days } = parsed.data;

  const valid_until = valid_days
    ? new Date(Date.now() + valid_days * 86400000).toISOString()
    : null;

  const now = new Date().toISOString();

  // Generate verification ID and event hash
  const verificationId = generateVerificationId({
    type: "attestation",
    org: auth.orgId,
    title,
    statement,
    attested_by: auth.user.id,
    attested_at: now,
  });

  const eventHash = hashPayload({
    type: "attestation",
    org: auth.orgId,
    title,
    statement,
    verification_id: verificationId,
    attested_by: auth.user.id,
    attested_at: now,
  });

  // Attempt chain anchoring
  const chainResult = await anchorOnChain(eventHash);

  const db = auth.db;
  const { data, error } = await db
    .from("prove_attestations")
    .insert({
      organisation_id: auth.orgId,
      title,
      statement,
      posture_snapshot: posture_snapshot || null,
      valid_until,
      attested_by: auth.user.id,
      attested_at: now,
      verification_id: verificationId,
      event_hash: eventHash,
      chain_tx_hash: chainResult.txHash,
      chain_status: chainResult.status,
    })
    .select()
    .single();

  if (error) return apiError(error.message, 500);

  await writeAuditLog({
    organisationId: auth.orgId,
    entityType: "attestation",
    entityId: data.id,
    actionType: "created",
    performedBy: auth.user.id,
    metadata: { title, verification_id: verificationId },
  });

  return apiOk(data, 201);
}
