"use client";

import { useCallback, useEffect, useState } from "react";
import { showActionToast } from "@/components/ui/Toast";

// ---------------------------------------------------------------------------
// /dashboard/settings/integrations — Categorised Integrations
// ---------------------------------------------------------------------------

type IntegrationCard = {
  name: string;
  description: string;
  active: boolean;
  connectHref?: string;
  /** If true, use custom inline UI instead of link */
  inlineConnect?: boolean;
};

type Category = {
  title: string;
  cards: IntegrationCard[];
};

const categories: Category[] = [
  {
    title: "People & Talent",
    cards: [
      { name: "HiBob", description: "Sync org structure (divisions, departments, teams) from HiBob.", active: true, connectHref: "/api/integrations/hibob/auth" },
      { name: "Deel", description: "Import team structure and employee data from Deel.", active: false },
      { name: "Workday", description: "Sync workforce data from Workday HCM.", active: false },
      { name: "ADP", description: "Import organisational hierarchy from ADP.", active: false },
      { name: "Rippling", description: "Sync employee and department data from Rippling.", active: false },
      { name: "Personio", description: "Import team structure from Personio HR.", active: false },
    ],
  },
  {
    title: "Development & Evidence",
    cards: [
      { name: "GitHub", description: "Collect governance evidence: PR reviews, CI status, Dependabot alerts, CODEOWNERS.", active: true, inlineConnect: true },
      { name: "GitLab", description: "Collect governance evidence from GitLab CI/CD and merge requests.", active: false },
      { name: "Bitbucket", description: "Sync code review and pipeline data from Bitbucket.", active: false },
    ],
  },
  {
    title: "Communication & Collaboration",
    cards: [
      { name: "Slack", description: "Get trust score alerts and survey notifications in Slack.", active: false },
      { name: "Microsoft Teams", description: "Share trust reports and survey links in Teams channels.", active: false },
    ],
  },
  {
    title: "Project & Delivery",
    cards: [
      { name: "Jira", description: "Create and track trust improvement actions as Jira tickets.", active: false },
      { name: "Monday.com", description: "Sync trust actions and governance tasks with Monday.com boards.", active: false },
      { name: "ClickUp", description: "Track trust improvement actions as ClickUp tasks.", active: false },
      { name: "Asana", description: "Create and manage trust actions in Asana projects.", active: false },
      { name: "Linear", description: "Sync governance tasks and improvements with Linear issues.", active: false },
      { name: "Azure DevOps", description: "Track trust actions as Azure DevOps work items.", active: false },
      { name: "Trello", description: "Manage trust improvement actions on Trello boards.", active: false },
      { name: "Notion", description: "Sync trust reports and action items to Notion databases.", active: false },
      { name: "Wrike", description: "Track governance actions and projects in Wrike.", active: false },
    ],
  },
  {
    title: "Privacy & Consent",
    cards: [
      { name: "OneTrust", description: "Sync privacy assessments and consent data from OneTrust.", active: false },
      { name: "Osano", description: "Import consent management data from Osano.", active: false },
      { name: "TrustArc", description: "Sync privacy compliance data from TrustArc.", active: false },
      { name: "Ketch", description: "Import consent and data rights from Ketch.", active: false },
      { name: "BigID", description: "Sync data discovery and privacy insights from BigID.", active: false },
      { name: "Securiti.ai", description: "Import privacy and data governance data from Securiti.", active: false },
    ],
  },
  {
    title: "Governance, Risk & Compliance",
    cards: [
      { name: "GRC Export", description: "Export trust data in formats compatible with GRC platforms.", active: false },
      { name: "ServiceNow", description: "Sync governance actions and incidents with ServiceNow GRC.", active: false },
      { name: "MetricStream", description: "Export trust and compliance data to MetricStream.", active: false },
      { name: "RSA Archer", description: "Sync risk and compliance data with RSA Archer.", active: false },
      { name: "SAI360", description: "Export governance and risk data to SAI360.", active: false },
    ],
  },
];

// ---------------------------------------------------------------------------
// GitHub Integration Panel
// ---------------------------------------------------------------------------

type GitHubRepo = { owner: string; repo: string };
type GitHubStatus = {
  connected: boolean;
  last_synced_at: string | null;
  repos: GitHubRepo[];
};
type SyncResult = {
  evidence_collected: number;
  signals_created: number;
  repos_synced: number;
  errors: string[];
  summary: { pr_reviews: number; ci_checks: number; security_alerts: number; codeowners: number };
};

function GitHubPanel() {
  const [status, setStatus] = useState<GitHubStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState("");
  const [repoInput, setRepoInput] = useState("");
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/integrations/github/status");
      if (res.ok) {
        const data = await res.json();
        setStatus(data.data ?? null);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const addRepo = () => {
    const trimmed = repoInput.trim();
    if (!trimmed.includes("/")) return;
    const [owner, repo] = trimmed.split("/", 2);
    if (!owner || !repo) return;
    if (repos.some((r) => r.owner === owner && r.repo === repo)) return;
    setRepos([...repos, { owner, repo }]);
    setRepoInput("");
  };

  const removeRepo = (index: number) => {
    setRepos(repos.filter((_, i) => i !== index));
  };

  const handleConnect = async () => {
    if (!token.trim() || repos.length === 0) return;
    setConnecting(true);
    setError(null);
    try {
      const res = await fetch("/api/integrations/github/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim(), repos }),
      });
      if (res.ok) {
        showActionToast("GitHub connected");
        setToken("");
        setRepos([]);
        await fetchStatus();
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "Failed to connect");
      }
    } catch {
      setError("Network error");
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    setError(null);
    try {
      const res = await fetch("/api/integrations/github/connect", { method: "DELETE" });
      if (res.ok) {
        showActionToast("GitHub disconnected");
        setStatus(null);
        setSyncResult(null);
        await fetchStatus();
      }
    } catch {
      setError("Failed to disconnect");
    } finally {
      setDisconnecting(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    setError(null);
    try {
      const res = await fetch("/api/integrations/github/sync", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setSyncResult(data.data ?? null);
        showActionToast(`Synced ${data.data?.evidence_collected ?? 0} evidence items`);
        await fetchStatus();
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "Sync failed");
      }
    } catch {
      setError("Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="border border-border rounded-lg p-5 space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          Loading GitHub status...
        </div>
      </div>
    );
  }

  // Connected state
  if (status?.connected) {
    return (
      <div className="border border-border rounded-lg p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-foreground">GitHub</h4>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
              Connected
            </span>
          </div>
          <button
            onClick={handleDisconnect}
            disabled={disconnecting}
            className="text-xs text-red-600 hover:text-red-700 font-medium disabled:opacity-50"
          >
            {disconnecting ? "Disconnecting..." : "Disconnect"}
          </button>
        </div>

        <p className="text-xs text-muted-foreground">
          Collect governance evidence: PR reviews, CI status, Dependabot alerts, CODEOWNERS.
        </p>

        {/* Connected repos */}
        <div>
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Repositories</div>
          <div className="flex flex-wrap gap-1.5">
            {status.repos.map((r) => (
              <span key={`${r.owner}/${r.repo}`} className="text-xs px-2 py-0.5 rounded-full bg-muted text-foreground font-mono">
                {r.owner}/{r.repo}
              </span>
            ))}
          </div>
        </div>

        {status.last_synced_at && (
          <p className="text-xs text-muted-foreground">
            Last synced: {new Date(status.last_synced_at).toLocaleString()}
          </p>
        )}

        {/* Sync button */}
        <button
          onClick={handleSync}
          disabled={syncing}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-brand text-white text-xs font-medium hover:bg-brand/90 disabled:opacity-50"
        >
          {syncing ? (
            <>
              <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Syncing...
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Sync Now
            </>
          )}
        </button>

        {/* Sync result */}
        {syncResult && (
          <div className="border border-border rounded-lg p-3 bg-muted/30 space-y-2">
            <div className="text-xs font-medium">Sync Complete</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">Evidence collected:</span>{" "}
                <span className="font-medium">{syncResult.evidence_collected}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Repos synced:</span>{" "}
                <span className="font-medium">{syncResult.repos_synced}</span>
              </div>
              <div>
                <span className="text-muted-foreground">PR reviews:</span>{" "}
                <span className="font-medium">{syncResult.summary.pr_reviews}</span>
              </div>
              <div>
                <span className="text-muted-foreground">CI checks:</span>{" "}
                <span className="font-medium">{syncResult.summary.ci_checks}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Security alerts:</span>{" "}
                <span className="font-medium">{syncResult.summary.security_alerts}</span>
              </div>
              <div>
                <span className="text-muted-foreground">CODEOWNERS:</span>{" "}
                <span className="font-medium">{syncResult.summary.codeowners}</span>
              </div>
            </div>
            {syncResult.errors.length > 0 && (
              <div className="text-xs text-red-600">
                {syncResult.errors.length} error{syncResult.errors.length !== 1 ? "s" : ""}: {syncResult.errors[0]}
              </div>
            )}
          </div>
        )}

        {error && <div className="text-xs text-red-600">{error}</div>}
      </div>
    );
  }

  // Disconnected — connection form
  return (
    <div className="border border-border rounded-lg p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-foreground">GitHub</h4>
      </div>
      <p className="text-xs text-muted-foreground">
        Connect a GitHub Personal Access Token to collect governance evidence from your repositories.
      </p>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <label htmlFor="gh-token" className="text-xs font-medium">Personal Access Token</label>
          <input
            id="gh-token"
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="ghp_..."
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
          <p className="text-xs text-muted-foreground">Requires <code className="font-mono bg-muted/50 px-1 py-0.5 rounded">repo</code> scope</p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="gh-repo" className="text-xs font-medium">Repositories</label>
          <div className="flex gap-2">
            <input
              id="gh-repo"
              type="text"
              value={repoInput}
              onChange={(e) => setRepoInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addRepo(); } }}
              placeholder="owner/repo"
              className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
            <button
              type="button"
              onClick={addRepo}
              disabled={!repoInput.includes("/")}
              className="px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted/50 disabled:opacity-40"
            >
              Add
            </button>
          </div>
          {repos.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {repos.map((r, i) => (
                <span key={i} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-muted text-foreground font-mono">
                  {r.owner}/{r.repo}
                  <button onClick={() => removeRepo(i)} className="text-muted-foreground hover:text-foreground">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={handleConnect}
          disabled={connecting || !token.trim() || repos.length === 0}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-brand text-white text-xs font-medium hover:bg-brand/90 disabled:opacity-40"
        >
          {connecting ? "Connecting..." : "Connect GitHub"}
        </button>
      </div>

      {error && <div className="text-xs text-red-600">{error}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function IntegrationsSettingsPage() {
  const [hibobStatus, setHibobStatus] = useState<string | null>(null);
  const [hibobLastSync, setHibobLastSync] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/integrations/hibob/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setHibobStatus(data.status ?? null);
          setHibobLastSync(data.last_synced_at ?? null);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Integrations</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Connect Verisum with your existing tools and workflows.
        </p>
      </div>

      {categories.map((cat) => (
        <section key={cat.title} className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            {cat.title}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {cat.cards.map((card) => {
              // GitHub gets its own panel
              if (card.name === "GitHub" && card.inlineConnect) {
                return <GitHubPanel key={card.name} />;
              }

              return (
                <div
                  key={card.name}
                  className={`border border-border rounded-lg p-5 space-y-3 ${
                    card.active ? "" : "opacity-60"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-foreground">{card.name}</h4>
                    {!card.active && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-muted-foreground font-medium dark:bg-gray-800">
                        Coming Soon
                      </span>
                    )}
                    {card.name === "HiBob" && hibobStatus === "connected" && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-medium dark:bg-green-900 dark:text-green-300">
                        Connected
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{card.description}</p>

                  {/* HiBob-specific: show last synced */}
                  {card.name === "HiBob" && hibobStatus === "connected" && hibobLastSync && (
                    <p className="text-xs text-muted-foreground">
                      Last synced: {new Date(hibobLastSync).toLocaleDateString()}
                    </p>
                  )}

                  {card.active ? (
                    <a
                      href={card.connectHref ?? "#"}
                      className="inline-block px-3 py-1.5 rounded bg-brand text-white text-xs font-medium hover:bg-brand-hover"
                    >
                      {card.name === "HiBob" && hibobStatus === "connected" ? "Manage" : "Connect"}
                    </a>
                  ) : (
                    <button
                      disabled
                      className="px-3 py-1.5 rounded border border-border text-xs text-muted-foreground cursor-not-allowed"
                    >
                      Connect
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <p className="text-xs text-muted-foreground text-center">
        More integrations are coming soon. Contact{" "}
        <a
          href="mailto:hello@verisum.org"
          className="text-brand underline hover:text-foreground"
        >
          hello@verisum.org
        </a>{" "}
        to request early access.
      </p>
    </div>
  );
}
