import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-auth-server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ systemId: string }> }
) {
  const { systemId } = await params;
  const authClient = await createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const db = supabaseServer();

  const { data: profile } = await db
    .from("profiles")
    .select("organisation_id")
    .eq("id", user.id)
    .single();

  if (!profile?.organisation_id) {
    return NextResponse.json({ error: "No organisation linked" }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const days = Math.min(parseInt(searchParams.get("days") ?? "30"), 90);
  const since = new Date(Date.now() - days * 86400000).toISOString();

  // Get system name for signal matching
  const { data: system } = await db
    .from("systems")
    .select("name")
    .eq("id", systemId)
    .single();

  if (!system) return NextResponse.json({ error: "System not found" }, { status: 404 });

  // Get signals from both system-specific and github sources
  const { data: signals } = await db
    .from("runtime_signals")
    .select("*")
    .eq("organisation_id", profile.organisation_id)
    .gte("created_at", since)
    .in("system_name", [system.name, "github"])
    .order("created_at", { ascending: false });

  // Categorize evidence
  type Category = { pass: number; fail: number; warning: number; total: number; items: unknown[] };
  const categories: Record<string, Category> = {
    governance: { pass: 0, fail: 0, warning: 0, total: 0, items: [] },
    security: { pass: 0, fail: 0, warning: 0, total: 0, items: [] },
    operations: { pass: 0, fail: 0, warning: 0, total: 0, items: [] },
  };

  for (const signal of signals ?? []) {
    const ctx = signal.context as Record<string, unknown> | null;
    const evidenceType = (ctx?.evidence_type as string) ?? signal.metric_name;
    const status = signal.metric_value === 1 ? "pass" : signal.metric_value === 0 ? "fail" : "warning";

    let category = "operations";
    if (["dependabot", "security_scan"].includes(evidenceType)) category = "security";
    if (["codeowners", "pr_review"].includes(evidenceType)) category = "governance";

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

  return NextResponse.json({
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
