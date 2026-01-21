"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Result = {
  runId: string;
  mode: "explorer" | "org";
  surveyLinks: string[];
  dashboardLink: string;
  tokens: string[];
  ownerToken: string;
};

type RecentRun = {
  runId: string;
  title: string;
  mode: "explorer" | "org";
  createdAtISO: string;
};

function randomToken(length = 32) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < length; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export default function NewRunPage() {
  const MIN_ORG_RESPONDENTS = 5;
  const [orgName, setOrgName] = useState("Verisum (Demo)");
  const [runTitle, setRunTitle] = useState(`TrustIndex Pilot - ${new Date().toISOString().slice(0, 10)}`);
  const [mode, setMode] = useState<"explorer" | "org">("explorer");
  const [inviteCount, setInviteCount] = useState<number>(1);

  const [team, setTeam] = useState("");
  const [level, setLevel] = useState("");
  const [location, setLocation] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [recentRuns, setRecentRuns] = useState<RecentRun[]>([]);

const [copied, setCopied] = useState<string | null>(null);

async function copyText(label: string, text: string) {
  await navigator.clipboard.writeText(text);
  setCopied(label);
  setTimeout(() => setCopied(null), 1500);
}

  useEffect(() => {
    try {
      const raw = localStorage.getItem("trustindex_recent_runs");
      const parsed = raw ? (JSON.parse(raw) as RecentRun[]) : [];
      setRecentRuns(Array.isArray(parsed) ? parsed : []);
    } catch {
      setRecentRuns([]);
    }
  }, []);

  useEffect(() => {
    if (!result) return;
    try {
      const raw = localStorage.getItem("trustindex_recent_runs");
      const parsed = raw ? (JSON.parse(raw) as RecentRun[]) : [];
      const existing = Array.isArray(parsed) ? parsed : [];
      const entry: RecentRun = {
        runId: result.runId,
        title: runTitle,
        mode: result.mode,
        createdAtISO: new Date().toISOString(),
      };
      const next = [entry, ...existing.filter((r) => r.runId !== result.runId)].slice(0, 10);
      localStorage.setItem("trustindex_recent_runs", JSON.stringify(next));
      setRecentRuns(next);
    } catch {
      // Ignore localStorage errors to avoid breaking the flow.
    }
  }, [result, runTitle]);

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

      const res = await fetch("/api/bootstrap-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json?.error || "Failed to create survey");
        setLoading(false);
        return;
      }

      const ownerToken = randomToken(32);
      // TODO: ensure run_admin_tokens table exists with run_id/token columns.
      const { error: ownerErr } = await supabase
        .from("run_admin_tokens")
        .insert({ run_id: json.runId, token: ownerToken });

      if (ownerErr) {
        setError(ownerErr.message || "Failed to create admin token");
        setLoading(false);
        return;
      }

      setResult({ ...(json as Result), ownerToken });
      setLoading(false);
    } catch (e: any) {
      setError(e?.message || "Unknown error");
      setLoading(false);
    }
  };

  return (
    <main className="max-w-3xl mx-auto p-10 space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">Create TrustIndex Survey</h1>
        <p className="text-gray-600">
	Explorer mode is a private self-assessment (results show immediately). Organisational mode is a multi-respondent survey (results show once 5+ people respond).
        </p>
      </header>

      {recentRuns.length > 0 && (
        <div className="border rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold">Recent surveys</h2>
            <button
              className="text-xs text-gray-500 underline"
              onClick={() => {
                localStorage.removeItem("trustindex_recent_runs");
                setRecentRuns([]);
              }}
            >
              Clear history
            </button>
          </div>

          <div className="space-y-3">
            {recentRuns.map((r) => (
              <div key={r.runId} className="border rounded p-4 space-y-2">
                <div className="font-semibold text-gray-900">{r.title}</div>
                <div className="text-xs text-gray-500">
                  {r.mode === "org" ? "Organisational" : "Explorer"} ·{" "}
                  {new Date(r.createdAtISO).toLocaleDateString()}
                </div>
                <div className="flex flex-wrap gap-2">
                  <a className="px-3 py-2 border rounded hover:bg-gray-50 text-sm" href={`/admin/run/${r.runId}`}>
                    Open Survey Admin
                  </a>
                  <a className="px-3 py-2 border rounded hover:bg-gray-50 text-sm" href={`/dashboard/${r.runId}`}>
                    Open Results
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="border rounded-lg p-6 space-y-4">
        <div className="space-y-1">
          <label className="text-sm font-semibold">Organisation name</label>
          <input className="w-full border rounded px-3 py-2" value={orgName} onChange={(e) => setOrgName(e.target.value)} />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-semibold">Survey name</label>
          <input className="w-full border rounded px-3 py-2" value={runTitle} onChange={(e) => setRunTitle(e.target.value)} />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-semibold">Survey type</label>
          <select className="w-full border rounded px-3 py-2" value={mode} onChange={(e) => onModeChange(e.target.value as any)}>
            <option value="explorer">Explorer (self-assessment)</option>
            <option value="org">Organisational (survey)</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-semibold">Invite count</label>

	<input
	  className="w-full border rounded px-3 py-2"
	  type="number"
	  min={mode === "explorer" ? 1 : MIN_ORG_RESPONDENTS}
	  max={500}
	  value={inviteCount}
	  disabled={mode === "explorer"}
	  onChange={(e) => setInviteCount(Number(e.target.value))}
	/>

	<div className="text-xs text-gray-500">
	  {mode === "explorer"
	    ? "Explorer mode creates exactly 1 link for you to complete yourself. You’ll see the full breakdown immediately."
	    : inviteCount < MIN_ORG_RESPONDENTS
	    ? `Organisational mode protects anonymity: results won’t show until ${MIN_ORG_RESPONDENTS}+ people respond. Create at least ${MIN_ORG_RESPONDENTS} links (one per person).`
	    : inviteCount <= 10
	    ? "Free sample: you’ll see headline score, radar, and one top insight. Full breakdown requires unlock."
	    : "Above free sample threshold: you’ll see a teaser only until you unlock. Prefer to try first? Run 5–10 invites."}
	</div>
        </div>

        <details className="border rounded p-4">
          <summary className="cursor-pointer font-semibold">Optional segmentation (applies to all invites)</summary>
          <div className="mt-3 space-y-3">
            <input className="w-full border rounded px-3 py-2" placeholder="Team (e.g. Engineering)" value={team} onChange={(e) => setTeam(e.target.value)} />
            <input className="w-full border rounded px-3 py-2" placeholder="Level (e.g. IC / Manager / Exec)" value={level} onChange={(e) => setLevel(e.target.value)} />
            <input className="w-full border rounded px-3 py-2" placeholder="Location (e.g. London)" value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
        </details>

        <button
          onClick={createRun}
          disabled={loading}
          className="px-5 py-3 rounded bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Creating…" : "Create survey"}
        </button>

        {error && <div className="text-red-600">{error}</div>}
      </div>

      {result && (
        <div className="border rounded-lg p-6 space-y-4">
          <div className="font-semibold">Survey created</div>
          <div className="text-sm text-gray-600">
            Survey type: {result.mode === "org" ? "Organisational" : "Explorer (self-assessment)"}
          </div>

          <div className="border rounded-lg p-6 space-y-2">
            <div className="font-semibold">Admin link</div>
            <a
              className="text-blue-600 underline"
              href={`/admin/run/${result.runId}?ownerToken=${result.ownerToken}`}
            >
              /admin/run/{result.runId}?ownerToken={result.ownerToken}
            </a>
            <div className="text-xs text-gray-500">
              Safely save this admin code. It cannot be recovered. Do not share it.
            </div>
          </div>

          {result.mode === "explorer" ? (
            <>
              <div className="border rounded-lg p-6 space-y-4">
                <h2 className="text-lg font-semibold">Take your self-assessment</h2>
                <div className="flex flex-wrap gap-2">
                  <a
                    className="px-3 py-2 border rounded hover:bg-gray-50 text-sm"
                    href={result.surveyLinks[0]}
                  >
                    Open your survey
                  </a>
                </div>
                <div className="text-xs text-gray-500">This link is for you only.</div>
              </div>

              <div className="border rounded-lg p-6 space-y-4">
                <h2 className="text-lg font-semibold">Save your links</h2>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="px-3 py-2 border rounded hover:bg-gray-50 text-sm"
                    onClick={() =>
                      copyText(
                        "Links copied",
                        `Survey Admin: ${window.location.origin}/admin/run/${result.runId}\nResults: ${window.location.origin}${result.dashboardLink}\n\nSurvey link:\n${window.location.origin}${result.surveyLinks[0]}`
                      )
                    }
                  >
                    Copy my links
                  </button>
                  <a
                    className="px-3 py-2 border rounded hover:bg-gray-50 text-sm inline-block"
                    href={
                      "mailto:?" +
                      "subject=" +
                      encodeURIComponent(`TrustIndex links – ${runTitle}`) +
                      "&body=" +
                      encodeURIComponent(
                        `Survey Admin: ${window.location.origin}/admin/run/${result.runId}\nResults: ` +
                          `${window.location.origin}${result.dashboardLink}\n\nSurvey link:\n` +
                          `${window.location.origin}${result.surveyLinks[0]}`
                      )
                    }
                  >
                    Email me my links
                  </a>
                </div>
                {copied && <div className="text-sm text-green-700">{copied}</div>}
              </div>
            </>
          ) : (
            <div className="border rounded-lg p-6 space-y-4">
              <h2 className="text-lg font-semibold">Share this survey</h2>

              <div className="text-sm text-gray-700">
                Fastest option: copy links and send one per person (recommended for organisational mode).
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  className="px-3 py-2 border rounded hover:bg-gray-50 text-sm"
                  onClick={() =>
                    copyText(
                      "All survey links copied",
                      result.surveyLinks.map((p) => `${window.location.origin}${p}`).join("\n")
                    )
                  }
                >
                  Copy all survey links
                </button>

                <button
                  className="px-3 py-2 border rounded hover:bg-gray-50 text-sm"
                  onClick={() =>
                    copyText("Results link copied", `${window.location.origin}${result.dashboardLink}`)
                  }
                >
                  Copy results link
                </button>

                <button
                  className="px-3 py-2 border rounded hover:bg-gray-50 text-sm"
                  onClick={() =>
                    copyText(
                      "Email draft copied",
                      `Subject: TrustIndex survey – quick input requested

Hi [Name],

Please complete the TrustIndex survey using your personal link below:
(choose one link per person)

${result.surveyLinks.map((p) => `${window.location.origin}${p}`).join("\n")}

Thanks,
[Your name]`
                    )
                  }
                >
                  Copy email draft
                </button>
              </div>

              {copied && <div className="text-sm text-green-700">{copied}</div>}

              <a
                className="px-3 py-2 border rounded hover:bg-gray-50 text-sm inline-block"
                href={
                  "mailto:?" +
                  "subject=" +
                  encodeURIComponent("TrustIndex survey – quick input requested") +
                  "&body=" +
                  encodeURIComponent(
                    `Hi [Name],\n\nPlease complete the TrustIndex survey using your personal link below:\n(choose one link per person)\n\n` +
                      result.surveyLinks.map((p) => `${window.location.origin}${p}`).join("\n") +
                      `\n\nThanks,\n[Your name]`
                  )
                }
              >
                Open email draft (edit names)
              </a>

              <div className="text-sm">
                <div className="font-semibold text-gray-700">Survey Admin</div>
                <a className="text-blue-600 underline" href={`/admin/run/${result.runId}`}>
                  Open Survey Admin
                </a>
              </div>

              <div className="text-xs text-gray-500">
                Tip: paste the links into email/Slack/Teams. For organisational mode, do not reuse the same link for multiple people.
              </div>
            </div>
          )}

          {result.mode === "org" && (
            <div className="text-xs text-gray-500">
              Free sample supports up to 10 respondents. For 11+ respondents, the dashboard will require an upgrade to
              show full breakdown.
            </div>
          )}

          <div className="text-xs text-gray-500">
            In organisational mode, send one survey link per person. In explorer mode, complete the single link yourself.
          </div>
        </div>
      )}
    </main>
  );
}
