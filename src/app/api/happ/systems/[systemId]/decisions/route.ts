import { NextRequest, NextResponse } from "next/server";
import { requireTier } from "@/lib/requireTier";
import { supabaseServer } from "@/lib/supabaseServer";

type Ctx = { params: Promise<{ systemId: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const check = await requireTier("Verify");
  if (!check.authorized) return check.response;
  if (!check.orgId) return NextResponse.json({ error: "No organisation linked" }, { status: 400 });

  const { systemId } = await ctx.params;
  const db = supabaseServer();

  // Validate system belongs to org
  const { data: system, error: sysErr } = await db
    .from("systems")
    .select("id")
    .eq("id", systemId)
    .eq("organisation_id", check.orgId)
    .single();
  if (sysErr || !system) {
    return NextResponse.json({ error: "System not found in your organisation" }, { status: 404 });
  }

  const params = req.nextUrl.searchParams;
  const page = Math.max(1, Number(params.get("page") || 1));
  const perPage = Math.min(100, Math.max(1, Number(params.get("per_page") || 20)));
  const offset = (page - 1) * perPage;

  const decisionStatus = params.get("decision_status");
  const humanDecision = params.get("human_decision");
  const dateFrom = params.get("date_from");
  const dateTo = params.get("date_to");

  let query = db
    .from("decision_records")
    .select(
      "*, profiles!decision_records_human_reviewer_id_fkey(full_name), policy_versions(title, version), ai_outputs(output_summary, output_type)",
      { count: "exact" }
    )
    .eq("system_id", systemId)
    .eq("organisation_id", check.orgId)
    .order("created_at", { ascending: false })
    .range(offset, offset + perPage - 1);

  if (decisionStatus) query = query.eq("decision_status", decisionStatus);
  if (humanDecision) query = query.eq("human_decision", humanDecision);
  if (dateFrom) query = query.gte("reviewed_at", dateFrom);
  if (dateTo) query = query.lte("reviewed_at", dateTo);

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ records: data ?? [], total: count ?? 0 });
}
