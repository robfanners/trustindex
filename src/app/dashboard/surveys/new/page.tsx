"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import AuthenticatedShell from "@/components/AuthenticatedShell";
import RequireAuth from "@/components/RequireAuth";
import { useAuth } from "@/context/AuthContext";
import { getPlanLimits } from "@/lib/entitlements";

// ---------------------------------------------------------------------------
// Types for org hierarchy
// ---------------------------------------------------------------------------
type Subsidiary = { id: string; name: string };
type OrgFunction = { id: string; name: string; subsidiary_id: string | null; is_project_type: boolean };
type Team = { id: string; name: string; function_id: string; is_adhoc: boolean };

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
  const isOwner = profile?.role === "owner";

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
  const [orgName, setOrgName] = useState(profile?.company_name ?? "");
  const [runTitle, setRunTitle] = useState(
    `TrustOrg Pilot – ${new Date().toISOString().slice(0, 10)}`
  );
  const [mode, setMode] = useState<"explorer" | "org">("explorer");
  const [inviteCount, setInviteCount] = useState<number>(1);

  // Org hierarchy state
  const [subsidiaries, setSubsidiaries] = useState<Subsidiary[]>([]);
  const [functions, setFunctions] = useState<OrgFunction[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedSubIds, setSelectedSubIds] = useState<string[]>([]);
  const [selectedFnIds, setSelectedFnIds] = useState<string[]>([]);
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [subDropdownOpen, setSubDropdownOpen] = useState(false);
  const [fnDropdownOpen, setFnDropdownOpen] = useState(false);
  const [teamDropdownOpen, setTeamDropdownOpen] = useState(false);
  const subRef = useRef<HTMLDivElement>(null);
  const fnRef = useRef<HTMLDivElement>(null);
  const teamRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (subRef.current && !subRef.current.contains(e.target as Node)) setSubDropdownOpen(false);
      if (fnRef.current && !fnRef.current.contains(e.target as Node)) setFnDropdownOpen(false);
      if (teamRef.current && !teamRef.current.contains(e.target as Node)) setTeamDropdownOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Fetch org hierarchy on mount
  const fetchHierarchy = useCallback(async () => {
    try {
      const [subsRes, fnsRes, teamsRes] = await Promise.all([
        fetch("/api/org/subsidiaries"),
        fetch("/api/org/functions"),
        fetch("/api/org/teams"),
      ]);
      if (subsRes.ok) {
        const d = await subsRes.json();
        setSubsidiaries(d.subsidiaries ?? []);
      }
      if (fnsRes.ok) {
        const d = await fnsRes.json();
        setFunctions(d.functions ?? []);
      }
      if (teamsRes.ok) {
        const d = await teamsRes.json();
        setTeams(d.teams ?? []);
      }
    } catch {
      // Non-blocking — hierarchy is optional
    }
  }, []);

  useEffect(() => {
    fetchHierarchy();
  }, [fetchHierarchy]);

  // Pre-fill org name from profile
  useEffect(() => {
    if (profile?.company_name && !orgName) {
      setOrgName(profile.company_name);
    }
  }, [profile?.company_name]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cascade: filter functions when subsidiary selection changes
  const filteredFunctions = useMemo(() => {
    if (selectedSubIds.length === 0) return functions;
    return functions.filter(
      (fn) =>
        fn.is_project_type ||
        fn.subsidiary_id === null ||
        selectedSubIds.includes(fn.subsidiary_id)
    );
  }, [functions, selectedSubIds]);

  // Cascade: filter teams when function selection changes
  const filteredTeams = useMemo(() => {
    if (selectedFnIds.length === 0) return teams;
    return teams.filter((t) => selectedFnIds.includes(t.function_id));
  }, [teams, selectedFnIds]);

  // Clear downstream selections when upstream changes
  useEffect(() => {
    const validFnIds = filteredFunctions.map((f) => f.id);
    setSelectedFnIds((prev) => prev.filter((id) => validFnIds.includes(id)));
  }, [filteredFunctions]);

  useEffect(() => {
    const validTeamIds = filteredTeams.map((t) => t.id);
    setSelectedTeamIds((prev) => prev.filter((id) => validTeamIds.includes(id)));
  }, [filteredTeams]);

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

  // Build scope array from selections
  function buildScope() {
    const scope: Array<{ subsidiaryId?: string; functionId?: string; teamId?: string }> = [];
    if (selectedTeamIds.length > 0) {
      for (const tid of selectedTeamIds) {
        const team = teams.find((t) => t.id === tid);
        const fn = team ? functions.find((f) => f.id === team.function_id) : undefined;
        scope.push({
          teamId: tid,
          functionId: team?.function_id,
          subsidiaryId: fn?.subsidiary_id ?? undefined,
        });
      }
    } else if (selectedFnIds.length > 0) {
      for (const fid of selectedFnIds) {
        const fn = functions.find((f) => f.id === fid);
        scope.push({
          functionId: fid,
          subsidiaryId: fn?.subsidiary_id ?? undefined,
        });
      }
    } else if (selectedSubIds.length > 0) {
      for (const sid of selectedSubIds) {
        scope.push({ subsidiaryId: sid });
      }
    }
    return scope;
  }

  const createRun = async () => {
    setLoading(true);
    setError(null);
    setErrorCode(null);
    setResult(null);

    try {
      const scope = buildScope();
      const body = {
        orgName,
        runTitle,
        mode,
        inviteCount,
        scope: scope.length > 0 ? scope : undefined,
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

  // Toggle helper for multi-select
  function toggleSelection(id: string, selected: string[], setter: (v: string[]) => void) {
    setter(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }

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
        {/* Survey name */}
        <div className="space-y-1">
          <label className="text-sm font-semibold flex items-center gap-1.5">
            Survey name
            <span className="text-muted-foreground cursor-help" title="A descriptive name for this survey run">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
          </label>
          <input
            className="w-full border border-border rounded px-3 py-2 text-sm"
            value={runTitle}
            onChange={(e) => setRunTitle(e.target.value)}
          />
        </div>

        {/* Organisation name */}
        <div className="space-y-1">
          <label className="text-sm font-semibold">Organisation name</label>
          <input
            className="w-full border border-border rounded px-3 py-2 text-sm"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            placeholder="Your company name"
            readOnly={!!profile?.company_name}
          />
          {profile?.company_name && (
            <div className="text-xs text-muted-foreground">
              Pre-filled from your profile. Change in Settings if needed.
            </div>
          )}
        </div>

        {/* Subsidiary multi-select */}
        <div className="space-y-1">
          <label className="text-sm font-semibold">Subsidiary</label>
          <div className="relative" ref={subRef}>
            <button
              type="button"
              onClick={() => setSubDropdownOpen(!subDropdownOpen)}
              className="w-full border border-border rounded px-3 py-2 text-sm text-left flex items-center justify-between bg-background"
            >
              <span className={selectedSubIds.length === 0 ? "text-muted-foreground" : ""}>
                {selectedSubIds.length === 0
                  ? "N/A (all subsidiaries)"
                  : `${selectedSubIds.length} selected`}
              </span>
              <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {subDropdownOpen && (
              <div className="absolute z-20 mt-1 w-full bg-background border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {subsidiaries.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    No subsidiaries defined.{" "}
                    {isOwner && (
                      <a href="/dashboard/settings/organisation" className="text-brand underline">
                        Add in Settings
                      </a>
                    )}
                  </div>
                ) : (
                  subsidiaries.map((s) => (
                    <label key={s.id} className="flex items-center gap-2 px-3 py-2 hover:bg-muted/50 cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        checked={selectedSubIds.includes(s.id)}
                        onChange={() => toggleSelection(s.id, selectedSubIds, setSelectedSubIds)}
                        className="rounded border-border"
                      />
                      {s.name}
                    </label>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Function multi-select */}
        <div className="space-y-1">
          <label className="text-sm font-semibold">Function</label>
          <div className="relative" ref={fnRef}>
            <button
              type="button"
              onClick={() => setFnDropdownOpen(!fnDropdownOpen)}
              className="w-full border border-border rounded px-3 py-2 text-sm text-left flex items-center justify-between bg-background"
            >
              <span className={selectedFnIds.length === 0 ? "text-muted-foreground" : ""}>
                {selectedFnIds.length === 0
                  ? "All functions"
                  : `${selectedFnIds.length} selected`}
              </span>
              <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {fnDropdownOpen && (
              <div className="absolute z-20 mt-1 w-full bg-background border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {filteredFunctions.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    No functions defined.{" "}
                    {isOwner && (
                      <a href="/dashboard/settings/organisation" className="text-brand underline">
                        Add in Settings
                      </a>
                    )}
                  </div>
                ) : (
                  filteredFunctions.map((fn) => (
                    <label key={fn.id} className="flex items-center gap-2 px-3 py-2 hover:bg-muted/50 cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        checked={selectedFnIds.includes(fn.id)}
                        onChange={() => toggleSelection(fn.id, selectedFnIds, setSelectedFnIds)}
                        className="rounded border-border"
                      />
                      {fn.name}
                      {fn.is_project_type && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-brand/10 text-brand font-medium">
                          Default
                        </span>
                      )}
                    </label>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Team multi-select */}
        <div className="space-y-1">
          <label className="text-sm font-semibold">Team</label>
          <div className="relative" ref={teamRef}>
            <button
              type="button"
              onClick={() => setTeamDropdownOpen(!teamDropdownOpen)}
              className="w-full border border-border rounded px-3 py-2 text-sm text-left flex items-center justify-between bg-background"
            >
              <span className={selectedTeamIds.length === 0 ? "text-muted-foreground" : ""}>
                {selectedTeamIds.length === 0
                  ? "All teams"
                  : `${selectedTeamIds.length} selected`}
              </span>
              <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {teamDropdownOpen && (
              <div className="absolute z-20 mt-1 w-full bg-background border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {filteredTeams.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    No teams defined.{" "}
                    {isOwner && (
                      <a href="/dashboard/settings/organisation" className="text-brand underline">
                        Add in Settings
                      </a>
                    )}
                  </div>
                ) : (
                  filteredTeams.map((t) => (
                    <label key={t.id} className="flex items-center gap-2 px-3 py-2 hover:bg-muted/50 cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        checked={selectedTeamIds.includes(t.id)}
                        onChange={() => toggleSelection(t.id, selectedTeamIds, setSelectedTeamIds)}
                        className="rounded border-border"
                      />
                      {t.name}
                      {t.is_adhoc && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 font-medium">
                          Ad-hoc
                        </span>
                      )}
                    </label>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Survey type */}
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

        {/* Invite count */}
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

        <button
          onClick={createRun}
          disabled={loading || !orgName.trim() || !runTitle.trim()}
          className="px-5 py-3 rounded bg-brand text-white font-semibold hover:bg-brand-hover disabled:opacity-50"
        >
          {loading ? "Creating\u2026" : "Create survey"}
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
