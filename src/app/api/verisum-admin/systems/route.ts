import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/vcc/adminAuth";
import { supabaseServer } from "@/lib/supabaseServer";

// ---------------------------------------------------------------------------
// GET /api/verisum-admin/systems — Paginated cross-org system list
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin("view_system_runs");
    if ("error" in auth) return auth.error;

    const { searchParams } = request.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const perPage = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("per_page") ?? "25", 10))
    );
    const search = searchParams.get("search")?.trim() ?? "";
    const typeFilter = searchParams.get("type")?.trim() ?? "";
    const envFilter = searchParams.get("environment")?.trim() ?? "";

    const db = supabaseServer();

    // Build base query — include archived so admin has full visibility
    let query = db
      .from("systems")
      .select("id, owner_id, name, type, environment, archived, created_at", {
        count: "exact",
      })
      .order("created_at", { ascending: false });

    // Filters
    if (typeFilter) {
      query = query.eq("type", typeFilter);
    }
    if (envFilter) {
      query = query.eq("environment", envFilter);
    }

    // Search: name or owner email
    if (search) {
      const { data: matchingProfiles } = await db
        .from("profiles")
        .select("id")
        .ilike("email", `%${search}%`);

      const matchingIds = (matchingProfiles ?? []).map(
        (p) => p.id as string
      );

      if (matchingIds.length > 0) {
        query = query.or(
          `name.ilike.%${search}%,owner_id.in.(${matchingIds.join(",")})`
        );
      } else {
        query = query.ilike("name", `%${search}%`);
      }
    }

    // Pagination
    const from = (page - 1) * perPage;
    const to = from + perPage - 1;
    query = query.range(from, to);

    const { data: systems, count, error: sysErr } = await query;

    if (sysErr) {
      return NextResponse.json({ error: sysErr.message }, { status: 500 });
    }

    if (!systems || systems.length === 0) {
      return NextResponse.json({
        data: { systems: [], total: count ?? 0, page, per_page: perPage },
      });
    }

    // Enrich: owner emails + latest score + run count
    const ownerIds = [
      ...new Set(systems.map((s) => s.owner_id as string).filter(Boolean)),
    ];
    const systemIds = systems.map((s) => s.id as string);

    const [profilesRes, runsRes] = await Promise.all([
      ownerIds.length > 0
        ? db.from("profiles").select("id, email").in("id", ownerIds)
        : Promise.resolve({ data: [] }),
      systemIds.length > 0
        ? db
            .from("system_runs")
            .select("system_id, status, overall_score, created_at")
            .in("system_id", systemIds)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] }),
    ]);

    const emailMap = new Map(
      (profilesRes.data ?? []).map((p) => [p.id as string, p.email as string])
    );

    const scoreMap = new Map<string, number | null>();
    const countMap = new Map<string, number>();
    for (const r of runsRes.data ?? []) {
      const sid = r.system_id as string;
      countMap.set(sid, (countMap.get(sid) ?? 0) + 1);
      if (r.status === "submitted" && !scoreMap.has(sid)) {
        scoreMap.set(sid, r.overall_score as number | null);
      }
    }

    const enriched = systems.map((s) => ({
      id: s.id,
      name: s.name,
      type: s.type ?? null,
      environment: s.environment ?? null,
      archived: s.archived,
      created_at: s.created_at,
      owner_email: emailMap.get(s.owner_id as string) ?? null,
      latest_score: scoreMap.get(s.id as string) ?? null,
      run_count: countMap.get(s.id as string) ?? 0,
    }));

    return NextResponse.json({
      data: {
        systems: enriched,
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
