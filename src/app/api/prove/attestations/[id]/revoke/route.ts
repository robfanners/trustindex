import { NextRequest, NextResponse } from "next/server";
import { requireTier } from "@/lib/requireTier";
import { supabaseServer } from "@/lib/supabaseServer";
import { writeAuditLog } from "@/lib/audit";
import { z } from "zod";

const revokeSchema = z.object({
  reason: z.string().min(1, "reason is required").max(2000),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const check = await requireTier("Verify");
  if (!check.authorized) return check.response;
  if (!check.orgId) return NextResponse.json({ error: "No organisation linked" }, { status: 400 });

  const body = await req.json();
  const parsed = revokeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const db = supabaseServer();

  // Verify attestation belongs to this org and isn't already revoked
  const { data: existing } = await db
    .from("prove_attestations")
    .select("id, revoked_at, verification_id")
    .eq("id", id)
    .eq("organisation_id", check.orgId)
    .single();

  if (!existing) return NextResponse.json({ error: "Attestation not found" }, { status: 404 });
  if (existing.revoked_at) return NextResponse.json({ error: "Already revoked" }, { status: 409 });

  const { data, error } = await db
    .from("prove_attestations")
    .update({
      revoked_at: new Date().toISOString(),
      revoked_by: check.userId,
      revocation_reason: parsed.data.reason,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAuditLog({
    organisationId: check.orgId,
    entityType: "attestation",
    entityId: id,
    actionType: "revoked",
    performedBy: check.userId,
    metadata: { verification_id: existing.verification_id, reason: parsed.data.reason },
  });

  return NextResponse.json(data);
}
