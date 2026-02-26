import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-auth-server";
import { supabaseServer } from "@/lib/supabaseServer";

// ---------------------------------------------------------------------------
// Helper: authenticate + get org_id
// ---------------------------------------------------------------------------

async function getAuthenticatedOrg() {
  const authClient = await createSupabaseServerClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  }

  const db = supabaseServer();
  const { data: profile } = await db
    .from("profiles")
    .select("organisation_id")
    .eq("id", user.id)
    .single();

  if (!profile?.organisation_id) {
    return { error: NextResponse.json({ error: "No organisation linked" }, { status: 400 }) };
  }

  return { user, orgId: profile.organisation_id };
}

// ---------------------------------------------------------------------------
// GET /api/trustgraph/escalations — list escalations for the user's org
// ---------------------------------------------------------------------------
// Query params: resolved (true|false), severity, page, per_page

export async function GET(req: NextRequest) {
  try {
    const result = await getAuthenticatedOrg();
    if ("error" in result) return result.error;

    const { orgId } = result;
    const db = supabaseServer();
    const url = req.nextUrl;

    const resolved = url.searchParams.get("resolved");
    const severity = url.searchParams.get("severity");
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
    const perPage = Math.min(100, Math.max(1, Number(url.searchParams.get("per_page")) || 50));

    let query = db
      .from("escalations")
      .select("*", { count: "exact" })
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

    const { data: escalations, error: fetchErr, count } = await query;

    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }

    return NextResponse.json({
      escalations: escalations || [],
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
// POST /api/trustgraph/escalations — resolve an escalation
// ---------------------------------------------------------------------------
// Body: { escalation_id, resolved: true }

export async function POST(req: NextRequest) {
  try {
    const result = await getAuthenticatedOrg();
    if ("error" in result) return result.error;

    const { user, orgId } = result;
    const db = supabaseServer();
    const body = await req.json();

    const escalationId = body.escalation_id;
    if (!escalationId) {
      return NextResponse.json({ error: "escalation_id is required" }, { status: 400 });
    }

    // Verify escalation belongs to org
    const { data: esc } = await db
      .from("escalations")
      .select("id, organisation_id, resolved")
      .eq("id", escalationId)
      .single();

    if (!esc || esc.organisation_id !== orgId) {
      return NextResponse.json({ error: "Escalation not found" }, { status: 404 });
    }

    if (esc.resolved) {
      return NextResponse.json({ error: "Already resolved" }, { status: 400 });
    }

    const { data: updated, error: updateErr } = await db
      .from("escalations")
      .update({
        resolved: true,
        resolved_at: new Date().toISOString(),
        resolved_by: user.id,
      })
      .eq("id", escalationId)
      .select("*")
      .single();

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // Audit log
    await db.from("audit_logs").insert({
      organisation_id: orgId,
      entity_type: "escalation",
      entity_id: escalationId,
      action_type: "resolved",
      performed_by: user.id,
      metadata: { resolved_at: new Date().toISOString() },
    });

    return NextResponse.json({ escalation: updated });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
