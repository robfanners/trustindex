import { NextRequest, NextResponse } from "next/server";
import { requireTier } from "@/lib/requireTier";
import { supabaseServer } from "@/lib/supabaseServer";

const VALID_PROOF_TYPES = ["attestation", "provenance", "incident_lock"] as const;
type ProofType = (typeof VALID_PROOF_TYPES)[number];

export async function GET(req: NextRequest) {
  try {
    const check = await requireTier("Verify");
    if (!check.authorized) return check.response;
    if (!check.orgId)
      return NextResponse.json({ error: "No organisation linked" }, { status: 400 });

    const params = req.nextUrl.searchParams;
    const proofType = params.get("proof_type");
    const page = Math.max(1, Number(params.get("page") || 1));
    const perPage = Math.min(100, Math.max(1, Number(params.get("per_page") || 20)));
    const offset = (page - 1) * perPage;

    const db = supabaseServer();

    let query = db
      .from("prove_exchanges")
      .select("*", { count: "exact" })
      .eq("organisation_id", check.orgId)
      .order("created_at", { ascending: false });

    if (proofType) {
      query = query.eq("proof_type", proofType);
    }

    const { data, count, error } = await query.range(offset, offset + perPage - 1);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ exchanges: data ?? [], total: count ?? 0 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const check = await requireTier("Verify");
    if (!check.authorized) return check.response;
    if (!check.orgId)
      return NextResponse.json({ error: "No organisation linked" }, { status: 400 });

    const body = await req.json();
    const { proof_type, proof_id, shared_with_name, shared_with_email, note } = body;

    if (!proof_type || !proof_id || !shared_with_name) {
      return NextResponse.json(
        { error: "proof_type, proof_id, and shared_with_name are required" },
        { status: 400 }
      );
    }

    if (!VALID_PROOF_TYPES.includes(proof_type as ProofType)) {
      return NextResponse.json(
        { error: `proof_type must be one of: ${VALID_PROOF_TYPES.join(", ")}` },
        { status: 400 }
      );
    }

    const sb = supabaseServer();

    // Look up the source record to get its verification_id
    let verificationId: string | null = null;
    let proofTitle: string | null = null;

    if (proof_type === "attestation") {
      const { data } = await sb
        .from("prove_attestations")
        .select("verification_id, title")
        .eq("id", proof_id)
        .eq("organisation_id", check.orgId)
        .single();
      verificationId = data?.verification_id ?? null;
      proofTitle = data?.title ?? null;
    } else if (proof_type === "provenance") {
      const { data } = await sb
        .from("prove_provenance")
        .select("verification_id, title")
        .eq("id", proof_id)
        .eq("organisation_id", check.orgId)
        .single();
      verificationId = data?.verification_id ?? null;
      proofTitle = data?.title ?? null;
    } else if (proof_type === "incident_lock") {
      const { data } = await sb
        .from("prove_incident_locks")
        .select("verification_id, snapshot")
        .eq("id", proof_id)
        .eq("organisation_id", check.orgId)
        .single();
      verificationId = data?.verification_id ?? null;
      proofTitle = (data?.snapshot as any)?.title ?? "Incident Lock";
    }

    if (!verificationId) {
      return NextResponse.json(
        { error: "Proof record not found or does not belong to your organisation" },
        { status: 404 }
      );
    }

    const { data: exchange, error } = await sb
      .from("prove_exchanges")
      .insert({
        organisation_id: check.orgId,
        proof_type,
        proof_id,
        verification_id: verificationId,
        shared_with_name,
        shared_with_email: shared_with_email || null,
        note: note || null,
        shared_by: check.userId,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json(
      { ...exchange, verify_url: `/verify/${verificationId}` },
      { status: 201 }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Internal server error" }, { status: 500 });
  }
}
