import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireTier } from "@/lib/requireTier";
import { writeAuditLog } from "@/lib/audit";
import { parseBody } from "@/lib/apiHelpers";
import { createEscalationSchema } from "@/lib/validations";

// ---------------------------------------------------------------------------
// Helper: authenticate + check Assure tier + get org_id
// ---------------------------------------------------------------------------

async function getAuthenticatedOrg() {
  const check = await requireTier("Assure");
  if (!check.authorized) {
    return { error: check.response };
  }

  if (!check.orgId) {
    return { error: NextResponse.json({ error: "No organisation linked" }, { status: 400 }) };
  }

  return { user: { id: check.userId }, orgId: check.orgId };
}

// ---------------------------------------------------------------------------
// GET /api/trustgraph/escalations — list escalations or fetch single detail
// ---------------------------------------------------------------------------
// Query params: resolved (true|false), severity, status, page, per_page
// Single item: ?id=<uuid> — returns escalation with notes and linked actions

export async function GET(req: NextRequest) {
  try {
    const result = await getAuthenticatedOrg();
    if ("error" in result) return result.error;

    const { orgId } = result;
    const db = supabaseServer();
    const url = req.nextUrl;

    // Single escalation detail
    const singleId = url.searchParams.get("id");
    if (singleId) {
      const { data: esc, error: escErr } = await db
        .from("escalations")
        .select("*, source_signal:runtime_signals(id, system_name, metric_name, signal_type, severity, created_at)")
        .eq("id", singleId)
        .eq("organisation_id", orgId)
        .single();

      if (escErr || !esc) {
        return NextResponse.json({ error: "Escalation not found" }, { status: 404 });
      }

      // Fetch notes
      const { data: notes } = await db
        .from("escalation_notes")
        .select("*")
        .eq("escalation_id", singleId)
        .order("created_at", { ascending: true });

      // Fetch linked actions
      const { data: actionLinks } = await db
        .from("escalation_action_links")
        .select("action_id, actions(id, title, status, priority)")
        .eq("escalation_id", singleId);

      // Fetch assignee profile
      let assigneeName: string | null = null;
      if (esc.assigned_to) {
        const { data: assigneeProfile } = await db
          .from("profiles")
          .select("display_name, email")
          .eq("id", esc.assigned_to)
          .single();
        assigneeName = assigneeProfile?.display_name || assigneeProfile?.email || null;
      }

      return NextResponse.json({
        escalation: {
          ...esc,
          assignee_name: assigneeName,
        },
        notes: notes || [],
        linked_actions: (actionLinks || []).map((l: { action_id: string; actions: unknown }) => l.actions),
      });
    }

    // List escalations
    const resolved = url.searchParams.get("resolved");
    const severity = url.searchParams.get("severity");
    const statusFilter = url.searchParams.get("status");
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
    const perPage = Math.min(100, Math.max(1, Number(url.searchParams.get("per_page")) || 50));

    let query = db
      .from("escalations")
      .select("*, source_signal:runtime_signals(id, system_name, metric_name, signal_type, severity, created_at)", { count: "exact" })
      .eq("organisation_id", orgId)
      .order("created_at", { ascending: false })
      .range((page - 1) * perPage, page * perPage - 1);

    if (resolved === "true") {
      query = query.eq("resolved", true);
    } else if (resolved === "false") {
      query = query.eq("resolved", false);
    }

    if (severity && ["low", "medium", "high", "critical"].includes(severity)) {
      query = query.eq("severity", severity);
    }

    if (statusFilter && ["open", "investigating", "resolved", "closed"].includes(statusFilter)) {
      query = query.eq("status", statusFilter);
    }

    const { data: escalations, error: fetchErr, count } = await query;

    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }

    // Batch-fetch assignee names for the list
    const assigneeIds = [...new Set((escalations || [])
      .filter((e: { assigned_to: string | null }) => e.assigned_to)
      .map((e: { assigned_to: string }) => e.assigned_to))];

    let assigneeMap: Record<string, string> = {};
    if (assigneeIds.length > 0) {
      const { data: profiles } = await db
        .from("profiles")
        .select("id, display_name, email")
        .in("id", assigneeIds);
      assigneeMap = Object.fromEntries(
        (profiles || []).map((p: { id: string; display_name: string | null; email: string | null }) => [
          p.id,
          p.display_name || p.email || "Unknown",
        ])
      );
    }

    const enriched = (escalations || []).map((e: { assigned_to: string | null; [key: string]: unknown }) => ({
      ...e,
      assignee_name: e.assigned_to ? assigneeMap[e.assigned_to] || null : null,
    }));

    return NextResponse.json({
      escalations: enriched,
      total: count ?? 0,
      page,
      per_page: perPage,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/trustgraph/escalations — create escalation
// ---------------------------------------------------------------------------
// Body: { run_id, dimension, severity, message, assigned_to }

export async function POST(req: NextRequest) {
  try {
    const result = await getAuthenticatedOrg();
    if ("error" in result) return result.error;

    const { user, orgId } = result;
    const db = supabaseServer();

    // Parse and validate body
    const parsed = await parseBody(req, createEscalationSchema);
    if (parsed.error) return parsed.error;
    const { run_id, dimension, severity, message, assigned_to } = parsed.data;

    // Create escalation
    const { data: newEsc, error: createErr } = await db
      .from("escalations")
      .insert({
        organisation_id: orgId,
        run_id,
        dimension,
        severity,
        message,
        assigned_to: assigned_to || null,
        status: "open",
        resolved: false,
        trigger_type: "assessment",
        trigger_detail: "Escalation from TrustGraph assessment",
      })
      .select("*")
      .single();

    if (createErr) {
      return NextResponse.json({ error: createErr.message }, { status: 500 });
    }

    // Add system note
    await db.from("escalation_notes").insert({
      escalation_id: newEsc.id,
      author_id: user.id,
      content: `Escalation created: ${message}`,
      note_type: "status_change",
    });

    // Audit log
    await writeAuditLog({
      organisationId: orgId,
      entityType: "escalation",
      entityId: newEsc.id,
      actionType: "created",
      performedBy: user.id,
      metadata: { run_id, dimension, severity, message },
    });

    return NextResponse.json({ escalation: newEsc }, { status: 201 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
