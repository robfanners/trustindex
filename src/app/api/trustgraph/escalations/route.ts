import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireTier } from "@/lib/requireTier";
import { writeAuditLog } from "@/lib/audit";

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
// POST /api/trustgraph/escalations — perform workflow actions
// ---------------------------------------------------------------------------
// Body: { escalation_id, action, ...actionData }
// Actions: resolve, assign, update_severity, add_note, link_action, create_incident

export async function POST(req: NextRequest) {
  try {
    const result = await getAuthenticatedOrg();
    if ("error" in result) return result.error;

    const { user, orgId } = result;
    const db = supabaseServer();
    const body = await req.json();

    const escalationId = body.escalation_id;
    const action = body.action || "resolve"; // backwards compat

    // Handle create action before requiring escalation_id
    if (action === "create") {
      const reason = body.reason;
      const newSeverity = body.severity || "medium";
      if (!reason?.trim()) {
        return NextResponse.json({ error: "reason is required" }, { status: 400 });
      }
      if (!["low", "medium", "high", "critical"].includes(newSeverity)) {
        return NextResponse.json({ error: "severity must be low|medium|high|critical" }, { status: 400 });
      }

      const { data: newEsc, error: createErr } = await db
        .from("escalations")
        .insert({
          organisation_id: orgId,
          reason: reason.trim(),
          severity: newSeverity,
          status: "open",
          resolved: false,
          trigger_type: "manual",
          trigger_detail: "Manually raised escalation",
        })
        .select("*")
        .single();

      if (createErr) {
        return NextResponse.json({ error: createErr.message }, { status: 500 });
      }

      await db.from("escalation_notes").insert({
        escalation_id: newEsc.id,
        author_id: user.id,
        content: `Escalation raised manually: ${reason.trim()}`,
        note_type: "status_change",
      });

      await writeAuditLog({
        organisationId: orgId,
        entityType: "escalation",
        entityId: newEsc.id,
        actionType: "created",
        performedBy: user.id,
        metadata: { reason: reason.trim(), severity: newSeverity },
      });

      return NextResponse.json({ escalation: newEsc });
    }

    if (!escalationId) {
      return NextResponse.json({ error: "escalation_id is required" }, { status: 400 });
    }

    // Verify escalation belongs to org
    const { data: esc } = await db
      .from("escalations")
      .select("id, organisation_id, resolved, status, severity, reason")
      .eq("id", escalationId)
      .single();

    if (!esc || esc.organisation_id !== orgId) {
      return NextResponse.json({ error: "Escalation not found" }, { status: 404 });
    }

    switch (action) {
      case "resolve": {
        const resolutionNote = body.resolution_note;
        if (!resolutionNote?.trim()) {
          return NextResponse.json({ error: "resolution_note is required" }, { status: 400 });
        }

        const { data: updated, error: updateErr } = await db
          .from("escalations")
          .update({
            resolved: true,
            resolved_at: new Date().toISOString(),
            resolved_by: user.id,
            resolution_note: resolutionNote,
            status: "resolved",
          })
          .eq("id", escalationId)
          .select("*")
          .single();

        if (updateErr) {
          return NextResponse.json({ error: updateErr.message }, { status: 500 });
        }

        // Add system note
        await db.from("escalation_notes").insert({
          escalation_id: escalationId,
          author_id: user.id,
          content: `Resolved: ${resolutionNote}`,
          note_type: "status_change",
        });

        await writeAuditLog({
          organisationId: orgId,
          entityType: "escalation",
          entityId: escalationId,
          actionType: "resolved",
          performedBy: user.id,
          metadata: { resolution_note: resolutionNote },
        });

        return NextResponse.json({ escalation: updated });
      }

      case "assign": {
        const assignedTo = body.assigned_to;
        if (!assignedTo) {
          return NextResponse.json({ error: "assigned_to (user id) is required" }, { status: 400 });
        }

        const { data: updated, error: updateErr } = await db
          .from("escalations")
          .update({
            assigned_to: assignedTo,
            assigned_at: new Date().toISOString(),
          })
          .eq("id", escalationId)
          .select("*")
          .single();

        if (updateErr) {
          return NextResponse.json({ error: updateErr.message }, { status: 500 });
        }

        // Get assignee name for the note
        const { data: assigneeProfile } = await db
          .from("profiles")
          .select("display_name, email")
          .eq("id", assignedTo)
          .single();
        const assigneeName = assigneeProfile?.display_name || assigneeProfile?.email || assignedTo;

        await db.from("escalation_notes").insert({
          escalation_id: escalationId,
          author_id: user.id,
          content: `Assigned to ${assigneeName}`,
          note_type: "assignment",
        });

        await writeAuditLog({
          organisationId: orgId,
          entityType: "escalation",
          entityId: escalationId,
          actionType: "assigned",
          performedBy: user.id,
          metadata: { assigned_to: assignedTo },
        });

        return NextResponse.json({ escalation: updated });
      }

      case "update_severity": {
        const newSeverity = body.severity;
        if (!newSeverity || !["low", "medium", "high", "critical"].includes(newSeverity)) {
          return NextResponse.json({ error: "severity must be low|medium|high|critical" }, { status: 400 });
        }

        const oldSeverity = esc.severity;
        const { data: updated, error: updateErr } = await db
          .from("escalations")
          .update({ severity: newSeverity })
          .eq("id", escalationId)
          .select("*")
          .single();

        if (updateErr) {
          return NextResponse.json({ error: updateErr.message }, { status: 500 });
        }

        await db.from("escalation_notes").insert({
          escalation_id: escalationId,
          author_id: user.id,
          content: `Severity changed from ${oldSeverity} to ${newSeverity}`,
          note_type: "severity_change",
        });

        await writeAuditLog({
          organisationId: orgId,
          entityType: "escalation",
          entityId: escalationId,
          actionType: "severity_changed",
          performedBy: user.id,
          metadata: { from: oldSeverity, to: newSeverity },
        });

        return NextResponse.json({ escalation: updated });
      }

      case "update_status": {
        const newStatus = body.status;
        if (!newStatus || !["open", "investigating", "resolved", "closed"].includes(newStatus)) {
          return NextResponse.json({ error: "status must be open|investigating|resolved|closed" }, { status: 400 });
        }

        const updates: Record<string, unknown> = { status: newStatus };
        if (newStatus === "resolved" || newStatus === "closed") {
          updates.resolved = true;
          updates.resolved_at = new Date().toISOString();
          updates.resolved_by = user.id;
        }

        const { data: updated, error: updateErr } = await db
          .from("escalations")
          .update(updates)
          .eq("id", escalationId)
          .select("*")
          .single();

        if (updateErr) {
          return NextResponse.json({ error: updateErr.message }, { status: 500 });
        }

        await db.from("escalation_notes").insert({
          escalation_id: escalationId,
          author_id: user.id,
          content: `Status changed to ${newStatus}`,
          note_type: "status_change",
        });

        return NextResponse.json({ escalation: updated });
      }

      case "add_note": {
        const content = body.content;
        if (!content?.trim()) {
          return NextResponse.json({ error: "content is required" }, { status: 400 });
        }

        const { data: note, error: noteErr } = await db
          .from("escalation_notes")
          .insert({
            escalation_id: escalationId,
            author_id: user.id,
            content: content.trim(),
            note_type: "comment",
          })
          .select("*")
          .single();

        if (noteErr) {
          return NextResponse.json({ error: noteErr.message }, { status: 500 });
        }

        return NextResponse.json({ note });
      }

      case "link_action": {
        const actionId = body.action_id;
        if (!actionId) {
          return NextResponse.json({ error: "action_id is required" }, { status: 400 });
        }

        const { error: linkErr } = await db
          .from("escalation_action_links")
          .insert({ escalation_id: escalationId, action_id: actionId });

        if (linkErr) {
          return NextResponse.json({ error: linkErr.message }, { status: 500 });
        }

        return NextResponse.json({ linked: true });
      }

      case "create_incident": {
        // Create an incident from this escalation
        const { data: incident, error: incErr } = await db
          .from("incidents")
          .insert({
            organisation_id: orgId,
            title: body.title || esc.reason || "Escalated incident",
            description: body.description || `Escalated from escalation ${escalationId}`,
            severity: esc.severity,
            status: "open",
            reported_by: user.id,
          })
          .select("*")
          .single();

        if (incErr) {
          return NextResponse.json({ error: incErr.message }, { status: 500 });
        }

        await db.from("escalation_notes").insert({
          escalation_id: escalationId,
          author_id: user.id,
          content: `Escalated to incident: ${incident.title}`,
          note_type: "status_change",
        });

        await writeAuditLog({
          organisationId: orgId,
          entityType: "escalation",
          entityId: escalationId,
          actionType: "escalated_to_incident",
          performedBy: user.id,
          metadata: { incident_id: incident.id },
        });

        return NextResponse.json({ incident });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
