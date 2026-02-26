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
// GET /api/actions — list actions for the user's org
// ---------------------------------------------------------------------------
// Query params: status, severity, linked_run_id, owner_id, page, per_page

export async function GET(req: NextRequest) {
  try {
    const result = await getAuthenticatedOrg();
    if ("error" in result) return result.error;

    const { orgId } = result;
    const db = supabaseServer();
    const url = req.nextUrl;

    const status = url.searchParams.get("status");
    const severity = url.searchParams.get("severity");
    const linkedRunId = url.searchParams.get("linked_run_id");
    const ownerId = url.searchParams.get("owner_id");
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
    const perPage = Math.min(100, Math.max(1, Number(url.searchParams.get("per_page")) || 50));

    let query = db
      .from("actions")
      .select("*", { count: "exact" })
      .eq("organisation_id", orgId)
      .order("created_at", { ascending: false })
      .range((page - 1) * perPage, page * perPage - 1);

    if (status) query = query.eq("status", status);
    if (severity) query = query.eq("severity", severity);
    if (linkedRunId) query = query.eq("linked_run_id", linkedRunId);
    if (ownerId) query = query.eq("owner_id", ownerId);

    const { data: actions, error: fetchErr, count } = await query;

    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }

    return NextResponse.json({
      actions: actions || [],
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
// POST /api/actions — create a new action
// ---------------------------------------------------------------------------
// Body: { title, description?, severity?, owner_id?, due_date?,
//         linked_run_id?, linked_run_type?, linked_dimension?,
//         source_recommendation? }

export async function POST(req: NextRequest) {
  try {
    const result = await getAuthenticatedOrg();
    if ("error" in result) return result.error;

    const { user, orgId } = result;
    const db = supabaseServer();
    const body = await req.json();

    const title = String(body.title || "").trim();
    if (!title) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }

    const description = typeof body.description === "string" ? body.description.trim() : null;
    const severity = ["low", "medium", "high", "critical"].includes(body.severity)
      ? body.severity
      : "medium";
    const status = "open"; // always starts open
    const ownerId = typeof body.owner_id === "string" ? body.owner_id : null;
    const dueDate = typeof body.due_date === "string" ? body.due_date : null;
    const linkedRunId = typeof body.linked_run_id === "string" ? body.linked_run_id : null;
    const linkedRunType = ["org", "sys"].includes(body.linked_run_type)
      ? body.linked_run_type
      : null;
    const linkedDimension = typeof body.linked_dimension === "string" ? body.linked_dimension.trim() : null;

    // Resolve dimension name to dimension_id if provided
    let dimensionId: string | null = null;
    if (linkedDimension) {
      const { data: dim } = await db
        .from("dimensions")
        .select("id")
        .eq("name", linkedDimension)
        .maybeSingle();
      dimensionId = dim?.id ?? null;
    }

    // Store source recommendation metadata if provided
    const evidence = body.source_recommendation
      ? { source: "recommendation", recommendation: body.source_recommendation }
      : null;

    const { data: action, error: insertErr } = await db
      .from("actions")
      .insert({
        organisation_id: orgId,
        title,
        description,
        severity,
        status,
        owner_id: ownerId,
        due_date: dueDate,
        linked_run_id: linkedRunId,
        linked_run_type: linkedRunType,
        dimension_id: dimensionId,
        evidence,
      })
      .select("*")
      .single();

    if (insertErr || !action) {
      return NextResponse.json(
        { error: insertErr?.message || "Failed to create action" },
        { status: 500 }
      );
    }

    // Create initial audit entry
    await db.from("action_updates").insert({
      action_id: action.id,
      update_type: "created",
      previous_value: null,
      new_value: { title, severity, status: "open" },
      updated_by: user.id,
    });

    return NextResponse.json({ action }, { status: 201 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
