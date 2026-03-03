import { NextRequest, NextResponse } from "next/server";
import { requireTier } from "@/lib/requireTier";
import { supabaseServer } from "@/lib/supabaseServer";
import { hashPayload, generateVerificationId, anchorOnChain } from "@/lib/prove/chain";

export async function GET(req: NextRequest) {
  const check = await requireTier("Verify");
  if (!check.authorized) return check.response;
  if (!check.orgId) return NextResponse.json({ error: "No organisation linked" }, { status: 400 });

  const params = req.nextUrl.searchParams;
  const page = Math.max(1, Number(params.get("page") || 1));
  const perPage = Math.min(100, Math.max(1, Number(params.get("per_page") || 20)));
  const offset = (page - 1) * perPage;

  const db = supabaseServer();
  const { data, count, error } = await db
    .from("prove_provenance")
    .select("*", { count: "exact" })
    .eq("organisation_id", check.orgId)
    .order("created_at", { ascending: false })
    .range(offset, offset + perPage - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ records: data ?? [], total: count ?? 0 });
}

export async function POST(req: NextRequest) {
  const check = await requireTier("Verify");
  if (!check.authorized) return check.response;
  if (!check.orgId) return NextResponse.json({ error: "No organisation linked" }, { status: 400 });

  const body = await req.json();
  const { title, ai_system, model_version, output_description, data_sources, review_note } = body;

  if (!title) return NextResponse.json({ error: "title is required" }, { status: 400 });

  const now = new Date().toISOString();

  const verificationId = generateVerificationId({
    type: "provenance",
    org: check.orgId,
    title,
    ai_system: ai_system || "",
    reviewed_by: check.userId,
    reviewed_at: now,
  });

  const eventHash = hashPayload({
    type: "provenance",
    org: check.orgId,
    title,
    ai_system: ai_system || "",
    model_version: model_version || "",
    output_description: output_description || "",
    verification_id: verificationId,
    reviewed_by: check.userId,
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

  const db = supabaseServer();
  const { data, error } = await db
    .from("prove_provenance")
    .insert({
      organisation_id: check.orgId,
      title,
      ai_system: ai_system || null,
      model_version: model_version || null,
      output_description: output_description || null,
      data_sources: sources,
      reviewed_by: check.userId,
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
  return NextResponse.json(data, { status: 201 });
}
