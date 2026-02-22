"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import AuthenticatedShell from "@/components/AuthenticatedShell";
import RequireAuth from "@/components/RequireAuth";
import { getPlanLimits } from "@/lib/entitlements";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Survey = {
  id: string;
  title: string;
  mode: "explorer" | "org";
  status: string;
  created_at: string;
  respondents: number;
  answers: number;
};

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
// Root page
// ---------------------------------------------------------------------------

export default function DashboardHome() {
  return (
    <RequireAuth>
      <Suspense>
        <DashboardContent />
      </Suspense>
    </RequireAuth>
  );
}

// ---------------------------------------------------------------------------
// Dashboard with tabs
// ---------------------------------------------------------------------------

function DashboardContent() {
  const { user, profile } = useAuth();
  const searchParams = useSearchParams();

  const limits = useMemo(() => getPlanLimits(profile?.plan), [profile?.plan]);
  const activeTab = searchParams.get("tab") === "systems" ? "systems" : "organisation";
  const systemsDisabled = limits.maxSystems === 0;

  function setTab(tab: string) {
    if (tab === "systems" && systemsDisabled) return;
    const url = tab === "systems" ? "/dashboard?tab=systems" : "/dashboard";
    window.location.href = url;
  }

  return (
    <AuthenticatedShell>
      <div>
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-verisum-black">
            Welcome{user?.email ? `, ${user.email.split("@")[0]}` : ""}
          </h1>
          <p className="text-sm text-verisum-grey mt-1">
            Your TrustGraph dashboard
          </p>
        </div>

        {/* Plan badge */}
        {profile && (
          <div className="mb-6 inline-flex items-center gap-2 bg-verisum-blue/10 text-verisum-blue px-3 py-1.5 rounded-full text-sm font-medium capitalize">
            {profile.plan} plan
          </div>
        )}

        {/* Tab bar */}
        <div className="border-b border-border mb-8">
          <nav className="flex gap-6" aria-label="Dashboard tabs">
            <button
              type="button"
              onClick={() => setTab("organisation")}
              className={`pb-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === "organisation"
                  ? "border-verisum-blue text-verisum-blue"
                  : "border-transparent text-verisum-grey hover:text-verisum-black"
              }`}
            >
              TrustOrg
            </button>
            <button
              type="button"
              onClick={() => setTab("systems")}
              disabled={systemsDisabled}
              title={systemsDisabled ? "TrustSys available on Org plan and above." : undefined}
              className={`pb-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                systemsDisabled
                  ? "border-transparent text-verisum-grey opacity-50 cursor-not-allowed"
                  : activeTab === "systems"
                    ? "border-verisum-blue text-verisum-blue"
                    : "border-transparent text-verisum-grey hover:text-verisum-black"
              }`}
            >
              TrustSys
            </button>
          </nav>
        </div>

        {/* Tab content */}
        {activeTab === "organisation" ? (
          <OrganisationTab limits={limits} />
        ) : (
          <SystemsTab limits={limits} />
        )}
      </div>
    </AuthenticatedShell>
  );
}

// ---------------------------------------------------------------------------
// Organisation tab (existing surveys UI)
// ---------------------------------------------------------------------------

function OrganisationTab({ limits }: { limits: ReturnType<typeof getPlanLimits> }) {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSurveys() {
      try {
        const res = await fetch("/api/my-surveys");
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to load surveys");
        }
        const data = await res.json();
        setSurveys(data.surveys || []);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to load surveys";
        setError(message);
      } finally {
        setLoading(false);
      }
    }
    fetchSurveys();
  }, []);

  const atCap = !loading && surveys.length >= limits.maxSurveys;
  const approachingCap =
    !loading && !atCap && isFinite(limits.maxSurveys) && surveys.length === limits.maxSurveys - 1;

  return (
    <div>
      {/* Create survey button */}
      <div className="mb-8">
        {atCap ? (
          <div>
            <span
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-300 text-gray-500 font-medium rounded-lg cursor-not-allowed text-sm"
              aria-disabled="true"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create a new survey
            </span>
            <p className="text-sm text-verisum-red mt-2">
              You&apos;ve reached your plan limit of {limits.maxSurveys} survey{limits.maxSurveys !== 1 ? "s" : ""}.{" "}
              <a href="/upgrade" className="underline hover:text-verisum-black transition-colors">
                Upgrade to continue
              </a>
              .
            </p>
          </div>
        ) : (
          <div>
            <a
              href="/dashboard/surveys/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-verisum-blue text-white font-medium rounded-lg hover:bg-verisum-blue/90 transition-colors text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create a new survey
            </a>
            {approachingCap && (
              <p className="text-xs text-verisum-grey mt-2">
                {surveys.length} of {limits.maxSurveys} surveys used
              </p>
            )}
          </div>
        )}
      </div>

      {/* Surveys list */}
      <h2 className="text-lg font-semibold text-verisum-black mb-4">My surveys</h2>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-verisum-grey py-8">
          <div className="w-4 h-4 border-2 border-verisum-blue border-t-transparent rounded-full animate-spin" />
          Loading surveys…
        </div>
      )}

      {error && <div className="text-sm text-verisum-red py-4">{error}</div>}

      {!loading && !error && surveys.length === 0 && (
        <div className="border border-verisum-grey rounded-xl p-8 text-center">
          <div className="text-verisum-grey mb-2">No surveys yet</div>
          <p className="text-sm text-verisum-grey mb-4">Create your first survey to get started.</p>
          {atCap ? (
            <p className="text-sm text-verisum-red">
              You&apos;ve reached your plan limit.{" "}
              <a href="/upgrade" className="underline hover:text-verisum-black transition-colors">
                Upgrade to continue
              </a>
              .
            </p>
          ) : (
            <a
              href="/dashboard/surveys/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-verisum-blue text-white font-medium rounded-lg hover:bg-verisum-blue/90 transition-colors text-sm"
            >
              Create survey
            </a>
          )}
        </div>
      )}

      {!loading && !error && surveys.length > 0 && (
        <div className="border border-verisum-grey rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-verisum-grey text-left">
                <th className="px-4 py-3 font-medium text-verisum-grey">Survey</th>
                <th className="px-4 py-3 font-medium text-verisum-grey hidden sm:table-cell">Mode</th>
                <th className="px-4 py-3 font-medium text-verisum-grey hidden md:table-cell">Respondents</th>
                <th className="px-4 py-3 font-medium text-verisum-grey hidden md:table-cell">Created</th>
                <th className="px-4 py-3 font-medium text-verisum-grey text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {surveys.map((survey) => (
                <tr key={survey.id} className="border-b border-verisum-grey last:border-0 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-verisum-black">{survey.title}</div>
                    <div className="text-xs text-verisum-grey sm:hidden mt-0.5">
                      {survey.mode === "explorer" ? "Explorer" : "Org"} · {survey.respondents} respondent{survey.respondents !== 1 ? "s" : ""}
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        survey.mode === "explorer"
                          ? "bg-verisum-blue/10 text-verisum-blue"
                          : "bg-verisum-green/10 text-verisum-green"
                      }`}
                    >
                      {survey.mode === "explorer" ? "Explorer" : "Org"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-verisum-grey hidden md:table-cell">{survey.respondents}</td>
                  <td className="px-4 py-3 text-verisum-grey hidden md:table-cell">
                    {new Date(survey.created_at).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <a
                        href={`/dashboard/surveys/${survey.id}`}
                        className="text-xs px-2 py-1 rounded border border-verisum-grey text-verisum-grey hover:text-verisum-black hover:border-verisum-black transition-colors"
                      >
                        Manage
                      </a>
                      <a
                        href={`/dashboard/surveys/${survey.id}/results`}
                        className="text-xs px-2 py-1 rounded bg-verisum-blue text-white hover:bg-verisum-blue/90 transition-colors"
                      >
                        Results
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Systems tab
// ---------------------------------------------------------------------------

function SystemsTab({ limits }: { limits: ReturnType<typeof getPlanLimits> }) {
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
    async function fetchSystems() {
      try {
        const res = await fetch("/api/systems");
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to load systems");
        }
        const data = await res.json();
        setSystems(data.systems || []);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to load systems";
        setError(message);
      } finally {
        setLoading(false);
      }
    }
    fetchSystems();
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

      // Add to local state and close form
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
      const message = err instanceof Error ? err.message : "Failed to create system";
      setFormError(message);
    } finally {
      setFormLoading(false);
    }
  }

  return (
    <div>
      {/* Create system button / form */}
      <div className="mb-8">
        {blocked ? (
          <div>
            <span
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-300 text-gray-500 font-medium rounded-lg cursor-not-allowed text-sm"
              aria-disabled="true"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create system assessment
            </span>
            <p className="text-sm text-verisum-grey mt-2">
              Systems assessment is available on Pro plans.{" "}
              <a href="/upgrade" className="text-verisum-blue underline hover:text-verisum-black transition-colors">
                Upgrade
              </a>
            </p>
          </div>
        ) : atCap ? (
          <div>
            <span
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-300 text-gray-500 font-medium rounded-lg cursor-not-allowed text-sm"
              aria-disabled="true"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create system assessment
            </span>
            <p className="text-sm text-verisum-red mt-2">
              You&apos;ve reached your plan limit of {limits.maxSystems} system{limits.maxSystems !== 1 ? "s" : ""}.{" "}
              <a href="/upgrade" className="underline hover:text-verisum-black transition-colors">
                Upgrade to continue
              </a>
              .
            </p>
          </div>
        ) : showForm ? (
          <form onSubmit={handleCreate} className="border border-verisum-grey rounded-xl p-4 max-w-md space-y-3">
            <div>
              <label htmlFor="sys-name" className="block text-sm font-medium text-verisum-black mb-1">
                System name
              </label>
              <input
                id="sys-name"
                type="text"
                required
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Customer AI Chatbot"
                className="w-full px-3 py-2 border border-verisum-grey rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-verisum-blue focus:border-transparent placeholder:text-verisum-grey/60"
              />
            </div>
            <div>
              <label htmlFor="sys-version" className="block text-sm font-medium text-verisum-black mb-1">
                Version label <span className="text-verisum-grey font-normal">(optional)</span>
              </label>
              <input
                id="sys-version"
                type="text"
                value={formVersion}
                onChange={(e) => setFormVersion(e.target.value)}
                placeholder="e.g. v1.0"
                className="w-full px-3 py-2 border border-verisum-grey rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-verisum-blue focus:border-transparent placeholder:text-verisum-grey/60"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="sys-type" className="block text-sm font-medium text-verisum-black mb-1">
                  Type <span className="text-verisum-grey font-normal">(optional)</span>
                </label>
                <select
                  id="sys-type"
                  value={formType}
                  onChange={(e) => setFormType(e.target.value)}
                  className="w-full px-3 py-2 border border-verisum-grey rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-verisum-blue focus:border-transparent bg-white"
                >
                  <option value="">Select type</option>
                  <option value="rag_app">RAG app</option>
                  <option value="agent">Agent</option>
                  <option value="classifier">Classifier</option>
                  <option value="workflow">Workflow</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label htmlFor="sys-env" className="block text-sm font-medium text-verisum-black mb-1">
                  Environment <span className="text-verisum-grey font-normal">(optional)</span>
                </label>
                <select
                  id="sys-env"
                  value={formEnvironment}
                  onChange={(e) => setFormEnvironment(e.target.value)}
                  className="w-full px-3 py-2 border border-verisum-grey rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-verisum-blue focus:border-transparent bg-white"
                >
                  <option value="">Select environment</option>
                  <option value="prod">Production</option>
                  <option value="staging">Staging</option>
                  <option value="pilot">Pilot</option>
                </select>
              </div>
            </div>
            {formError && <p className="text-sm text-verisum-red">{formError}</p>}
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={formLoading}
                className="px-4 py-2 bg-verisum-blue text-white font-medium rounded-lg hover:bg-verisum-blue/90 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {formLoading ? "Creating…" : "Create"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setFormError(null);
                }}
                className="px-4 py-2 text-verisum-grey hover:text-verisum-black transition-colors text-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div>
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-verisum-blue text-white font-medium rounded-lg hover:bg-verisum-blue/90 transition-colors text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create system assessment
            </button>
            {approachingCap && (
              <p className="text-xs text-verisum-grey mt-2">
                {systems.length} of {limits.maxSystems} systems used
              </p>
            )}
          </div>
        )}
      </div>

      {/* Systems list */}
      <h2 className="text-lg font-semibold text-verisum-black mb-4">My systems</h2>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-verisum-grey py-8">
          <div className="w-4 h-4 border-2 border-verisum-blue border-t-transparent rounded-full animate-spin" />
          Loading systems…
        </div>
      )}

      {error && <div className="text-sm text-verisum-red py-4">{error}</div>}

      {!loading && !error && systems.length === 0 && (
        <div className="border border-verisum-grey rounded-xl p-8 text-center">
          <div className="text-verisum-grey mb-2">No systems yet</div>
          <p className="text-sm text-verisum-grey mb-4">
            {blocked
              ? "Systems assessment is available on Pro plans."
              : "Create your first system assessment to get started."}
          </p>
          {!blocked && !atCap && (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-verisum-blue text-white font-medium rounded-lg hover:bg-verisum-blue/90 transition-colors text-sm"
            >
              Create system assessment
            </button>
          )}
        </div>
      )}

      {!loading && !error && systems.length > 0 && (
        <div className="border border-verisum-grey rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-verisum-grey text-left">
                <th className="px-4 py-3 font-medium text-verisum-grey">System</th>
                <th className="px-4 py-3 font-medium text-verisum-grey hidden sm:table-cell">Score</th>
                <th className="px-4 py-3 font-medium text-verisum-grey hidden md:table-cell">Runs</th>
                <th className="px-4 py-3 font-medium text-verisum-grey hidden md:table-cell">Created</th>
                <th className="px-4 py-3 font-medium text-verisum-grey text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {systems.map((system) => (
                <tr key={system.id} className="border-b border-verisum-grey last:border-0 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-verisum-black">{system.name}</div>
                    {system.version_label && (
                      <div className="text-xs text-verisum-grey mt-0.5">{system.version_label}</div>
                    )}
                    <div className="text-xs text-verisum-grey sm:hidden mt-0.5">
                      Score: {system.latest_score !== null ? system.latest_score : "—"} · {system.run_count} run{system.run_count !== 1 ? "s" : ""}
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    {system.latest_score !== null ? (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-verisum-blue/10 text-verisum-blue">
                        {system.latest_score}
                      </span>
                    ) : (
                      <span className="text-verisum-grey">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-verisum-grey hidden md:table-cell">
                    {system.run_count}
                  </td>
                  <td className="px-4 py-3 text-verisum-grey hidden md:table-cell">
                    {new Date(system.created_at).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <a
                      href={`/systems/${system.id}/assess`}
                      className="text-xs px-2 py-1 rounded bg-verisum-blue text-white hover:bg-verisum-blue/90 transition-colors"
                    >
                      {system.has_draft ? "Continue assessment" : "Assess"}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
