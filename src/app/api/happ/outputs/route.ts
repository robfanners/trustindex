import { NextRequest, NextResponse } from "next/server";
import { resolveAuth } from "@/lib/resolveAuth";
import { supabaseServer } from "@/lib/supabaseServer";
import { hashPayload } from "@/lib/prove/chain";
import { createAiOutputSchema, firstZodError } from "@/lib/validations";
import { writeAuditLog } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const auth = await resolveAuth(req, "Verify", "outputs:read");
  if (!auth.authorized) return auth.response;

  const params = req.nextUrl.searchParams;
  const page = Math.max(1, Number(params.get("page") || 1));
  const perPage = Math.min(100, Math.max(1, Number(params.get("per_page") || 20)));
  const offset = (page - 1) * perPage;
  const systemId = params.get("system_id");
  const sourceType = params.get("source_type");
  const dateFrom = params.get("date_from");
  const dateTo = params.get("date_to");

  const db = supabaseServer();
  let query = db
    .from("ai_outputs")
    .select("*, context, systems(name)", { count: "exact" })
    .eq("organisation_id", auth.organisationId)
    .order("occurred_at", { ascending: false })
    .range(offset, offset + perPage - 1);

  if (systemId) query = query.eq("system_id", systemId);
  if (sourceType) query = query.eq("source_type", sourceType);
  if (dateFrom) query = query.gte("occurred_at", dateFrom);
  if (dateTo) query = query.lte("occurred_at", dateTo);

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ records: data ?? [], total: count ?? 0 });
}

export async function POST(req: NextRequest) {
  const auth = await resolveAuth(req, "Verify", "outputs:write");
  if (!auth.authorized) return auth.response;

  const body = await req.json();
  const parsed = createAiOutputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 400 });
  }
  const { system_id, model_id, output_summary, output_hash, output_type, confidence_score, risk_signal, occurred_at } = parsed.data;

  const db = supabaseServer();

  // Validate system belongs to org
  const { data: system, error: sysErr } = await db
    .from("systems")
    .select("id")
    .eq("id", system_id)
    .eq("organisation_id", auth.organisationId)
    .single();
  if (sysErr || !system) {
    return NextResponse.json({ error: "System not found in your organisation" }, { status: 404 });
  }

  // Validate model belongs to org if provided
  if (model_id) {
    const { data: model, error: modErr } = await db
      .from("model_registry")
      .select("id")
      .eq("id", model_id)
      .eq("organisation_id", auth.organisationId)
      .single();
    if (modErr || !model) {
      return NextResponse.json({ error: "Model not found in your organisation" }, { status: 404 });
    }
  }

  const computedHash = output_hash || hashPayload({ output_summary, occurred_at });

  const isApiKey = auth.source === "api_key";

  const { data, error } = await db
    .from("ai_outputs")
    .insert({
      organisation_id: auth.organisationId,
      system_id,
      model_id: model_id || null,
      source_type: isApiKey ? "api" : "manual",
      output_hash: computedHash,
      output_summary,
      output_type: output_type || null,
      confidence_score: confidence_score ?? null,
      risk_signal: risk_signal || null,
      occurred_at,
      created_by: isApiKey ? null : auth.userId,
      ...(isApiKey ? { api_key_id: auth.apiKeyId, context: body.context || null } : {}),
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAuditLog({
    organisationId: auth.organisationId,
    entityType: "ai_output",
    entityId: data.id,
    actionType: "created",
    performedBy: (auth.userId || auth.apiKeyId)!,
    metadata: { system_id, output_type: output_type || null, source: isApiKey ? "api" : "manual" },
  });

  return NextResponse.json(data, { status: 201 });
}
