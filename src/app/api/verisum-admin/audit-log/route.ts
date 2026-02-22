import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/vcc/adminAuth";
import { supabaseServer } from "@/lib/supabaseServer";

// ---------------------------------------------------------------------------
// GET /api/verisum-admin/audit-log — Paginated audit log viewer
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin("view_audit_log");
    if ("error" in auth) return auth.error;

    const { searchParams } = request.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get("per_page") ?? "50", 10)));
    const actionFilter = searchParams.get("action")?.trim() ?? "";
    const targetTypeFilter = searchParams.get("target_type")?.trim() ?? "";
    const adminUserIdFilter = searchParams.get("admin_user_id")?.trim() ?? "";
    const fromDate = searchParams.get("from")?.trim() ?? "";
    const toDate = searchParams.get("to")?.trim() ?? "";

    const db = supabaseServer();

    let query = db
      .from("vcc_audit_log")
      .select(
        "id, admin_user_id, admin_email, admin_role, action, target_type, target_id, reason, before_snapshot, after_snapshot, metadata, created_at",
        { count: "exact" }
      )
      .order("created_at", { ascending: false });

    // Filters
    if (actionFilter) {
      query = query.ilike("action", `%${actionFilter}%`);
    }
    if (targetTypeFilter) {
      query = query.eq("target_type", targetTypeFilter);
    }
    if (adminUserIdFilter) {
      query = query.eq("admin_user_id", adminUserIdFilter);
    }
    if (fromDate) {
      query = query.gte("created_at", fromDate);
    }
    if (toDate) {
      query = query.lte("created_at", toDate);
    }

    // Pagination
    const from = (page - 1) * perPage;
    const to = from + perPage - 1;
    query = query.range(from, to);

    const { data: entries, count, error: logErr } = await query;

    if (logErr) {
      return NextResponse.json({ error: logErr.message }, { status: 500 });
    }

    return NextResponse.json({
      data: {
        entries: entries ?? [],
        total: count ?? 0,
        page,
        per_page: perPage,
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
