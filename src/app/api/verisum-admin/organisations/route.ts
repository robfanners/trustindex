import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/vcc/adminAuth";
import { supabaseServer } from "@/lib/supabaseServer";

// ---------------------------------------------------------------------------
// GET /api/verisum-admin/organisations — Paginated org/user list
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin("view_org_details");
    if ("error" in auth) return auth.error;

    const { searchParams } = request.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get("per_page") ?? "25", 10)));
    const search = searchParams.get("search")?.trim() ?? "";
    const planFilter = searchParams.get("plan")?.trim() ?? "";
    const statusFilter = searchParams.get("status")?.trim() ?? "";

    const db = supabaseServer();

    // Build query for profiles
    let query = db
      .from("profiles")
      .select("id, email, plan, created_at, suspended_at", { count: "exact" })
      .order("created_at", { ascending: false });

    // Filters
    if (search) {
      query = query.ilike("email", `%${search}%`);
    }
    if (planFilter) {
      query = query.eq("plan", planFilter);
    }
    if (statusFilter === "suspended") {
      query = query.not("suspended_at", "is", null);
    } else if (statusFilter === "active") {
      query = query.is("suspended_at", null);
    }

    // Pagination
    const from = (page - 1) * perPage;
    const to = from + perPage - 1;
    query = query.range(from, to);

    const { data: profiles, count, error: profErr } = await query;

    if (profErr) {
      return NextResponse.json({ error: profErr.message }, { status: 500 });
    }

    if (!profiles || profiles.length === 0) {
      return NextResponse.json({
        data: { organisations: [], total: count ?? 0, page, per_page: perPage },
      });
    }

    // For each org, fetch survey + system counts
    const orgIds = profiles.map((p) => p.id as string);

    const [surveysRes, systemsRes] = await Promise.all([
      db
        .from("survey_runs")
        .select("owner_user_id")
        .in("owner_user_id", orgIds),
      db
        .from("systems")
        .select("owner_id")
        .in("owner_id", orgIds)
        .eq("archived", false),
    ]);

    // Build count maps
    const surveyCounts = new Map<string, number>();
    for (const s of surveysRes.data ?? []) {
      const uid = s.owner_user_id as string;
      surveyCounts.set(uid, (surveyCounts.get(uid) ?? 0) + 1);
    }

    const systemCounts = new Map<string, number>();
    for (const s of systemsRes.data ?? []) {
      const uid = s.owner_id as string;
      systemCounts.set(uid, (systemCounts.get(uid) ?? 0) + 1);
    }

    const organisations = profiles.map((p) => ({
      id: p.id,
      email: p.email,
      plan: p.plan,
      created_at: p.created_at,
      suspended_at: p.suspended_at,
      survey_count: surveyCounts.get(p.id as string) ?? 0,
      system_count: systemCounts.get(p.id as string) ?? 0,
    }));

    return NextResponse.json({
      data: {
        organisations,
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
