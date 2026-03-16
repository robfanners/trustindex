import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-auth-server";
import { supabaseServer } from "@/lib/supabaseServer";
import { writeAuditLog } from "@/lib/audit";
import {
  createGitHubClient,
  fetchPRReviews,
  fetchCodeowners,
  fetchDependabotAlerts,
  fetchCIStatus,
  fetchModelArtifacts,
  GitHubEvidence,
  GitHubRepo,
} from "@/lib/github";

export async function POST() {
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

  const { data: connection } = await db
    .from("integration_connections")
    .select("access_token, sync_config")
    .eq("organisation_id", profile.organisation_id)
    .eq("provider", "github")
    .eq("status", "connected")
    .single();

  if (!connection?.access_token) {
    return NextResponse.json({ error: "GitHub not connected" }, { status: 400 });
  }

  const client = createGitHubClient(connection.access_token);
  const repos = ((connection.sync_config as { repos?: GitHubRepo[] })?.repos) ?? [];
  const since = new Date(Date.now() - 30 * 86400000).toISOString();

  const allEvidence: GitHubEvidence[] = [];
  const errors: string[] = [];

  for (const repo of repos) {
    try {
      const [prReviews, codeowners, dependabot, ciStatus, modelArtifacts] = await Promise.all([
        fetchPRReviews(client, repo, since),
        fetchCodeowners(client, repo),
        fetchDependabotAlerts(client, repo),
        fetchCIStatus(client, repo),
        fetchModelArtifacts(client, repo),
      ]);

      allEvidence.push(...prReviews);
      allEvidence.push(codeowners);
      allEvidence.push(...dependabot);
      allEvidence.push(...ciStatus);
      allEvidence.push(...modelArtifacts);
    } catch (err) {
      errors.push(`${repo.owner}/${repo.repo}: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  // Store as runtime signals
  const signals = allEvidence.map((ev) => ({
    organisation_id: profile.organisation_id,
    system_name: "github",
    signal_type: "compliance" as const,
    metric_name: ev.type,
    metric_value: ev.status === "pass" ? 1 : ev.status === "fail" ? 0 : 0.5,
    source: "integration" as const,
    severity: (ev.status === "fail" ? "critical" : ev.status === "warning" ? "warning" : "info") as "critical" | "warning" | "info",
    context: {
      evidence_type: ev.type,
      title: ev.title,
      url: ev.url,
      metadata: ev.metadata,
      collected_at: ev.collected_at,
    },
  }));

  if (signals.length > 0) {
    await db.from("runtime_signals").insert(signals);
  }

  await db
    .from("integration_connections")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("organisation_id", profile.organisation_id)
    .eq("provider", "github");

  await writeAuditLog({
    organisationId: profile.organisation_id,
    entityType: "integration",
    entityId: "github",
    actionType: "synced",
    performedBy: user.id,
    metadata: {
      evidence_count: allEvidence.length,
      repos_synced: repos.length,
      errors: errors.length > 0 ? errors : undefined,
    },
  });

  return NextResponse.json({
    data: {
      evidence_collected: allEvidence.length,
      signals_created: signals.length,
      repos_synced: repos.length,
      errors,
      summary: {
        pr_reviews: allEvidence.filter((e) => e.type === "pr_review").length,
        ci_checks: allEvidence.filter((e) => e.type === "ci_status").length,
        security_alerts: allEvidence.filter((e) => e.type === "dependabot").length,
        codeowners: allEvidence.filter((e) => e.type === "codeowners").length,
        model_artifacts: allEvidence.filter((e) => e.type === "model_card" || e.type === "training_config").length,
      },
    },
  });
}
