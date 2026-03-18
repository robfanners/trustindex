import { requireAuth, apiError, apiOk, withErrorHandling, parseBody } from "@/lib/apiHelpers";
import {
  getUserPlan,
  getUserSystemCount,
  canCreateSystem,
  getPlanLimits,
} from "@/lib/entitlements";
import { createSystemSchema } from "@/lib/validations";

// ---------------------------------------------------------------------------
// GET /api/systems — list authenticated user's non-archived systems
// ---------------------------------------------------------------------------

export async function GET() {
  return withErrorHandling(async () => {
    const auth = await requireAuth({ withPlan: false });
    if (auth.error) return auth.error;

    const { user, db } = auth;

    // Fetch non-archived systems owned by this user
    const { data: systems, error: sysErr } = await db
      .from("systems")
      .select("id, name, version_label, type, environment, created_at")
      .eq("owner_id", user.id)
      .eq("archived", false)
      .order("created_at", { ascending: false });

    if (sysErr) {
      return apiError(sysErr.message, 500);
    }

    if (!systems || systems.length === 0) {
      return apiOk({ systems: [] });
    }

    // For each system, fetch runs (submitted + draft) for score/count/draft info
    const systemIds = systems.map((s) => s.id);

    const { data: runs } = await db
      .from("system_runs")
      .select("system_id, status, overall_score, created_at")
      .in("system_id", systemIds)
      .order("created_at", { ascending: false });

    // Build maps: latest submitted score per system, run count, has draft
    const latestScoreMap = new Map<string, number | null>();
    const runCountMap = new Map<string, number>();
    const hasDraftMap = new Map<string, boolean>();

    for (const r of runs || []) {
      const sid = r.system_id as string;
      runCountMap.set(sid, (runCountMap.get(sid) ?? 0) + 1);
      if (r.status === "draft") {
        hasDraftMap.set(sid, true);
      }
      if (r.status === "submitted" && !latestScoreMap.has(sid)) {
        latestScoreMap.set(sid, r.overall_score as number | null);
      }
    }

    const result = systems.map((s) => ({
      id: s.id,
      name: s.name,
      version_label: s.version_label,
      type: s.type ?? null,
      environment: s.environment ?? null,
      created_at: s.created_at,
      latest_score: latestScoreMap.get(s.id as string) ?? null,
      run_count: runCountMap.get(s.id as string) ?? 0,
      has_draft: hasDraftMap.get(s.id as string) ?? false,
    }));

    return apiOk({ systems: result });
  });
}

// ---------------------------------------------------------------------------
// POST /api/systems — create a new system (with plan cap check)
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  return withErrorHandling(async () => {
    const auth = await requireAuth({ withPlan: false });
    if (auth.error) return auth.error;

    const { user, db } = auth;
    const parsed = await parseBody(req, createSystemSchema);
    if (parsed.error) return parsed.error;
    const { name, description, vendor, risk_level, status, owner_name, department } = parsed.data;

    // Enforce plan caps
    const [plan, systemCount] = await Promise.all([
      getUserPlan(user.id),
      getUserSystemCount(user.id),
    ]);

    if (!canCreateSystem(plan, systemCount)) {
      const limits = getPlanLimits(plan);
      return apiError(
        limits.maxSystems === 0
          ? "Systems assessment is available on Pro plans and above."
          : `You've reached your plan limit of ${limits.maxSystems} system${limits.maxSystems !== 1 ? "s" : ""}. Upgrade to continue.`,
        403
      );
    }

    const { data: system, error: insertErr } = await db
      .from("systems")
      .insert({
        owner_id: user.id,
        name,
        description,
        vendor,
        risk_level,
        status,
        owner_name,
        department,
      })
      .select("id, name, description, vendor, risk_level, status, owner_name, department, created_at")
      .single();

    if (insertErr || !system) {
      return apiError(insertErr?.message || "Failed to create system", 500);
    }

    return apiOk({ system }, 201);
  });
}
