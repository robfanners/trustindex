import { NextRequest, NextResponse } from "next/server";
import { requireAuth, checkTierAccess } from "@/lib/apiHelpers";
import { createExchangeSchema, firstZodError } from "@/lib/validations";
import { writeAuditLog } from "@/lib/audit";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;

    const tierCheck = checkTierAccess(auth.plan, "Verify");
    if (tierCheck) return tierCheck;

    const params = req.nextUrl.searchParams;
    const proofType = params.get("proof_type");
    const page = Math.max(1, Number(params.get("page") || 1));
    const perPage = Math.min(100, Math.max(1, Number(params.get("per_page") || 20)));
    const offset = (page - 1) * perPage;

    const db = auth.db;

    let query = db
      .from("prove_exchanges")
      .select("*", { count: "exact" })
      .eq("organisation_id", auth.orgId)
      .order("created_at", { ascending: false });

    if (proofType) {
      query = query.eq("proof_type", proofType);
    }

    const { data, count, error } = await query.range(offset, offset + perPage - 1);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ exchanges: data ?? [], total: count ?? 0 });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;

    const tierCheck = checkTierAccess(auth.plan, "Verify");
    if (tierCheck) return tierCheck;

    const body = await req.json();
    const parsed = createExchangeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 400 });
    }
    const { proof_type, proof_id, shared_with_name, shared_with_email, note } = parsed.data;

    const sb = auth.db;

    // Look up the source record to get its verification_id
    let verificationId: string | null = null;

    if (proof_type === "attestation") {
      const { data } = await sb
        .from("prove_attestations")
        .select("verification_id, title")
        .eq("id", proof_id)
        .eq("organisation_id", auth.orgId)
        .single();
      verificationId = data?.verification_id ?? null;
    } else if (proof_type === "provenance") {
      const { data } = await sb
        .from("prove_provenance")
        .select("verification_id, title")
        .eq("id", proof_id)
        .eq("organisation_id", auth.orgId)
        .single();
      verificationId = data?.verification_id ?? null;
    } else if (proof_type === "incident_lock") {
      const { data } = await sb
        .from("prove_incident_locks")
        .select("verification_id, snapshot")
        .eq("id", proof_id)
        .eq("organisation_id", auth.orgId)
        .single();
      verificationId = data?.verification_id ?? null;
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
        organisation_id: auth.orgId,
        proof_type,
        proof_id,
        verification_id: verificationId,
        shared_with_name,
        shared_with_email: shared_with_email || null,
        note: note || null,
        shared_by: auth.user.id,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await writeAuditLog({
      organisationId: auth.orgId,
      entityType: "exchange",
      entityId: exchange.id,
      actionType: "created",
      performedBy: auth.user.id,
      metadata: { proof_type, proof_id, shared_with_name, shared_with_email: shared_with_email || null },
    });

    return NextResponse.json(
      { ...exchange, verify_url: `/verify/${verificationId}` },
      { status: 201 }
    );
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal server error" }, { status: 500 });
  }
}
