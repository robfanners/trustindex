"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { isPaidPlan, canGeneratePolicy } from "@/lib/entitlements";
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
  locked,
  lockLabel,
  children,
}: {
  title: string;
  description?: string;
  locked?: boolean;
  lockLabel?: string;
  children: React.ReactNode;
}) {
  const content = (
    <div className="border border-border rounded-xl p-6 space-y-4">
      <div>
        <h3 className="font-semibold text-foreground">{title}</h3>
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
  const { profile } = useAuth();
  const plan = profile?.plan ?? "explorer";
  const paid = isPaidPlan(plan);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">AI Governance Copilot</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage your AI policies, vendor register, staff declarations, and compliance.
        </p>
      </div>

      {/* AI Policies */}
      <Section
        title="AI Policies"
        description="Generate and manage AI governance policies for your organisation"
        locked={!paid}
        lockLabel="Generate AI policies"
      >
        <PolicySection plan={plan} />
      </Section>

      {/* Staff Declarations */}
      <Section
        title="Staff Declarations"
        description="Collect AI usage declarations from your team"
        locked={!paid}
        lockLabel="Staff declaration portal"
      >
        <DeclarationSection />
      </Section>

      {/* Vendor Register */}
      <Section
        title="AI Vendor Register"
        description="Track and assess AI tools used across your organisation"
        locked={!paid}
        lockLabel="AI vendor register"
      >
        <VendorRegister />
      </Section>

      {/* Incident Log */}
      <Section
        title="Incident Log"
        description="Track AI-related incidents and near-misses"
        locked={!paid}
        lockLabel="Incident logging"
      >
        <IncidentLog />
      </Section>

      {/* Regulatory Feed */}
      <Section
        title="Regulatory Updates"
        description="Stay current with AI governance regulations"
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
