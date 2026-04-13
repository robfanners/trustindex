import { NextRequest, NextResponse } from "next/server";
import { requireAuth, checkTierAccess } from "@/lib/apiHelpers";
import { hashPayload, generateVerificationId, anchorOnChain } from "@/lib/prove/chain";
import { createProvenanceSchema, firstZodError } from "@/lib/validations";
import { writeAuditLog } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const tierCheck = checkTierAccess(auth.plan, "Verify");
  if (tierCheck) return tierCheck;

  const params = req.nextUrl.searchParams;
  const page = Math.max(1, Number(params.get("page") || 1));
  const perPage = Math.min(100, Math.max(1, Number(params.get("per_page") || 20)));
  const offset = (page - 1) * perPage;

  const db = auth.db;
  const { data, count, error } = await db
    .from("prove_provenance")
    .select("*", { count: "exact" })
    .eq("organisation_id", auth.orgId)
    .order("created_at", { ascending: false })
    .range(offset, offset + perPage - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ records: data ?? [], total: count ?? 0 });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const tierCheck = checkTierAccess(auth.plan, "Verify");
  if (tierCheck) return tierCheck;

  const body = await req.json();
  const parsed = createProvenanceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 400 });
  }
  const { title, ai_system, model_version, output_description, data_sources, review_note } = parsed.data;

  const now = new Date().toISOString();

  const verificationId = generateVerificationId({
    type: "provenance",
    org: auth.orgId,
    title,
    ai_system: ai_system || "",
    reviewed_by: auth.user.id,
    reviewed_at: now,
  });

  const eventHash = hashPayload({
    type: "provenance",
    org: auth.orgId,
    title,
    ai_system: ai_system || "",
    model_version: model_version || "",
    output_description: output_description || "",
    verification_id: verificationId,
    reviewed_by: auth.user.id,
    reviewed_at: now,
  });

  const chainResult = await anchorOnChain(eventHash);

  // Parse data_sources: accept comma-separated string or array
  let sources: string[] | null = null;
  if (data_sources) {
    sources = typeof data_sources === "string"
      ? data_sources.split(",").map((s: string) => s.trim()).filter(Boolean)
      : data_sources;
  }

  const db = auth.db;
  const { data, error } = await db
    .from("prove_provenance")
    .insert({
      organisation_id: auth.orgId,
      title,
      ai_system: ai_system || null,
      model_version: model_version || null,
      output_description: output_description || null,
      data_sources: sources,
      reviewed_by: auth.user.id,
      reviewed_at: now,
      review_note: review_note || null,
      verification_id: verificationId,
      event_hash: eventHash,
      chain_tx_hash: chainResult.txHash,
      chain_status: chainResult.status,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAuditLog({
    organisationId: auth.orgId,
    entityType: "provenance",
    entityId: data.id,
    actionType: "created",
    performedBy: auth.user.id,
    metadata: { title, ai_system: ai_system || null, verification_id: verificationId },
  });

  return NextResponse.json(data, { status: 201 });
}
