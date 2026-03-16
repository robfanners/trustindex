import { NextRequest, NextResponse } from "next/server";
import { requireTier } from "@/lib/requireTier";
import { supabaseServer } from "@/lib/supabaseServer";
import { generateTrustCertificate } from "@/lib/prove/certificatePdf";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const check = await requireTier("Verify");
  if (!check.authorized) return check.response;
  if (!check.orgId)
    return NextResponse.json(
      { error: "No organisation linked" },
      { status: 400 }
    );

  const db = supabaseServer();

  const { data: attestation, error } = await db
    .from("prove_attestations")
    .select(
      "*, organisations(name), profiles!attested_by(full_name, email)"
    )
    .eq("id", id)
    .eq("organisation_id", check.orgId)
    .single();

  if (error || !attestation) {
    return NextResponse.json(
      { error: "Attestation not found" },
      { status: 404 }
    );
  }

  if (attestation.revoked_at) {
    return NextResponse.json(
      { error: "Cannot generate certificate for revoked attestation" },
      { status: 409 }
    );
  }

  // Get latest health score (optional enrichment)
  const { data: health } = await db
    .from("trustgraph_health_mv")
    .select("health_score")
    .eq("organisation_id", check.orgId)
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
