"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import AuthenticatedShell from "@/components/AuthenticatedShell";
import RequireAuth from "@/components/RequireAuth";
import { getPlanLimits } from "@/lib/entitlements";

type Survey = {
  id: string;
  title: string;
  mode: "explorer" | "org";
  status: string;
  created_at: string;
  respondents: number;
  answers: number;
};

export default function DashboardHome() {
  return (
    <RequireAuth>
      <DashboardContent />
    </RequireAuth>
  );
}

function DashboardContent() {
  const { user, profile } = useAuth();
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [surveysLoading, setSurveysLoading] = useState(true);
  const [surveysError, setSurveysError] = useState<string | null>(null);

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
        setSurveysError(message);
      } finally {
        setSurveysLoading(false);
      }
    }
    fetchSurveys();
  }, []);

  // Plan cap awareness
  const limits = useMemo(() => getPlanLimits(profile?.plan), [profile?.plan]);
  const atCap = !surveysLoading && surveys.length >= limits.maxSurveys;
  const approachingCap =
    !surveysLoading &&
    !atCap &&
    isFinite(limits.maxSurveys) &&
    surveys.length === limits.maxSurveys - 1;

  return (
    <AuthenticatedShell>
      <div>
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-verisum-black">
            Welcome{user?.email ? `, ${user.email.split("@")[0]}` : ""}
          </h1>
          <p className="text-sm text-verisum-grey mt-1">
            Your TrustIndex dashboard
          </p>
        </div>

        {/* Plan badge */}
        {profile && (
          <div className="mb-8 inline-flex items-center gap-2 bg-verisum-blue/10 text-verisum-blue px-3 py-1.5 rounded-full text-sm font-medium capitalize">
            {profile.plan} plan
          </div>
        )}

        {/* Create survey card */}
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
                href="/admin/new-run"
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

        {/* My Surveys */}
        <div>
          <h2 className="text-lg font-semibold text-verisum-black mb-4">My surveys</h2>

          {surveysLoading && (
            <div className="flex items-center gap-2 text-sm text-verisum-grey py-8">
              <div className="w-4 h-4 border-2 border-verisum-blue border-t-transparent rounded-full animate-spin" />
              Loading surveys…
            </div>
          )}

          {surveysError && (
            <div className="text-sm text-verisum-red py-4">{surveysError}</div>
          )}

          {!surveysLoading && !surveysError && surveys.length === 0 && (
            <div className="border border-verisum-grey rounded-xl p-8 text-center">
              <div className="text-verisum-grey mb-2">No surveys yet</div>
              <p className="text-sm text-verisum-grey mb-4">
                Create your first survey to get started.
              </p>
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
                  href="/admin/new-run"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-verisum-blue text-white font-medium rounded-lg hover:bg-verisum-blue/90 transition-colors text-sm"
                >
                  Create survey
                </a>
              )}
            </div>
          )}

          {!surveysLoading && !surveysError && surveys.length > 0 && (
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
                      <td className="px-4 py-3 text-verisum-grey hidden md:table-cell">
                        {survey.respondents}
                      </td>
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
                            href={`/admin/run/${survey.id}`}
                            className="text-xs px-2 py-1 rounded border border-verisum-grey text-verisum-grey hover:text-verisum-black hover:border-verisum-black transition-colors"
                          >
                            Manage
                          </a>
                          <a
                            href={`/dashboard/${survey.id}`}
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
      </div>
    </AuthenticatedShell>
  );
}
