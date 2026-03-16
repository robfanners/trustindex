import { Octokit } from "octokit";

export type GitHubRepo = {
  owner: string;
  repo: string;
};

export type GitHubEvidence = {
  type: "security_scan" | "pr_review" | "ci_status" | "codeowners" | "dependabot" | "model_card" | "training_config";
  title: string;
  url: string;
  status: "pass" | "fail" | "warning" | "info";
  metadata: Record<string, unknown>;
  collected_at: string;
};

export function createGitHubClient(accessToken: string): Octokit {
  return new Octokit({ auth: accessToken });
}

export async function validateGitHubToken(token: string): Promise<boolean> {
  try {
    const client = createGitHubClient(token);
    await client.rest.users.getAuthenticated();
    return true;
  } catch {
    return false;
  }
}

/** Fetch recent merged PRs with review status */
export async function fetchPRReviews(
  client: Octokit,
  repo: GitHubRepo,
  since: string
): Promise<GitHubEvidence[]> {
  const { data: pulls } = await client.rest.pulls.list({
    ...repo,
    state: "closed",
    sort: "updated",
    direction: "desc",
    per_page: 50,
  });

  const recentPRs = pulls.filter(
    (pr) => pr.merged_at && new Date(pr.merged_at) >= new Date(since)
  );

  const evidence: GitHubEvidence[] = [];

  for (const pr of recentPRs) {
    const { data: reviews } = await client.rest.pulls.listReviews({
      ...repo,
      pull_number: pr.number,
    });

    const approved = reviews.some((r) => r.state === "APPROVED");
    const changesRequested = reviews.some((r) => r.state === "CHANGES_REQUESTED");

    evidence.push({
      type: "pr_review",
      title: `PR #${pr.number}: ${pr.title}`,
      url: pr.html_url,
      status: approved ? "pass" : changesRequested ? "warning" : "info",
      metadata: {
        number: pr.number,
        author: pr.user?.login,
        reviewers: reviews.map((r) => r.user?.login),
        approved,
        merged_at: pr.merged_at,
      },
      collected_at: new Date().toISOString(),
    });
  }

  return evidence;
}

/** Check CODEOWNERS file existence */
export async function fetchCodeowners(
  client: Octokit,
  repo: GitHubRepo
): Promise<GitHubEvidence> {
  const paths = [".github/CODEOWNERS", "CODEOWNERS", "docs/CODEOWNERS"];

  for (const path of paths) {
    try {
      const { data } = await client.rest.repos.getContent({ ...repo, path });
      if ("content" in data) {
        return {
          type: "codeowners",
          title: "CODEOWNERS file present",
          url: `https://github.com/${repo.owner}/${repo.repo}/blob/main/${path}`,
          status: "pass",
          metadata: { path, size: data.size },
          collected_at: new Date().toISOString(),
        };
      }
    } catch {
      continue;
    }
  }

  return {
    type: "codeowners",
    title: "No CODEOWNERS file found",
    url: `https://github.com/${repo.owner}/${repo.repo}`,
    status: "warning",
    metadata: { searched: paths },
    collected_at: new Date().toISOString(),
  };
}

/** Fetch Dependabot alerts */
export async function fetchDependabotAlerts(
  client: Octokit,
  repo: GitHubRepo
): Promise<GitHubEvidence[]> {
  try {
    const { data: alerts } = await client.rest.dependabot.listAlertsForRepo({
      ...repo,
      state: "open",
      per_page: 50,
    });

    return alerts.map((alert) => ({
      type: "dependabot" as const,
      title: alert.security_advisory.summary,
      url: alert.html_url,
      status: (alert.security_advisory.severity === "critical" || alert.security_advisory.severity === "high"
        ? "fail"
        : "warning") as "fail" | "warning",
      metadata: {
        severity: alert.security_advisory.severity,
        package: alert.dependency.package?.name,
        ecosystem: alert.dependency.package?.ecosystem,
        cve: alert.security_advisory.cve_id,
      },
      collected_at: new Date().toISOString(),
    }));
  } catch {
    return [];
  }
}

/** Fetch latest CI workflow runs */
export async function fetchCIStatus(
  client: Octokit,
  repo: GitHubRepo
): Promise<GitHubEvidence[]> {
  const { data: workflows } = await client.rest.actions.listRepoWorkflows({
    ...repo,
    per_page: 10,
  });

  const evidence: GitHubEvidence[] = [];

  for (const workflow of workflows.workflows.slice(0, 5)) {
    const { data: runs } = await client.rest.actions.listWorkflowRuns({
      ...repo,
      workflow_id: workflow.id,
      per_page: 1,
    });

    const latestRun = runs.workflow_runs[0];
    if (!latestRun) continue;

    evidence.push({
      type: "ci_status",
      title: `${workflow.name}: ${latestRun.conclusion ?? latestRun.status}`,
      url: latestRun.html_url,
      status: latestRun.conclusion === "success" ? "pass"
        : latestRun.conclusion === "failure" ? "fail"
        : "warning",
      metadata: {
        workflow_name: workflow.name,
        run_number: latestRun.run_number,
        conclusion: latestRun.conclusion,
        started_at: latestRun.run_started_at,
        head_sha: latestRun.head_sha?.slice(0, 8),
      },
      collected_at: new Date().toISOString(),
    });
  }

  return evidence;
}

/** Fetch model artifact files (model cards, training configs) */
export async function fetchModelArtifacts(
  client: Octokit,
  repo: GitHubRepo
): Promise<GitHubEvidence[]> {
  const artifactPaths: { path: string; type: "model_card" | "training_config"; label: string }[] = [
    { path: "model_card.md", type: "model_card", label: "Model Card" },
    { path: "MODEL_CARD.md", type: "model_card", label: "Model Card" },
    { path: "docs/model_card.md", type: "model_card", label: "Model Card" },
    { path: "model_config.json", type: "training_config", label: "Model Config" },
    { path: "training_config.yaml", type: "training_config", label: "Training Config" },
    { path: "training_config.yml", type: "training_config", label: "Training Config" },
  ];

  const evidence: GitHubEvidence[] = [];

  for (const artifact of artifactPaths) {
    try {
      const { data } = await client.rest.repos.getContent({ ...repo, path: artifact.path });
      if ("content" in data) {
        evidence.push({
          type: artifact.type,
          title: `${artifact.label} found: ${artifact.path}`,
          url: `https://github.com/${repo.owner}/${repo.repo}/blob/main/${artifact.path}`,
          status: "pass",
          metadata: { path: artifact.path, size: data.size },
          collected_at: new Date().toISOString(),
        });
      }
    } catch {
      // File not found — skip
    }
  }

  return evidence;
}
