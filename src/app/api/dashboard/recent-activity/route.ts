import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { createSupabaseServerClient } from "@/lib/supabase-auth-server";

// ---------------------------------------------------------------------------
// GET /api/dashboard/recent-activity
// ---------------------------------------------------------------------------
// Returns a unified activity feed combining:
//   - Recent critical/warning signals
//   - Recent unresolved escalations (with source signal)
//   - Recent audit log entries
// Sorted by created_at DESC, capped at 15 items.

export async function GET() {
  try {
    const authClient = await createSupabaseServerClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const db = supabaseServer();
    const { data: profile } = await db
      .from("profiles")
      .select("organisation_id")
      .eq("id", user.id)
      .single();

    if (!profile?.organisation_id) {
      return NextResponse.json({ error: "No organisation" }, { status: 400 });
    }

    const orgId = profile.organisation_id;

    // Run 3 queries in parallel
    const [signalsResult, escalationsResult, auditResult] = await Promise.all([
      // Recent critical/warning signals (last 7 days)
      db
        .from("runtime_signals")
        .select("id, system_name, signal_type, metric_name, metric_value, severity, created_at")
        .eq("organisation_id", orgId)
        .in("severity", ["critical", "warning"])
        .order("created_at", { ascending: false })
        .limit(5),

      // Recent unresolved escalations with source signal
      db
        .from("escalations")
        .select("id, reason, severity, created_at, source_signal:runtime_signals(system_name, metric_name)")
        .eq("organisation_id", orgId)
        .eq("resolved", false)
        .order("created_at", { ascending: false })
        .limit(5),

      // Recent audit log entries
      db
        .from("audit_logs")
        .select("id, entity_type, entity_id, action_type, performed_by, metadata, created_at")
        .eq("organisation_id", orgId)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    // Normalize into a unified feed
    type FeedItem = {
      type: "signal" | "escalation" | "audit";
      id: string;
      summary: string;
      severity?: string;
      created_at: string;
      metadata?: Record<string, unknown>;
    };

    const feed: FeedItem[] = [];

    for (const s of signalsResult.data ?? []) {
      feed.push({
        type: "signal",
        id: s.id,
        summary: `${s.severity} signal: ${s.metric_name} (${s.signal_type}) = ${s.metric_value} on "${s.system_name}"`,
        severity: s.severity,
        created_at: s.created_at,
      });
    }

    for (const e of escalationsResult.data ?? []) {
      const signalCtx = (e.source_signal as { system_name?: string; metric_name?: string } | null);
      const suffix = signalCtx ? ` [from signal: ${signalCtx.metric_name}]` : "";
      feed.push({
        type: "escalation",
        id: e.id,
        summary: (e.reason?.substring(0, 120) ?? "Escalation") + suffix,
        severity: e.severity,
        created_at: e.created_at,
      });
    }

    for (const a of auditResult.data ?? []) {
      feed.push({
        type: "audit",
        id: a.id,
        summary: `${a.entity_type} ${a.action_type}`,
        created_at: a.created_at,
        metadata: a.metadata as Record<string, unknown> | undefined,
      });
    }

    // Sort by created_at DESC and cap at 15
    feed.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return NextResponse.json({ feed: feed.slice(0, 15) });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
