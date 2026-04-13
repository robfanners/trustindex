import { NextRequest, NextResponse } from "next/server";
import { requireAuth, apiError } from "@/lib/apiHelpers";
import { generateTrustCertificate } from "@/lib/prove/certificatePdf";
import { hasTierAccess } from "@/lib/tiers";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  if (!hasTierAccess(auth.plan, "Verify")) {
    return apiError("Plan upgrade required", 403);
  }

  const db = auth.db;

  const { data: attestation, error } = await db
    .from("prove_attestations")
    .select(
      "*, organisations(name), profiles!attested_by(full_name, email)"
    )
    .eq("id", id)
    .eq("organisation_id", auth.orgId)
    .single();

  if (error || !attestation) {
    return apiError("Attestation not found", 404);
  }

  if (attestation.revoked_at) {
    return apiError("Cannot generate certificate for revoked attestation", 409);
  }

  // Get latest health score (optional enrichment)
  const { data: health } = await db
    .from("trustgraph_health_mv")
    .select("health_score")
    .eq("organisation_id", auth.orgId)
    .single();

  const doc = generateTrustCertificate({
    title: attestation.title,
    statement: attestation.statement,
    verificationId: attestation.verification_id,
    orgName: attestation.organisations?.name ?? "Organisation",
    attestedBy:
      attestation.profiles?.full_name ??
      attestation.profiles?.email ??
      "Unknown",
    attestedAt: attestation.attested_at,
    validUntil: attestation.valid_until,
    trustScore: health?.health_score ?? null,
    chainTxHash: attestation.chain_tx_hash,
    chainStatus: attestation.chain_status,
  });

  const pdfBuffer = Buffer.from(doc.output("arraybuffer"));

  return new NextResponse(pdfBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="verisum-certificate-${attestation.verification_id}.pdf"`,
    },
  });
}
