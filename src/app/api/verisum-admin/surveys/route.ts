import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/vcc/adminAuth";
import { supabaseServer } from "@/lib/supabaseServer";

// ---------------------------------------------------------------------------
// GET /api/verisum-admin/surveys — Paginated cross-org survey list
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin("view_org_details");
    if ("error" in auth) return auth.error;

    const { searchParams } = request.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const perPage = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("per_page") ?? "25", 10))
    );
    const search = searchParams.get("search")?.trim() ?? "";
    const modeFilter = searchParams.get("mode")?.trim() ?? "";
    const statusFilter = searchParams.get("status")?.trim() ?? "";

    const db = supabaseServer();

    // Build base query
    let query = db
      .from("survey_runs")
      .select(
        "id, title, mode, status, respondent_count, created_at, owner_user_id",
        { count: "exact" }
      )
      .order("created_at", { ascending: false });

    // Filters
    if (modeFilter) {
      query = query.eq("mode", modeFilter);
    }
    if (statusFilter) {
      query = query.eq("status", statusFilter);
    }

    // Search: title or email
    if (search) {
      // Find user IDs matching email search
      const { data: matchingProfiles } = await db
        .from("profiles")
        .select("id")
        .ilike("email", `%${search}%`);

      const matchingIds = (matchingProfiles ?? []).map(
        (p) => p.id as string
      );

      if (matchingIds.length > 0) {
        // Search title OR matching owner IDs
        query = query.or(
          `title.ilike.%${search}%,owner_user_id.in.(${matchingIds.join(",")})`
        );
      } else {
        // Only search title
        query = query.ilike("title", `%${search}%`);
      }
    }

    // Pagination
    const from = (page - 1) * perPage;
    const to = from + perPage - 1;
    query = query.range(from, to);

    const { data: surveys, count, error: survErr } = await query;

    if (survErr) {
      return NextResponse.json({ error: survErr.message }, { status: 500 });
    }

    if (!surveys || surveys.length === 0) {
      return NextResponse.json({
        data: { surveys: [], total: count ?? 0, page, per_page: perPage },
      });
    }

    // Enrich with owner emails
    const ownerIds = [
      ...new Set(
        surveys
          .map((s) => s.owner_user_id as string | null)
          .filter(Boolean) as string[]
      ),
    ];

    let emailMap = new Map<string, string>();

    if (ownerIds.length > 0) {
      const { data: profiles } = await db
        .from("profiles")
        .select("id, email")
        .in("id", ownerIds);

      emailMap = new Map(
        (profiles ?? []).map((p) => [p.id as string, p.email as string])
      );
    }

    const enriched = surveys.map((s) => ({
      id: s.id,
      title: s.title,
      mode: s.mode,
      status: s.status,
      respondent_count: s.respondent_count,
      created_at: s.created_at,
      owner_email:
        emailMap.get(s.owner_user_id as string) ?? null,
    }));

    return NextResponse.json({
      data: {
        surveys: enriched,
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
