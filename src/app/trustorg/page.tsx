"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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

// ---------------------------------------------------------------------------
// TrustOrg Surveys — full list page
// ---------------------------------------------------------------------------

export default function TrustOrgPage() {
  return (
    <RequireAuth>
      <TrustOrgContent />
    </RequireAuth>
  );
}

function TrustOrgContent() {
  const { profile } = useAuth();
  const limits = useMemo(() => getPlanLimits(profile?.plan), [profile?.plan]);

  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/my-surveys");
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error || "Failed to load surveys");
        }
        const d = await res.json();
        setSurveys(d.surveys || []);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load surveys");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const atCap = !loading && surveys.length >= limits.maxSurveys;
  const approachingCap =
    !loading && !atCap && isFinite(limits.maxSurveys) && surveys.length === limits.maxSurveys - 1;

  return (
    <AuthenticatedShell>
      <div>
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-foreground">TrustOrg Surveys</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Measure and track organisational trust readiness
          </p>
        </div>

        {/* Create survey action */}
        <div className="mb-8">
          {atCap ? (
            <div>
              <span
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-300 text-gray-500 font-medium rounded-lg cursor-not-allowed text-sm"
                aria-disabled="true"
              >
                <PlusIcon />
                Create a new survey
              </span>
              <p className="text-sm text-destructive mt-2">
                You&apos;ve reached your plan limit of {limits.maxSurveys} survey{limits.maxSurveys !== 1 ? "s" : ""}.{" "}
                <a href="/upgrade" className="underline hover:text-foreground transition-colors">
                  Upgrade to continue
                </a>.
              </p>
            </div>
          ) : (
            <div>
              <Link
                href="/trustorg/new"
                className="inline-flex items-center gap-2 px-4 py-2 bg-brand text-white font-medium rounded-lg hover:bg-brand/90 transition-colors text-sm"
              >
                <PlusIcon />
                Create a new survey
              </Link>
              {approachingCap && (
                <p className="text-xs text-muted-foreground mt-2">
                  {surveys.length} of {limits.maxSurveys} surveys used
                </p>
              )}
            </div>
          )}
        </div>

        {/* Survey list */}
        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
            <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
            Loading surveys...
          </div>
        )}

        {error && <div className="text-sm text-destructive py-4">{error}</div>}

        {!loading && !error && surveys.length === 0 && (
          <div className="border border-border rounded-xl p-8 text-center">
            <div className="text-muted-foreground mb-2">No surveys yet</div>
            <p className="text-sm text-muted-foreground mb-4">Create your first survey to get started.</p>
            {!atCap && (
              <Link
                href="/trustorg/new"
                className="inline-flex items-center gap-2 px-4 py-2 bg-brand text-white font-medium rounded-lg hover:bg-brand/90 transition-colors text-sm"
              >
                Create survey
              </Link>
            )}
          </div>
        )}

        {!loading && !error && surveys.length > 0 && (
          <div className="border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-border text-left">
                  <th className="px-4 py-3 font-medium text-muted-foreground">Survey</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Mode</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Respondents</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Created</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {surveys.map((survey) => (
                  <tr key={survey.id} className="border-b border-border last:border-0 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{survey.title}</div>
                      <div className="text-xs text-muted-foreground sm:hidden mt-0.5">
                        {survey.mode === "explorer" ? "Explorer" : "Org"} &middot; {survey.respondents} respondent{survey.respondents !== 1 ? "s" : ""}
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        survey.mode === "explorer"
                          ? "bg-brand/10 text-brand"
                          : "bg-success/10 text-success"
                      }`}>
                        {survey.mode === "explorer" ? "Explorer" : "Org"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{survey.respondents}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                      {new Date(survey.created_at).toLocaleDateString("en-GB", {
                        day: "numeric", month: "short", year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/dashboard/surveys/${survey.id}`}
                          className="text-xs px-2 py-1 rounded border border-border text-muted-foreground hover:text-foreground hover:border-foreground transition-colors"
                        >
                          Manage
                        </Link>
                        <Link
                          href={`/dashboard/surveys/${survey.id}/results`}
                          className="text-xs px-2 py-1 rounded bg-brand text-white hover:bg-brand/90 transition-colors"
                        >
                          Results
                        </Link>
                      </div>
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
