import { NextRequest } from "next/server";
import { requireAuth, apiError, apiOk } from "@/lib/apiHelpers";

// ---------------------------------------------------------------------------
// GET /api/trustsys/assessments — list org's TrustSys assessments with latest run
// Uses the existing `systems` + `system_runs` tables
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;
    const { orgId, db } = auth;

    // Fetch systems (assessments) owned by users in the same org
    // The `systems` table uses `owner_id` (user) — join through profiles to match org
    const { data: orgUsers } = await db
      .from("profiles")
      .select("id")
      .eq("organisation_id", orgId);

    const userIds = (orgUsers || []).map((u) => u.id);

    if (userIds.length === 0) {
      return apiOk({ assessments: [] });
    }

    const { data: systems, error: sysErr } = await db
      .from("systems")
      .select("id, name, version_label, type, environment, created_at")
      .in("owner_id", userIds)
      .eq("archived", false)
      .order("created_at", { ascending: false });

    if (sysErr) {
      return apiError(sysErr.message, 500);
    }

    if (!systems || systems.length === 0) {
      return apiOk({ assessments: [] });
    }

    // Fetch runs for all systems to get latest score, run count, status
    const systemIds = systems.map((s) => s.id);

    const { data: runs } = await db
      .from("system_runs")
      .select("system_id, status, overall_score, version_label, created_at, submitted_at")
      .in("system_id", systemIds)
      .order("created_at", { ascending: false });

    // Build maps
    const latestRunMap = new Map<
      string,
      {
        score: number | null;
        status: string;
        version_label: string | null;
      }
    >();
    const runCountMap = new Map<string, number>();
    const hasInProgressMap = new Map<string, boolean>();

    for (const r of runs || []) {
      const sid = r.system_id as string;
      runCountMap.set(sid, (runCountMap.get(sid) ?? 0) + 1);

      // Map "draft" → in_progress
      if (r.status === "draft") {
        hasInProgressMap.set(sid, true);
      }

      // Latest completed = "submitted" status (already sorted desc by created_at)
      if (!latestRunMap.has(sid) && r.status === "submitted") {
        latestRunMap.set(sid, {
          score: r.overall_score as number | null,
          status: "completed",
          version_label: r.version_label as string | null,
        });
      }
    }

    // Fetch IBG status for all systems
    const { data: ibgSpecs } = await db
      .from("ibg_specifications")
      .select("assessment_id, status")
      .in("assessment_id", systemIds)
      .in("status", ["active", "draft"])
      .order("status", { ascending: true }); // "active" before "draft"

    const ibgStatusMap = new Map<string, string>();
    for (const spec of ibgSpecs || []) {
      const sid = spec.assessment_id as string;
      // Active takes precedence over draft
      if (!ibgStatusMap.has(sid) || spec.status === "active") {
        ibgStatusMap.set(sid, spec.status as string);
      }
    }

    const result = systems.map((s) => {
      const latest = latestRunMap.get(s.id as string);
      return {
        id: s.id,
        name: s.name,
        version_label: s.version_label,
        type: s.type,
        environment: s.environment,
        created_at: s.created_at,
        latest_score: latest?.score ?? null,
        latest_status: latest?.status ?? null,
        stability_status: "provisional",
        latest_version: 0,
        run_count: runCountMap.get(s.id as string) ?? 0,
        has_in_progress: hasInProgressMap.get(s.id as string) ?? false,
        ibg_status: ibgStatusMap.get(s.id as string) ?? "none",
      };
    });

    return apiOk({ assessments: result });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return apiError(message, 500);
  }
}

// ---------------------------------------------------------------------------
// POST /api/trustsys/assessments — create a new system (assessment)
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;
    const { user, db } = auth;

    const body = await req.json();
    const name = String(body.name || "").trim();
    const versionLabel = String(body.version_label || "").trim();
    const type = typeof body.type === "string" ? body.type.trim() : null;
    const environment =
      typeof body.environment === "string" ? body.environment.trim() : null;
    const aiVendorId = typeof body.ai_vendor_id === "string" ? body.ai_vendor_id.trim() : null;
    const riskCategory = typeof body.risk_category === "string" ? body.risk_category.trim() : "unassessed";
    const ownerName = typeof body.owner_name === "string" ? body.owner_name.trim() : null;
    const ownerRole = typeof body.owner_role === "string" ? body.owner_role.trim() : null;
    const complianceTags = Array.isArray(body.compliance_tags) ? body.compliance_tags : [];

    if (!name) {
      return apiError("name is required", 400);
    }

    const { data: system, error: insertErr } = await db
      .from("systems")
      .insert({
        owner_id: user.id,
        name,
        version_label: versionLabel || null,
        type: type || null,
        environment: environment || null,
        ai_vendor_id: aiVendorId || null,
        risk_category: riskCategory,
        owner_name: ownerName || null,
        owner_role: ownerRole || null,
        compliance_tags: complianceTags,
      })
      .select("id, name, version_label, type, environment, created_at")
      .single();

    if (insertErr || !system) {
      return apiError(insertErr?.message || "Failed to create assessment", 500);
    }

    return apiOk({
      assessment: {
        id: system.id,
        name: system.name,
        version_label: system.version_label,
        type: system.type,
        environment: system.environment,
        created_at: system.created_at,
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return apiError(message, 500);
  }
}
