import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/vcc/adminAuth";
import { supabaseServer } from "@/lib/supabaseServer";

// ---------------------------------------------------------------------------
// GET /api/verisum-admin/risk-monitor — Flagged system runs
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin("view_aggregated_metrics");
    if ("error" in auth) return auth.error;

    const { searchParams } = request.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const perPage = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("per_page") ?? "50", 10))
    );

    const db = supabaseServer();

    // Fetch submitted runs with non-empty risk_flags
    const { data: runs, count, error: runErr } = await db
      .from("system_runs")
      .select("id, system_id, overall_score, risk_flags, created_at, submitted_at", {
        count: "exact",
      })
      .eq("status", "submitted")
      .not("risk_flags", "eq", "[]")
      .not("risk_flags", "is", null)
      .order("submitted_at", { ascending: false })
      .range((page - 1) * perPage, (page - 1) * perPage + perPage - 1);

    if (runErr) {
      return NextResponse.json({ error: runErr.message }, { status: 500 });
    }

    if (!runs || runs.length === 0) {
      return NextResponse.json({
        data: { runs: [], total: count ?? 0, page, per_page: perPage },
      });
    }

    // Enrich with system name + owner email
    const systemIds = [...new Set(runs.map((r) => r.system_id as string))];

    const { data: systems } = await db
      .from("systems")
      .select("id, name, owner_id")
      .in("id", systemIds);

    const systemMap = new Map(
      (systems ?? []).map((s) => [
        s.id as string,
        { name: s.name as string, owner_id: s.owner_id as string },
      ])
    );

    const ownerIds = [
      ...new Set(
        (systems ?? []).map((s) => s.owner_id as string).filter(Boolean)
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

    const enriched = runs.map((r) => {
      const sys = systemMap.get(r.system_id as string);
      return {
        run_id: r.id,
        run_created_at: r.created_at,
        run_submitted_at: r.submitted_at,
        overall_score: r.overall_score,
        risk_flags: r.risk_flags ?? [],
        system_id: r.system_id,
        system_name: sys?.name ?? "Unknown",
        owner_email: sys ? emailMap.get(sys.owner_id) ?? null : null,
      };
    });

    return NextResponse.json({
      data: {
        runs: enriched,
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
