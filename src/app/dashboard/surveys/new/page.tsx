"use client";

import { useEffect, useMemo, useState } from "react";
import AuthenticatedShell from "@/components/AuthenticatedShell";
import RequireAuth from "@/components/RequireAuth";
import { useAuth } from "@/context/AuthContext";
import { getPlanLimits } from "@/lib/entitlements";

// ---------------------------------------------------------------------------
// /dashboard/surveys/new — create a new survey (authenticated)
// ---------------------------------------------------------------------------

type Result = {
  runId: string;
  mode: "explorer" | "org";
  surveyLinks: string[];
  dashboardLink: string;
  tokens: string[];
};

export default function NewSurveyPage() {
  return (
    <RequireAuth>
      <AuthenticatedShell>
        <NewSurveyForm />
      </AuthenticatedShell>
    </RequireAuth>
  );
}

function NewSurveyForm() {
  const { profile } = useAuth();
  const limits = useMemo(() => getPlanLimits(profile?.plan), [profile?.plan]);

  // Fetch survey count to check plan cap
  const [surveyCount, setSurveyCount] = useState<number | null>(null);
  const [countLoading, setCountLoading] = useState(true);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/my-surveys")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setSurveyCount((data.surveys || []).length);
      })
      .finally(() => setCountLoading(false));
  }, []);

  const atCap = surveyCount !== null && surveyCount >= limits.maxSurveys;

  const MIN_ORG_RESPONDENTS = 5;
  const [orgName, setOrgName] = useState("");
  const [runTitle, setRunTitle] = useState(
    `TrustOrg Pilot – ${new Date().toISOString().slice(0, 10)}`
  );
  const [mode, setMode] = useState<"explorer" | "org">("explorer");
  const [inviteCount, setInviteCount] = useState<number>(1);
  const [team, setTeam] = useState("");
  const [level, setLevel] = useState("");
  const [location, setLocation] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function copyText(label: string, text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  }

  const onModeChange = (m: "explorer" | "org") => {
    setMode(m);
    if (m === "explorer") {
      setInviteCount(1);
    } else {
      setInviteCount(Math.max(MIN_ORG_RESPONDENTS, inviteCount || 10));
    }
  };

  const createRun = async () => {
    setLoading(true);
    setError(null);
    setErrorCode(null);
    setResult(null);

    try {
      const body = {
        orgName,
        runTitle,
        mode,
        inviteCount,
        team: team.trim() || undefined,
        level: level.trim() || undefined,
        location: location.trim() || undefined,
      };

      const res = await fetch("/api/create-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json?.error || "Failed to create survey");
        if (json?.code) setErrorCode(json.code);
        setLoading(false);
        return;
      }

      setResult(json as Result);
      setLoading(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setError(msg);
      setLoading(false);
    }
  };

  // After creation, show success with links
  if (result) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-foreground">
          Survey created
        </h1>

        <div className="border border-border rounded-lg p-6 space-y-4">
          <div className="text-sm text-muted-foreground">
            Survey type:{" "}
            {result.mode === "org" ? "Organisational" : "Explorer (self-assessment)"}
          </div>

          <div className="flex flex-wrap gap-2">
            <a
              className="px-5 py-3 rounded bg-brand text-white font-semibold hover:bg-brand-hover inline-block"
              href={`/dashboard/surveys/${result.runId}`}
            >
              Open Survey Dashboard
            </a>
            <a
              className="px-5 py-3 rounded border border-border hover:bg-gray-50 inline-block text-sm"
              href={`/dashboard/surveys/${result.runId}/results`}
            >
              View Results
            </a>
          </div>
        </div>

        {result.mode === "explorer" ? (
          <div className="border border-border rounded-lg p-6 space-y-4">
            <h2 className="text-lg font-semibold">
              Take your self-assessment
            </h2>
            <a
              className="px-3 py-2 border border-border rounded hover:bg-gray-50 text-sm inline-block"
              href={result.surveyLinks[0]}
            >
              Open your survey
            </a>
            <div className="text-xs text-muted-foreground">
              This link is for you only.
            </div>
          </div>
        ) : (
          <div className="border border-border rounded-lg p-6 space-y-4">
            <h2 className="text-lg font-semibold">Share this survey</h2>
            <div className="text-sm text-muted-foreground">
              Copy links and send one per person.
            </div>
            <button
              className="px-3 py-2 border border-border rounded hover:bg-gray-50 text-sm"
              onClick={() =>
                copyText(
                  "All survey links copied",
                  result.surveyLinks
                    .map((p) => `${window.location.origin}${p}`)
                    .join("\n")
                )
              }
            >
              Copy all survey links
            </button>
            {copied && (
              <div className="text-sm text-success">{copied}</div>
            )}
            <div className="text-xs text-muted-foreground">
              Tip: paste the links into email/Slack/Teams. For organisational
              mode, do not reuse the same link for multiple people.
            </div>
          </div>
        )}

        <a
          className="text-sm text-brand underline"
          href="/dashboard/surveys/new"
          onClick={(e) => {
            e.preventDefault();
            setResult(null);
            setOrgName("");
            setRunTitle(
              `TrustOrg Pilot – ${new Date().toISOString().slice(0, 10)}`
            );
            setMode("explorer");
            setInviteCount(1);
          }}
        >
          Create another survey
        </a>
      </div>
    );
  }

  // Loading state while checking plan limits
  if (countLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-foreground">
          Create a TrustOrg survey
        </h1>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Checking plan limits…
        </div>
      </div>
    );
  }

  // At plan cap — show upgrade banner instead of form
  if (atCap) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-foreground">
          Create a TrustOrg survey
        </h1>
        <div className="border border-destructive/30 bg-red-50 rounded-lg p-6 space-y-4">
          <div className="flex items-center gap-3">
            <svg className="w-6 h-6 text-destructive flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="font-semibold text-foreground">Plan limit reached</p>
              <p className="text-sm text-muted-foreground mt-1">
                You&apos;ve used {surveyCount} of {limits.maxSurveys} survey{limits.maxSurveys !== 1 ? "s" : ""} on your{" "}
                <span className="font-medium">{profile?.plan ?? "explorer"}</span> plan.
                Upgrade to create more surveys.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/upgrade"
              className="px-5 py-3 rounded bg-brand text-white font-semibold hover:bg-brand-hover inline-block text-sm"
            >
              Upgrade your plan
            </a>
            <a
              href="/dashboard"
              className="text-sm text-brand underline hover:text-foreground transition-colors"
            >
              Back to dashboard
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">
          Create a TrustOrg survey
        </h1>
        <p className="text-sm text-muted-foreground">
          Explorer mode is a private self-assessment (results show immediately).
          Organisational mode is a multi-respondent survey (results show once 5+
          people respond).
        </p>
      </header>

      {/* Plan usage info */}
      {limits.maxSurveys !== Infinity && surveyCount !== null && (
        <div className="text-xs text-muted-foreground">
          You have used {surveyCount} of {limits.maxSurveys} survey{limits.maxSurveys !== 1 ? "s" : ""} on your{" "}
          {profile?.plan ?? "explorer"} plan.
        </div>
      )}

      <div className="border border-border rounded-lg p-6 space-y-4">
        <div className="space-y-1">
          <label className="text-sm font-semibold">Organisation name</label>
          <input
            className="w-full border border-border rounded px-3 py-2 text-sm"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            placeholder="Your company name"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-semibold">Survey name</label>
          <input
            className="w-full border border-border rounded px-3 py-2 text-sm"
            value={runTitle}
            onChange={(e) => setRunTitle(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-semibold">Survey type</label>
          <select
            className="w-full border border-border rounded px-3 py-2 text-sm"
            value={mode}
            onChange={(e) => onModeChange(e.target.value as "explorer" | "org")}
          >
            <option value="explorer">Explorer (self-assessment)</option>
            <option value="org">Organisational (survey)</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-semibold">Invite count</label>
          <input
            className="w-full border border-border rounded px-3 py-2 text-sm"
            type="number"
            min={mode === "explorer" ? 1 : MIN_ORG_RESPONDENTS}
            max={500}
            value={inviteCount}
            disabled={mode === "explorer"}
            onChange={(e) => setInviteCount(Number(e.target.value))}
          />
          <div className="text-xs text-muted-foreground">
            {mode === "explorer"
              ? "Explorer mode creates exactly 1 link for you to complete yourself."
              : `Organisational mode requires at least ${MIN_ORG_RESPONDENTS} respondents.`}
          </div>
        </div>

        <details className="border border-border rounded p-4">
          <summary className="cursor-pointer font-semibold text-sm">
            Optional segmentation
          </summary>
          <div className="mt-3 space-y-3">
            <input
              className="w-full border border-border rounded px-3 py-2 text-sm"
              placeholder="Team (e.g. Engineering)"
              value={team}
              onChange={(e) => setTeam(e.target.value)}
            />
            <input
              className="w-full border border-border rounded px-3 py-2 text-sm"
              placeholder="Level (e.g. IC / Manager / Exec)"
              value={level}
              onChange={(e) => setLevel(e.target.value)}
            />
            <input
              className="w-full border border-border rounded px-3 py-2 text-sm"
              placeholder="Location (e.g. London)"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
        </details>

        <button
          onClick={createRun}
          disabled={loading || !orgName.trim() || !runTitle.trim()}
          className="px-5 py-3 rounded bg-brand text-white font-semibold hover:bg-brand-hover disabled:opacity-50"
        >
          {loading ? "Creating…" : "Create survey"}
        </button>

        {error && (
          <div className="text-destructive text-sm">
            {error}
            {errorCode === "PLAN_CAP_REACHED" && (
              <>
                {" "}
                <a href="/upgrade" className="underline hover:text-foreground transition-colors">
                  Upgrade your plan
                </a>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
