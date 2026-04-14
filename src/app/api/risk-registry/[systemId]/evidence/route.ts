import { NextRequest } from "next/server";
import { requireAuth, apiError, apiOk } from "@/lib/apiHelpers";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ systemId: string }> }
) {
  const { systemId } = await params;
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const rawDays = parseInt(searchParams.get("days") ?? "30", 10);
  const days = Math.min(isNaN(rawDays) ? 30 : rawDays, 90);
  const since = new Date(Date.now() - days * 86400000).toISOString();

  // Get system name for signal matching
  const { data: system } = await auth.db
    .from("systems")
    .select("name")
    .eq("id", systemId)
    .single();

  if (!system) return apiError("System not found", 404);

  // Get signals from both system-specific and github sources
  const { data: signals } = await auth.db
    .from("runtime_signals")
    .select("*")
    .eq("organisation_id", auth.orgId)
    .gte("created_at", since)
    .in("system_name", [system.name, "github"])
    .order("created_at", { ascending: false });

  // Categorize evidence
  type Category = { pass: number; fail: number; warning: number; total: number; items: unknown[] };
  const categories: Record<string, Category> = {
    governance: { pass: 0, fail: 0, warning: 0, total: 0, items: [] },
    security: { pass: 0, fail: 0, warning: 0, total: 0, items: [] },
    operations: { pass: 0, fail: 0, warning: 0, total: 0, items: [] },
    model_provenance: { pass: 0, fail: 0, warning: 0, total: 0, items: [] },
  };

  for (const signal of signals ?? []) {
    const ctx = signal.context as Record<string, unknown> | null;
    const evidenceType = (ctx?.evidence_type as string) ?? signal.metric_name;
    const status = signal.metric_value === 1 ? "pass" : signal.metric_value === 0 ? "fail" : "warning";

    let category = "operations";
    if (["dependabot", "security_scan"].includes(evidenceType)) category = "security";
    if (["codeowners", "pr_review"].includes(evidenceType)) category = "governance";
    if (["model_card", "training_config"].includes(evidenceType)) category = "model_provenance";

    categories[category][status as "pass" | "fail" | "warning"]++;
    categories[category].total++;
    categories[category].items.push({
      type: evidenceType,
      title: ctx?.title ?? signal.metric_name,
      url: ctx?.url ?? null,
      status,
      collected_at: signal.created_at,
    });
  }

  // Compute evidence completeness score (0-100)
  const totalChecks = Object.values(categories).reduce((a, c) => a + c.total, 0);
  const passedChecks = Object.values(categories).reduce((a, c) => a + c.pass, 0);
  const completeness = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 0;

  return apiOk({
    data: {
      system_id: systemId,
      system_name: system.name,
      period_days: days,
      completeness_score: completeness,
      total_evidence: totalChecks,
      categories,
    },
  });
}
