import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireTier } from "@/lib/requireTier";

// GET — list runtime signals for org
export async function GET(req: Request) {
  try {
    const check = await requireTier("Assure");
    if (!check.authorized) return check.response;

    if (!check.orgId) {
      return NextResponse.json({ error: "No organisation" }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const signal_type = searchParams.get("signal_type");
    const severity = searchParams.get("severity");
    const system_name = searchParams.get("system_name");
    const days = parseInt(searchParams.get("days") ?? "30", 10);
    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const per_page = parseInt(searchParams.get("per_page") ?? "20", 10);

    const since = new Date();
    since.setDate(since.getDate() - days);

    const sb = supabaseServer();

    // Build query
    let query = sb
      .from("runtime_signals")
      .select("*")
      .eq("organisation_id", check.orgId)
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false })
      .range((page - 1) * per_page, page * per_page - 1);

    if (signal_type) query = query.eq("signal_type", signal_type);
    if (severity) query = query.eq("severity", severity);
    if (system_name) query = query.eq("system_name", system_name);

    const { data: signals, error } = await query;

    if (error) {
      return NextResponse.json({ error: "Failed to fetch signals" }, { status: 500 });
    }

    // Total count with same filters
    let countQuery = sb
      .from("runtime_signals")
      .select("id", { count: "exact", head: true })
      .eq("organisation_id", check.orgId)
      .gte("created_at", since.toISOString());

    if (signal_type) countQuery = countQuery.eq("signal_type", signal_type);
    if (severity) countQuery = countQuery.eq("severity", severity);
    if (system_name) countQuery = countQuery.eq("system_name", system_name);

    const { count } = await countQuery;

    return NextResponse.json({
      signals: signals ?? [],
      total: count ?? 0,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST — create a runtime signal
export async function POST(req: Request) {
  try {
    const check = await requireTier("Assure");
    if (!check.authorized) return check.response;

    if (!check.orgId) {
      return NextResponse.json({ error: "No organisation" }, { status: 400 });
    }

    const body = await req.json();
    const { system_name, signal_type, metric_name, metric_value, severity, source, context } = body;

    if (!system_name) {
      return NextResponse.json({ error: "system_name is required" }, { status: 400 });
    }
    if (!signal_type) {
      return NextResponse.json({ error: "signal_type is required" }, { status: 400 });
    }
    if (!metric_name) {
      return NextResponse.json({ error: "metric_name is required" }, { status: 400 });
    }
    if (metric_value === undefined || metric_value === null) {
      return NextResponse.json({ error: "metric_value is required" }, { status: 400 });
    }

    const sb = supabaseServer();
    const { data: signal, error } = await sb
      .from("runtime_signals")
      .insert({
        organisation_id: check.orgId,
        system_name,
        signal_type,
        metric_name,
        metric_value,
        severity: severity || "info",
        source: source || "manual",
        context: context || {},
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: "Failed to create signal" }, { status: 500 });
    }

    return NextResponse.json({ signal }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
