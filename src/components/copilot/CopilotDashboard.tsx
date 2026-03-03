"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  isPaidPlan,
  canGeneratePolicy,
  canAccessWizard,
  canGeneratePack,
  canAccessMonthlyReport,
} from "@/lib/entitlements";
import Tooltip from "@/components/Tooltip";
import VendorRegister from "./VendorRegister";
import IncidentLog from "./IncidentLog";
import RegulatoryFeed from "./RegulatoryFeed";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PolicySummary = {
  id: string;
  policy_type: string;
  version: number;
  created_at: string;
};

type TokenSummary = {
  id: string;
  token: string;
  label: string | null;
  is_active: boolean;
  created_at: string;
};

type DeclarationStats = {
  totalDeclarations: number;
  tokenCount: number;
};

// ---------------------------------------------------------------------------
// Upgrade overlay for Explorer users
// ---------------------------------------------------------------------------

function LockedOverlay({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="relative">
      <div className="pointer-events-none opacity-40 select-none">{children}</div>
      <div className="absolute inset-0 flex items-center justify-center bg-background/60 rounded-lg">
        <div className="text-center space-y-2">
          <div className="text-2xl">&#128274;</div>
          <p className="text-sm font-medium text-foreground">{label}</p>
          <a
            href="/upgrade"
            className="inline-block text-xs px-3 py-1.5 rounded bg-brand text-white hover:bg-brand-hover transition-colors pointer-events-auto"
          >
            Upgrade to Starter
          </a>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------

function Section({
  title,
  description,
  tooltip,
  locked,
  lockLabel,
  children,
}: {
  title: string;
  description?: string;
  tooltip?: string;
  locked?: boolean;
  lockLabel?: string;
  children: React.ReactNode;
}) {
  const content = (
    <div className="border border-border rounded-xl p-6 space-y-4">
      <div>
        <div className="flex items-center gap-1.5">
          <h3 className="font-semibold text-foreground">{title}</h3>
          {tooltip && (
            <Tooltip content={tooltip}>
              <span className="text-muted-foreground hover:text-foreground cursor-help text-sm">&#9432;</span>
            </Tooltip>
          )}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      {children}
    </div>
  );

  if (locked) {
    return <LockedOverlay label={lockLabel || "Upgrade to unlock"}>{content}</LockedOverlay>;
  }

  return content;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function CopilotDashboard() {
  const { profile, refreshProfile } = useAuth();
  const plan = profile?.plan ?? "explorer";
  const paid = isPaidPlan(plan);

  // Org bootstrap state
  const [orgReady, setOrgReady] = useState(!!profile?.organisation_id);
  const [orgBootstrapping, setOrgBootstrapping] = useState(false);

  // Wizard + governance pack state
  const [wizard, setWizard] = useState<{ completed_at: string | null } | null>(null);
  const [packs, setPacks] = useState<{ id: string; version: number; status: string; generated_at: string | null }[]>([]);
  const [wizardLoading, setWizardLoading] = useState(true);
  const [packsLoading, setPacksLoading] = useState(true);

  // Auto-create org for paid users who don't have one
  useEffect(() => {
    if (!paid || profile?.organisation_id) {
      setOrgReady(!!profile?.organisation_id);
      return;
    }
    let cancelled = false;
    async function ensureOrg() {
      setOrgBootstrapping(true);
      try {
        const res = await fetch("/api/org/ensure", { method: "POST" });
        if (res.ok && !cancelled) {
          setOrgReady(true);
          // Refresh the auth context so downstream fetches pick up the org
          refreshProfile?.();
        }
      } catch {
        // silent
      } finally {
        if (!cancelled) setOrgBootstrapping(false);
      }
    }
    ensureOrg();
    return () => { cancelled = true; };
  }, [paid, profile?.organisation_id, refreshProfile]);

  useEffect(() => {
    if (!orgReady) return;
    async function loadWizard() {
      try {
        const res = await fetch("/api/wizard");
        if (res.ok) {
          const data = await res.json();
          setWizard(data.wizard ?? null);
        }
      } catch {
        // silent
      } finally {
        setWizardLoading(false);
      }
    }
    async function loadPacks() {
      try {
        const res = await fetch("/api/governance-pack");
        if (res.ok) {
          const data = await res.json();
          setPacks(data.packs ?? []);
        }
      } catch {
        // silent
      } finally {
        setPacksLoading(false);
      }
    }
    if (paid) {
      loadWizard();
      loadPacks();
    } else {
      setWizardLoading(false);
      setPacksLoading(false);
    }
  }, [paid, orgReady]);

  const latestPack = packs.length > 0 ? packs[0] : null;

  // Show loading state while bootstrapping org
  if (paid && orgBootstrapping) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground">AI Governance Copilot</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Setting up your organisation...
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
          <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          Creating your organisation workspace
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">AI Governance Copilot</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage your AI policies, vendor register, staff declarations, and compliance.
        </p>
      </div>

      {/* Governance Setup */}
      <Section
        title="Governance Setup"
        description="Complete the setup wizard to configure your AI governance framework"
        tooltip="Complete the setup wizard to generate your AI governance framework — policies, inventory, and gap analysis."
        locked={!canAccessWizard(plan)}
        lockLabel="AI governance setup wizard"
      >
        {wizardLoading ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : wizard?.completed_at ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Last completed:{" "}
              {new Date(wizard.completed_at).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </p>
            <a
              href="/setup"
              className="inline-block text-sm px-4 py-2 rounded bg-brand text-white hover:bg-brand-hover transition-colors"
            >
              Re-run wizard
            </a>
          </div>
        ) : (
          <div className="rounded-lg border border-brand/30 bg-brand/5 p-4 space-y-3">
            <p className="text-sm font-medium text-foreground">
              Set up your AI governance
            </p>
            <p className="text-sm text-muted-foreground">
              Complete the setup wizard to generate your governance pack — policies,
              inventory, and gap analysis in one go.
            </p>
            <a
              href="/setup"
              className="inline-block text-sm px-4 py-2 rounded bg-brand text-white hover:bg-brand-hover transition-colors"
            >
              Start setup wizard
            </a>
          </div>
        )}
      </Section>

      {/* Governance Pack */}
      <Section
        title="Governance Pack"
        description="Download your AI governance documents"
        tooltip="Download your generated governance documents. Re-run the wizard to generate updated versions."
        locked={!canGeneratePack(plan)}
        lockLabel="Governance pack downloads"
      >
        {packsLoading ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : latestPack ? (
          latestPack.status === "generating" ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <svg
                className="animate-spin h-4 w-4 text-brand"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Generating your governance pack...
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Version {latestPack.version}
                {latestPack.generated_at && (
                  <>
                    {" — "}
                    {new Date(latestPack.generated_at).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </>
                )}
              </p>
              <div className="flex flex-wrap gap-2">
                <a
                  href={`/api/governance-pack/${latestPack.id}/pdf?type=statement`}
                  className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded border border-border hover:bg-muted transition-colors"
                >
                  <span aria-hidden="true">&#128196;</span> Governance Statement
                </a>
                <a
                  href={`/api/governance-pack/${latestPack.id}/pdf?type=inventory`}
                  className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded border border-border hover:bg-muted transition-colors"
                >
                  <span aria-hidden="true">&#128202;</span> AI Usage Inventory
                </a>
                <a
                  href={`/api/governance-pack/${latestPack.id}/pdf?type=gap`}
                  className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded border border-border hover:bg-muted transition-colors"
                >
                  <span aria-hidden="true">&#128203;</span> Risk &amp; Gap Analysis
                </a>
              </div>
            </div>
          )
        ) : (
          <p className="text-sm text-muted-foreground">
            Complete the setup wizard to generate your governance pack.
          </p>
        )}
      </Section>

      {/* Monthly Report */}
      <Section
        title="Monthly Compliance Report"
        description="Automated monthly summary of your AI governance posture"
        tooltip="Automated monthly summary of your AI governance posture, emailed on the 1st of each month."
        locked={!canAccessMonthlyReport(plan)}
        lockLabel="Monthly compliance report"
      >
        <p className="text-sm text-muted-foreground">
          Your monthly compliance report will be emailed on the 1st of each month.
        </p>
      </Section>

      {/* AI Policies */}
      <Section
        title="AI Policies"
        description="Generate and manage AI governance policies for your organisation"
        tooltip="Generate tailored AI governance policies using AI. Policies are customised to your organisation's context."
        locked={!paid}
        lockLabel="Generate AI policies"
      >
        <PolicySection plan={plan} />
      </Section>

      {/* Staff Declarations */}
      <Section
        title="Staff Declarations"
        description="Collect AI usage declarations from your team"
        tooltip="Collect AI usage declarations from staff. Create a campaign link, invite your team, and track responses."
        locked={!paid}
        lockLabel="Staff declaration portal"
      >
        <DeclarationSection />
      </Section>

      {/* Vendor Register */}
      <Section
        title="AI Vendor Register"
        description="Track and assess AI tools used across your organisation"
        tooltip="Track and assess all AI tools used across your organisation. Vendors are auto-added from staff declarations."
        locked={!paid}
        lockLabel="AI vendor register"
      >
        <VendorRegister />
      </Section>

      {/* Incident Log */}
      <Section
        title="Incident Log"
        description="Track AI-related incidents and near-misses"
        tooltip="Record AI-related incidents and near-misses. Maintain an audit trail for governance compliance."
        locked={!paid}
        lockLabel="Incident logging"
      >
        <IncidentLog />
      </Section>

      {/* Regulatory Feed */}
      <Section
        title="Regulatory Updates"
        description="Stay current with AI governance regulations"
        tooltip="Stay current with AI governance regulations and guidance relevant to your jurisdiction."
      >
        <RegulatoryFeed />
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Policy section — shows generated policies + generate button
// ---------------------------------------------------------------------------

function PolicySection({ plan }: { plan: string }) {
  const [policies, setPolicies] = useState<PolicySummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/copilot/policies");
        if (res.ok) {
          const data = await res.json();
          setPolicies(data.policies ?? []);
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const POLICY_LABELS: Record<string, string> = {
    acceptable_use: "Acceptable Use Policy",
    data_handling: "Data Handling Addendum",
    staff_guidelines: "Staff Guidelines",
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading policies...</div>;
  }

  return (
    <div className="space-y-3">
      {policies.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No policies generated yet. Generate your first AI governance policy below.
        </p>
      ) : (
        <div className="space-y-2">
          {policies.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/50"
            >
              <div>
                <span className="text-sm font-medium">
                  {POLICY_LABELS[p.policy_type] ?? p.policy_type}
                </span>
                <span className="text-xs text-muted-foreground ml-2">v{p.version}</span>
              </div>
              <span className="text-xs text-muted-foreground">
                {new Date(p.created_at).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </div>
          ))}
        </div>
      )}

      {canGeneratePolicy(plan) && (
        <a
          href="/copilot/generate-policy"
          className="inline-block text-sm px-4 py-2 rounded bg-brand text-white hover:bg-brand-hover transition-colors"
        >
          Generate policy
        </a>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Declaration section — tokens + stats
// ---------------------------------------------------------------------------

function DeclarationSection() {
  const [tokens, setTokens] = useState<TokenSummary[]>([]);
  const [stats, setStats] = useState<DeclarationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/declarations");
        if (res.ok) {
          const data = await res.json();
          setTokens(data.tokens ?? []);
          setStats({
            totalDeclarations: data.totalDeclarations ?? 0,
            tokenCount: data.tokenCount ?? 0,
          });
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function createToken() {
    setCreating(true);
    try {
      const res = await fetch("/api/declarations/create-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: newLabel.trim() || null }),
      });
      if (res.ok) {
        const data = await res.json();
        setTokens((prev) => [data.token, ...prev]);
        setNewLabel("");
        setShowCreate(false);
        // Copy URL to clipboard
        if (data.shareableUrl) {
          navigator.clipboard.writeText(data.shareableUrl).then(() => {
            setCopyMsg("Link copied to clipboard!");
            setTimeout(() => setCopyMsg(null), 3000);
          });
        }
      } else {
        const data = await res.json();
        alert(data.error || "Failed to create token");
      }
    } catch {
      alert("Failed to create token");
    } finally {
      setCreating(false);
    }
  }

  function copyLink(token: string) {
    const url = `${window.location.origin}/declare/${token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopyMsg("Link copied!");
      setTimeout(() => setCopyMsg(null), 3000);
    });
  }

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading declarations...</div>;
  }

  return (
    <div className="space-y-3">
      {/* Stats */}
      {stats && (
        <div className="flex gap-4">
          <div className="text-center px-4 py-2 bg-muted/50 rounded-lg">
            <div className="text-xl font-bold text-foreground">{stats.totalDeclarations}</div>
            <div className="text-xs text-muted-foreground">Declarations</div>
          </div>
          <div className="text-center px-4 py-2 bg-muted/50 rounded-lg">
            <div className="text-xl font-bold text-foreground">{stats.tokenCount}</div>
            <div className="text-xs text-muted-foreground">Active links</div>
          </div>
        </div>
      )}

      {/* Token list */}
      {tokens.length > 0 && (
        <div className="space-y-2">
          {tokens.slice(0, 5).map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/50"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">
                  {t.label || "Declaration link"}
                </span>
                {!t.is_active && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                    Inactive
                  </span>
                )}
              </div>
              {t.is_active && (
                <button
                  onClick={() => copyLink(t.token)}
                  className="text-xs px-2 py-1 rounded border border-border hover:bg-muted transition-colors"
                >
                  Copy link
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Copy confirmation */}
      {copyMsg && (
        <p className="text-xs text-green-600">{copyMsg}</p>
      )}

      {/* Create new */}
      {showCreate ? (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Label (optional)"
            className="flex-1 border border-border rounded px-3 py-1.5 text-sm bg-background"
          />
          <button
            onClick={createToken}
            disabled={creating}
            className="text-sm px-3 py-1.5 rounded bg-brand text-white hover:bg-brand-hover disabled:opacity-50"
          >
            {creating ? "Creating..." : "Create"}
          </button>
          <button
            onClick={() => setShowCreate(false)}
            className="text-sm px-3 py-1.5 rounded border border-border hover:bg-muted"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowCreate(true)}
          className="text-sm px-4 py-2 rounded bg-brand text-white hover:bg-brand-hover transition-colors"
        >
          Create declaration link
        </button>
      )}
    </div>
  );
}
