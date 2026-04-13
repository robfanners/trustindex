import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-auth-server";
import { supabaseServer } from "@/lib/supabase/admin";

/**
 * GET /api/audit-trail
 * Fetch audit logs for the authenticated user's organisation.
 * Supports pagination and optional filtering.
 *
 * Query params:
 * - limit: number of results (default 50, max 100)
 * - offset: skip N results (default 0)
 * - entity_type: filter by entity type (optional)
 * - action_type: filter by action type (optional)
 * - start_date: ISO date string to filter logs from (optional)
 * - end_date: ISO date string to filter logs to (optional)
 */
export async function GET(req: Request) {
  // Authenticate user
  const authClient = await createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Get user's organisation
  const db = supabaseServer();
  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select("organisation_id")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return NextResponse.json(
      { error: "Failed to determine organisation" },
      { status: 400 }
    );
  }

  // Parse query params
  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 100);
  const offset = parseInt(url.searchParams.get("offset") ?? "0");
  const entityType = url.searchParams.get("entity_type");
  const actionType = url.searchParams.get("action_type");
  const startDate = url.searchParams.get("start_date");
  const endDate = url.searchParams.get("end_date");

  try {
    // Build query
    let query = db
      .from("audit_logs")
      .select(
        `
        id,
        entity_type,
        entity_id,
        action_type,
        performed_by,
        metadata,
        created_at,
        profiles:performed_by(email, display_name)
      `,
        { count: "exact" }
      )
      .eq("organisation_id", profile.organisation_id)
      .order("created_at", { ascending: false });

    // Apply filters
    if (entityType) {
      query = query.eq("entity_type", entityType);
    }
    if (actionType) {
      query = query.eq("action_type", actionType);
    }
    if (startDate) {
      query = query.gte("created_at", new Date(startDate).toISOString());
    }
    if (endDate) {
      query = query.lte(
        "created_at",
        new Date(endDate).toISOString()
      );
    }

    // Apply pagination
    const { data: logs, error: logsError, count } = await query.range(
      offset,
      offset + limit - 1
    );

    if (logsError) {
      console.error("[audit-trail] Query error:", logsError);
      return NextResponse.json(
        { error: "Failed to fetch audit logs" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      logs,
      total: count ?? 0,
      limit,
      offset,
    });
  } catch (err) {
    console.error("[audit-trail] Unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
