"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import AuthenticatedShell from "@/components/AuthenticatedShell";
import RequireAuth from "@/components/RequireAuth";
import { getPlanLimits } from "@/lib/entitlements";
import { getTierForScore } from "@/lib/trustGraphTiers";
import { getStabilityBadge, type StabilityStatus } from "@/lib/assessmentLifecycle";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type System = {
  id: string;
  name: string;
  version_label: string;
  type: string | null;
  environment: string | null;
  created_at: string;
  latest_score: number | null;
  run_count: number;
  has_draft: boolean;
};

// ---------------------------------------------------------------------------
// TrustSys Assessments — full list page
// ---------------------------------------------------------------------------

export default function TrustSysPage() {
  return (
    <RequireAuth>
      <TrustSysContent />
    </RequireAuth>
  );
}

function TrustSysContent() {
  const { profile } = useAuth();
  const limits = useMemo(() => getPlanLimits(profile?.plan), [profile?.plan]);

  const [systems, setSystems] = useState<System[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create form state
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formVersion, setFormVersion] = useState("");
  const [formType, setFormType] = useState("");
  const [formEnvironment, setFormEnvironment] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/systems");
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error || "Failed to load systems");
        }
        const d = await res.json();
        setSystems(d.systems || []);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load systems");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const atCap = !loading && systems.length >= limits.maxSystems;
  const approachingCap =
    !loading && !atCap && isFinite(limits.maxSystems) && systems.length === limits.maxSystems - 1;
  const blocked = limits.maxSystems === 0;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFormLoading(true);

    try {
      const res = await fetch("/api/systems", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName.trim(),
          version_label: formVersion.trim(),
          type: formType || null,
          environment: formEnvironment || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create system");

      setSystems((prev) => [
        {
          ...data.system,
          latest_score: null,
          run_count: 0,
          has_draft: false,
        },
        ...prev,
      ]);
      setFormName("");
      setFormVersion("");
      setFormType("");
      setFormEnvironment("");
      setShowForm(false);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to create system");
    } finally {
      setFormLoading(false);
    }
  }

  return (
    <AuthenticatedShell>
      <div>
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-foreground">TrustSys Assessments</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Assess and monitor AI/system trust stability
          </p>
        </div>

        {/* Create system action */}
        <div className="mb-8">
          {blocked ? (
            <div>
              <span className="inline-flex items-center gap-2 px-4 py-2 bg-gray-300 text-gray-500 font-medium rounded-lg cursor-not-allowed text-sm" aria-disabled="true">
                <PlusIcon />
                Create system assessment
              </span>
              <p className="text-sm text-muted-foreground mt-2">
                Systems assessment is available on Pro plans.{" "}
                <a href="/upgrade" className="text-brand underline hover:text-foreground transition-colors">Upgrade</a>
              </p>
            </div>
          ) : atCap ? (
            <div>
              <span className="inline-flex items-center gap-2 px-4 py-2 bg-gray-300 text-gray-500 font-medium rounded-lg cursor-not-allowed text-sm" aria-disabled="true">
                <PlusIcon />
                Create system assessment
              </span>
              <p className="text-sm text-destructive mt-2">
                You&apos;ve reached your plan limit of {limits.maxSystems} system{limits.maxSystems !== 1 ? "s" : ""}.{" "}
                <a href="/upgrade" className="underline hover:text-foreground transition-colors">Upgrade to continue</a>.
              </p>
            </div>
          ) : showForm ? (
            <form onSubmit={handleCreate} className="border border-border rounded-xl p-4 max-w-md space-y-3">
              <div>
                <label htmlFor="sys-name" className="block text-sm font-medium text-foreground mb-1">System name</label>
                <input id="sys-name" type="text" required value={formName} onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Customer AI Chatbot"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent placeholder:text-muted-foreground/60" />
              </div>
              <div>
                <label htmlFor="sys-version" className="block text-sm font-medium text-foreground mb-1">
                  Version label <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <input id="sys-version" type="text" value={formVersion} onChange={(e) => setFormVersion(e.target.value)}
                  placeholder="e.g. v1.0"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent placeholder:text-muted-foreground/60" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="sys-type" className="block text-sm font-medium text-foreground mb-1">
                    Type <span className="text-muted-foreground font-normal">(optional)</span>
                  </label>
                  <select id="sys-type" value={formType} onChange={(e) => setFormType(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent bg-white">
                    <option value="">Select type</option>
                    <option value="rag_app">RAG app</option>
                    <option value="agent">Agent</option>
                    <option value="classifier">Classifier</option>
                    <option value="workflow">Workflow</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="sys-env" className="block text-sm font-medium text-foreground mb-1">
                    Environment <span className="text-muted-foreground font-normal">(optional)</span>
                  </label>
                  <select id="sys-env" value={formEnvironment} onChange={(e) => setFormEnvironment(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent bg-white">
                    <option value="">Select environment</option>
                    <option value="prod">Production</option>
                    <option value="staging">Staging</option>
                    <option value="pilot">Pilot</option>
                  </select>
                </div>
              </div>
              {formError && <p className="text-sm text-destructive">{formError}</p>}
              <div className="flex items-center gap-2">
                <button type="submit" disabled={formLoading}
                  className="px-4 py-2 bg-brand text-white font-medium rounded-lg hover:bg-brand/90 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                  {formLoading ? "Creating..." : "Create"}
                </button>
                <button type="button" onClick={() => { setShowForm(false); setFormError(null); }}
                  className="px-4 py-2 text-muted-foreground hover:text-foreground transition-colors text-sm">
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div>
              <button type="button" onClick={() => setShowForm(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-brand text-white font-medium rounded-lg hover:bg-brand/90 transition-colors text-sm">
                <PlusIcon />
                Create system assessment
              </button>
              {approachingCap && (
                <p className="text-xs text-muted-foreground mt-2">
                  {systems.length} of {limits.maxSystems} systems used
                </p>
              )}
            </div>
          )}
        </div>

        {/* Systems list */}
        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
            <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
            Loading systems...
          </div>
        )}

        {error && <div className="text-sm text-destructive py-4">{error}</div>}

        {!loading && !error && systems.length === 0 && (
          <div className="border border-border rounded-xl p-8 text-center">
            <div className="text-muted-foreground mb-2">No systems yet</div>
            <p className="text-sm text-muted-foreground mb-4">
              {blocked
                ? "Systems assessment is available on Pro plans."
                : "Create your first system assessment to get started."}
            </p>
            {!blocked && !atCap && (
              <button type="button" onClick={() => setShowForm(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-brand text-white font-medium rounded-lg hover:bg-brand/90 transition-colors text-sm">
                Create system assessment
              </button>
            )}
          </div>
        )}

        {!loading && !error && systems.length > 0 && (
          <div className="border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-border text-left">
                  <th className="px-4 py-3 font-medium text-muted-foreground">System</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Score</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Status</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Runs</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Created</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {systems.map((system) => (
                  <tr key={system.id} className="border-b border-border last:border-0 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{system.name}</div>
                      {system.version_label && (
                        <div className="text-xs text-muted-foreground mt-0.5">{system.version_label}</div>
                      )}
                      <div className="text-xs text-muted-foreground sm:hidden mt-0.5">
                        Score: {system.latest_score !== null ? system.latest_score : "\u2014"} &middot; {system.run_count} run{system.run_count !== 1 ? "s" : ""}
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      {system.latest_score !== null ? (() => {
                        const tier = getTierForScore(system.latest_score);
                        return (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${tier.bgClass} ${tier.colorClass}`}>
                            {system.latest_score}
                          </span>
                        );
                      })() : (
                        <span className="text-muted-foreground">&mdash;</span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {system.latest_score !== null ? (() => {
                        const stability = getStabilityBadge(
                          (system as System & { stability_status?: StabilityStatus }).stability_status || "provisional"
                        );
                        return (
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${stability.className}`}
                            title={stability.tooltip}
                          >
                            {stability.label}
                          </span>
                        );
                      })() : (
                        <span className="text-muted-foreground">&mdash;</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{system.run_count}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                      {new Date(system.created_at).toLocaleDateString("en-GB", {
                        day: "numeric", month: "short", year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/systems/${system.id}/assess`}
                        className="text-xs px-2 py-1 rounded bg-brand text-white hover:bg-brand/90 transition-colors"
                      >
                        {system.has_draft ? "Continue assessment" : "Assess"}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AuthenticatedShell>
  );
}

function PlusIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}
