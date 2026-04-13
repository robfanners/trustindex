import { NextRequest } from "next/server";
import { requireAuth, apiError, apiOk } from "@/lib/apiHelpers";
import { authenticateApiKey } from "@/lib/apiKeyAuth";
import { hashPayload } from "@/lib/prove/chain";
import { createAiOutputSchema, firstZodError } from "@/lib/validations";
import { writeAuditLog } from "@/lib/audit";

export async function GET(req: NextRequest) {
  // Try session auth first, then API key
  const sessionAuth = await requireAuth({ orgOptional: false });
  let authSource: "session" | "api_key";
  let organisationId: string;
  let userId: string | null;
  let apiKeyId: string | null;

  if (!sessionAuth.error) {
    authSource = "session";
    organisationId = sessionAuth.orgId;
    userId = sessionAuth.user.id;
    apiKeyId = null;
  } else {
    // Try API key
    const apiKeyAuth = await authenticateApiKey(req, "Verify", "outputs:read");
    if (!apiKeyAuth) {
      return apiError("Not authenticated", 401);
    }
    authSource = "api_key";
    organisationId = apiKeyAuth.organisationId;
    userId = null;
    apiKeyId = apiKeyAuth.apiKeyId;
  }

  const db = sessionAuth.error ? undefined : sessionAuth.db;
  const { supabaseServer } = await import("@/lib/supabase/admin");
  const finalDb = db || supabaseServer();

  const params = req.nextUrl.searchParams;
  const page = Math.max(1, Number(params.get("page") || 1));
  const perPage = Math.min(100, Math.max(1, Number(params.get("per_page") || 20)));
  const offset = (page - 1) * perPage;
  const systemId = params.get("system_id");
  const sourceType = params.get("source_type");
  const dateFrom = params.get("date_from");
  const dateTo = params.get("date_to");

  let query = finalDb
    .from("ai_outputs")
    .select("*, context, systems(name)", { count: "exact" })
    .eq("organisation_id", organisationId)
    .order("occurred_at", { ascending: false })
    .range(offset, offset + perPage - 1);

  if (systemId) query = query.eq("system_id", systemId);
  if (sourceType) query = query.eq("source_type", sourceType);
  if (dateFrom) query = query.gte("occurred_at", dateFrom);
  if (dateTo) query = query.lte("occurred_at", dateTo);

  const { data, count, error } = await query;
  if (error) return apiError(error.message, 500);
  return apiOk({ records: data ?? [], total: count ?? 0 });
}

export async function POST(req: NextRequest) {
  // Try session auth first, then API key
  const sessionAuth = await requireAuth({ orgOptional: false });
  let authSource: "session" | "api_key";
  let organisationId: string;
  let userId: string | null;
  let apiKeyId: string | null;

  if (!sessionAuth.error) {
    authSource = "session";
    organisationId = sessionAuth.orgId;
    userId = sessionAuth.user.id;
    apiKeyId = null;
  } else {
    // Try API key
    const apiKeyAuth = await authenticateApiKey(req, "Verify", "outputs:write");
    if (!apiKeyAuth) {
      return apiError("Not authenticated", 401);
    }
    authSource = "api_key";
    organisationId = apiKeyAuth.organisationId;
    userId = null;
    apiKeyId = apiKeyAuth.apiKeyId;
  }

  const body = await req.json();
  const parsed = createAiOutputSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(firstZodError(parsed.error), 400);
  }
  const { system_id, model_id, output_summary, output_hash, output_type, confidence_score, risk_signal, occurred_at } = parsed.data;

  const { supabaseServer } = await import("@/lib/supabase/admin");
  const db = sessionAuth.error ? supabaseServer() : sessionAuth.db;

  // Validate system belongs to org
  const { data: system, error: sysErr } = await db
    .from("systems")
    .select("id")
    .eq("id", system_id)
    .eq("organisation_id", organisationId)
    .single();
  if (sysErr || !system) {
    return apiError("System not found in your organisation", 404);
  }

  // Validate model belongs to org if provided
  if (model_id) {
    const { data: model, error: modErr } = await db
      .from("model_registry")
      .select("id")
      .eq("id", model_id)
      .eq("organisation_id", organisationId)
      .single();
    if (modErr || !model) {
      return apiError("Model not found in your organisation", 404);
    }
  }

  const computedHash = output_hash || hashPayload({ output_summary, occurred_at });

  const { data, error } = await db
    .from("ai_outputs")
    .insert({
      organisation_id: organisationId,
      system_id,
      model_id: model_id || null,
      source_type: authSource === "api_key" ? "api" : "manual",
      output_hash: computedHash,
      output_summary,
      output_type: output_type || null,
      confidence_score: confidence_score ?? null,
      risk_signal: risk_signal || null,
      occurred_at,
      created_by: authSource === "api_key" ? null : userId,
      ...(authSource === "api_key" ? { api_key_id: apiKeyId, context: body.context || null } : {}),
    })
    .select()
    .single();

  if (error) return apiError(error.message, 500);

  await writeAuditLog({
    organisationId,
    entityType: "ai_output",
    entityId: data.id,
    actionType: "created",
    performedBy: (userId || apiKeyId)!,
    metadata: { system_id, output_type: output_type || null, source: authSource === "api_key" ? "api" : "manual" },
  });

  return apiOk(data, 201);
}
