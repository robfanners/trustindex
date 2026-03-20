"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import Link from "next/link";
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

  // Note: fetchHierarchy calls setState, but this is necessary for initialization
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchHierarchy();
  }, [fetchHierarchy]);

  // Pre-fill org name from profile
  useEffect(() => {
    if (profile?.company_name && !orgName) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOrgName(profile.company_name);
    }
  }, [profile?.company_name, orgName]);

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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedFnIds((prev) => prev.filter((id) => validFnIds.includes(id)));
  }, [filteredFunctions, setSelectedFnIds]);

  useEffect(() => {
    const validTeamIds = filteredTeams.map((t) => t.id);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedTeamIds((prev) => prev.filter((id) => validTeamIds.includes(id)));
  }, [filteredTeams, setSelectedTeamIds]);

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
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Survey created</h1>
            <p className="text-sm text-muted-foreground">
              {result.mode === "org" ? "Organisational survey" : "Explorer self-assessment"} is ready
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <a
            href={`/dashboard/surveys/${result.runId}`}
            className="flex items-center gap-3 p-4 rounded-xl border border-brand/20 bg-brand/5 hover:bg-brand/10 transition-colors group"
          >
            <div className="w-10 h-10 rounded-lg bg-brand/10 flex items-center justify-center group-hover:bg-brand/20 transition-colors">
              <svg className="w-5 h-5 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <div className="font-medium text-brand">Manage Survey</div>
              <div className="text-xs text-muted-foreground">Track responses & share links</div>
            </div>
          </a>
          <a
            href={`/dashboard/surveys/${result.runId}/results`}
            className="flex items-center gap-3 p-4 rounded-xl border border-border hover:bg-muted/50 transition-colors group"
          >
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center group-hover:bg-muted/80 transition-colors">
              <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <div className="font-medium text-foreground">View Results</div>
              <div className="text-xs text-muted-foreground">Scores, dimensions & insights</div>
            </div>
          </a>
        </div>

        {result.mode === "explorer" ? (
          <div className="border border-border rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
              </svg>
              <h2 className="text-lg font-semibold">Take your self-assessment</h2>
            </div>
            <a
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand/90 transition-colors"
              href={result.surveyLinks[0]}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Open your survey
            </a>
            <p className="text-xs text-muted-foreground">
              This link is for you only. Your results will appear immediately after completion.
            </p>
          </div>
        ) : (
          <div className="border border-border rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              <h2 className="text-lg font-semibold">Share this survey</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Copy links and send one per person. Results will appear once 5+ people respond.
            </p>
            <button
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand/90 transition-colors"
              onClick={() =>
                copyText(
                  "All survey links copied",
                  result.surveyLinks
                    .map((p) => `${window.location.origin}${p}`)
                    .join("\n")
                )
              }
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
              Copy all survey links
            </button>
            {copied && (
              <div className="flex items-center gap-1.5 text-sm text-green-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {copied}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Tip: paste the links into email, Slack, or Teams. For organisational mode, do not reuse the same link for multiple people.
            </p>
          </div>
        )}

        <button
          className="inline-flex items-center gap-1.5 text-sm text-brand hover:text-brand/80 transition-colors"
          onClick={() => {
            setResult(null);
            setOrgName("");
            setRunTitle(
              `TrustOrg Pilot – ${new Date().toISOString().slice(0, 10)}`
            );
            setMode("explorer");
            setInviteCount(1);
          }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create another survey
        </button>
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
            <Link
              href="/dashboard"
              className="text-sm text-brand underline hover:text-foreground transition-colors"
            >
              Back to dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page header */}
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-brand/10 flex items-center justify-center">
            <svg className="w-5 h-5 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Create a TrustOrg Survey</h1>
            <p className="text-sm text-muted-foreground">
              Measure organisational trust with a structured assessment
            </p>
          </div>
        </div>
        {limits.maxSurveys !== Infinity && surveyCount !== null && (
          <div className="ml-[52px] text-xs text-muted-foreground">
            {surveyCount} of {limits.maxSurveys} survey{limits.maxSurveys !== 1 ? "s" : ""} used on your{" "}
            <span className="font-medium">{profile?.plan ?? "explorer"}</span> plan
          </div>
        )}
      </header>

      {/* Step 1: Survey type — visual card selection */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          1. Choose survey type
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => onModeChange("explorer")}
            className={`relative p-5 rounded-xl border-2 text-left transition-all ${
              mode === "explorer"
                ? "border-brand bg-brand/5 shadow-sm"
                : "border-border hover:border-muted-foreground/30 hover:bg-muted/30"
            }`}
          >
            {mode === "explorer" && (
              <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-brand flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
            <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div className="font-semibold text-foreground">Explorer</div>
            <p className="text-xs text-muted-foreground mt-1">
              Private self-assessment. Results show immediately after you complete it.
            </p>
          </button>
          <button
            type="button"
            onClick={() => onModeChange("org")}
            className={`relative p-5 rounded-xl border-2 text-left transition-all ${
              mode === "org"
                ? "border-brand bg-brand/5 shadow-sm"
                : "border-border hover:border-muted-foreground/30 hover:bg-muted/30"
            }`}
          >
            {mode === "org" && (
              <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-brand flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
            <div className="w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div className="font-semibold text-foreground">Organisational</div>
            <p className="text-xs text-muted-foreground mt-1">
              Multi-respondent survey. Results appear once 5+ people respond.
            </p>
          </button>
        </div>
      </section>

      {/* Step 2: Survey details */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          2. Survey details
        </h2>
        <div className="border border-border rounded-xl p-6 space-y-5">
          {/* Survey name */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Survey name</label>
            <input
              className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-colors"
              value={runTitle}
              onChange={(e) => setRunTitle(e.target.value)}
              placeholder="e.g. Q1 2026 Trust Assessment"
            />
          </div>

          {/* Organisation name */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Organisation name</label>
            <input
              className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-colors"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="Your company name"
              readOnly={!!profile?.company_name}
            />
            {profile?.company_name && (
              <p className="text-xs text-muted-foreground">
                Pre-filled from your profile. Change in{" "}
                <Link href="/dashboard/settings" className="text-brand hover:underline">Settings</Link> if needed.
              </p>
            )}
          </div>

          {/* Invite count (for org mode) */}
          {mode === "org" && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Number of respondents</label>
              <input
                className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-colors"
                type="number"
                min={MIN_ORG_RESPONDENTS}
                max={500}
                value={inviteCount}
                onChange={(e) => setInviteCount(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                Minimum {MIN_ORG_RESPONDENTS} respondents required for organisational surveys.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Step 3: Scope (optional) */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            3. Scope
          </h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">Optional</span>
        </div>
        <div className="border border-border rounded-xl p-6 space-y-5">
          <p className="text-xs text-muted-foreground">
            Narrow the survey to specific parts of your organisation. Leave empty to cover the whole organisation.
          </p>

          {/* Subsidiary multi-select */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Subsidiary</label>
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
                      <Link href="/dashboard/settings/organisation" className="text-brand underline">
                        Add in Settings
                      </Link>
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
          <label className="text-sm font-medium text-foreground">Function</label>
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
                      <Link href="/dashboard/settings/organisation" className="text-brand underline">
                        Add in Settings
                      </Link>
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
          <label className="text-sm font-medium text-foreground">Team</label>
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
                      <Link href="/dashboard/settings/organisation" className="text-brand underline">
                        Add in Settings
                      </Link>
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

        </div>
      </section>

      {/* Create button */}
      <div className="space-y-3">
        <button
          onClick={createRun}
          disabled={loading || !orgName.trim() || !runTitle.trim()}
          className="w-full sm:w-auto px-6 py-3 rounded-lg bg-brand text-white font-semibold hover:bg-brand/90 disabled:opacity-50 transition-colors inline-flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Creating...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create survey
            </>
          )}
        </button>

        {error && (
          <div className="flex items-center gap-2 text-destructive text-sm">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
            {errorCode === "PLAN_CAP_REACHED" && (
              <>
                {" "}
                <Link href="/upgrade" className="underline hover:text-foreground transition-colors">
                  Upgrade your plan
                </Link>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
