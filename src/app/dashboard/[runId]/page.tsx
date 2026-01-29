"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
} from "recharts";

type RunRow = {
  id: string;
  mode: "explorer" | "org";
  title: string;
};

type CountRow = {
  run_id: string;
  respondents: number;
  answers: number;
};

type DimensionRow = {
  run_id: string;
  dimension: string;
  mean_1_to_5: number;
  n_answers: number;
};

type TrustRow = {
  run_id: string;
  overall_mean_1_to_5: number;
  trustindex_0_to_100: number;
};

type InviteRow = {
  token: string;
  used_at: string | null;
  created_at: string;
};

function escapeCsv(value: any) {
  const str = value == null ? "" : String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsvValue(v: any) {
  if (v == null) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}


function bandFor(score0to100: number) {
  if (score0to100 < 40) {
    return {
      label: "Fragile",
      color: "text-verisum-red",
      summary: "Low trust signals systemic friction and elevated execution risk.",
    };
  }
  if (score0to100 < 70) {
    return {
      label: "Mixed",
      color: "text-verisum-yellow",
      summary: "Trust is inconsistent; performance is likely uneven across teams or cohorts.",
    };
  }
  return {
    label: "Strong",
    color: "text-verisum-green",
    summary: "Trust is an asset; protect it and scale what is working.",
  };
}

type DimInterpretation = {
  short: string;
  lowMeans: string;
  highMeans: string;
  actions: string[];
  probes: string[];
};

function interpretationForDimension(name: string): DimInterpretation {
  const map: Record<string, DimInterpretation> = {
    "Employee Confidence": {
      short: "Confidence",
      lowMeans:
        "People do not feel safe to speak up or believe action will follow; energy leaks into self-protection and escalations.",
      highMeans:
        "People expect fair process, can challenge decisions, and believe issues will be addressed; execution is faster and calmer.",
      actions: [
        "Publish decision owners and response SLAs for common issues (pay, policy, tooling, workload).",
        "Run a monthly ‘you said / we did’ to close loops; track response time to themes.",
      ],
      probes: [
        "Where do people feel ignored or punished for raising issues?",
        "Which decisions feel opaque or reversed without explanation?",
      ],
    },
    "Leadership Credibility": {
      short: "Leadership",
      lowMeans:
        "Direction feels inconsistent or performative; trust breaks when messages and actions diverge.",
      highMeans:
        "Leadership signals are reliable; people can predict priorities and see follow-through.",
      actions: [
        "Make trade-offs explicit: what you are not doing (and why).",
        "Tie OKRs and resourcing to the same narrative; remove ‘shadow priorities’.",
      ],
      probes: [
        "Which commitments have slipped without acknowledgement?",
        "Where is strategy unclear at team level?",
      ],
    },
    "Operational Clarity": {
      short: "Clarity",
      lowMeans:
        "People are unsure who owns what; handoffs and decisions stall; rework increases.",
      highMeans:
        "Ownership and pathways are clear; teams can execute without escalation.",
      actions: [
        "Define decision rights (RACI/DRI) for the top 10 cross-functional flows.",
        "Instrument 2–3 key workflows end-to-end (time-to-approve, time-to-ship, time-to-fix).",
      ],
      probes: [
        "Where do requests die or bounce between teams?",
        "Which handoffs trigger the most rework?",
      ],
    },
    "AI Explainability": {
      short: "AI Explain.",
      lowMeans:
        "People don’t understand AI outputs or how to challenge them; risk and rework rise.",
      highMeans:
        "AI use is transparent and contestable; accountability is clear; adoption scales safely.",
      actions: [
        "Require ‘why/inputs/limitations’ for AI-assisted outputs in critical processes.",
        "Publish an AI usage policy with escalation paths and human sign-off points.",
      ],
      probes: [
        "Where are people using AI but hiding it?",
        "Which decisions rely on AI outputs without explainability?",
      ],
    },
    "Fairness & Consistency": {
      short: "Fairness",
      lowMeans:
        "Rules feel uneven; exceptions dominate; cynicism grows and retention risk increases.",
      highMeans:
        "Process feels consistent; exceptions are explained; performance conversations are trusted.",
      actions: [
        "Define and publish criteria for exceptions (pay, remote, promotions) and track them.",
        "Calibrate performance decisions with evidence standards and documented rationale.",
      ],
      probes: [
        "Where do people perceive inconsistency or ‘favourites’?",
        "Which policies are most often bypassed?",
      ],
    },
  };

  return (
    map[name] || {
      short: name,
      lowMeans: "Lower scores indicate friction or inconsistency in this dimension.",
      highMeans: "Higher scores indicate strength and reliability in this dimension.",
      actions: ["Pick one workflow change you can deliver within 30 days to improve confidence."],
      probes: ["Which team or process is driving this score?"],
    }
  );
}

export default function DashboardPage() {
  const params = useParams<{ runId: string }>();
  const runId = params?.runId;
  const adminHref = runId ? `/admin/run/${runId}` : "/admin/new-run";

  const [loading, setLoading] = useState(true);
  const [trust, setTrust] = useState<TrustRow | null>(null);
  const [dims, setDims] = useState<DimensionRow[]>([]);
  const [error, setError] = useState<string | null>(null);
const [run, setRun] = useState<RunRow | null>(null);
const [counts, setCounts] = useState<CountRow | null>(null);
const [invites, setInvites] = useState<InviteRow[]>([]);
  const [isAdminViewer, setIsAdminViewer] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);

  const radarData = useMemo(() => {
  const short = (s: string) =>
    s === "Employee Confidence" ? "Confidence" :
    s === "AI Explainability" ? "AI Explain." :
    s;

  return dims.map((d) => ({
    dimension: short(d.dimension),
    score: Math.round(((Number(d.mean_1_to_5) - 1) / 4) * 100),
  }));
}, [dims]);

  useEffect(() => {
    if (!runId) return;

    const load = async () => {
      setLoading(true);
      setError(null);

const { data: runData, error: runErr } = await supabase
  .from("survey_runs")
  .select("id, mode, title")
  .eq("id", runId)
  .single();

if (runErr) {
  setError(`Could not load Survey: ${runErr.message}`);
  setLoading(false);
  return;
}

setRun(runData as RunRow);

const { data: countData, error: countErr } = await supabase
  .from("v_run_response_counts")
  .select("run_id, respondents, answers")
  .eq("run_id", runId)
  .maybeSingle();

if (countErr) {
  setError(`Could not load response counts: ${countErr.message}`);
  setLoading(false);
  return;
}

setCounts((countData as CountRow) || { run_id: runId as string, respondents: 0, answers: 0 });
const { data: inviteData, error: inviteErr } = await supabase
  .from("invites")
  .select("token, used_at, created_at")
  .eq("run_id", runId)
  .order("created_at", { ascending: true });

if (inviteErr) {
  setError(`Could not load invites: ${inviteErr.message}`);
  setLoading(false);
  return;
}

setInvites((inviteData as InviteRow[]) || []);

     const { data: trustData, error: trustErr } = await supabase
        .from("v_trustindex_scores")
        .select("run_id, overall_mean_1_to_5, trustindex_0_to_100")
        .eq("run_id", runId)
        .maybeSingle();

      if (trustErr) {
	setError("Results aren’t available yet. This usually means no one has completed the survey.");
        setLoading(false);
        return;
      }

      const { data: dimData, error: dimErr } = await supabase
        .from("v_dimension_scores")
        .select("run_id, dimension, mean_1_to_5, n_answers")
        .eq("run_id", runId);

      if (dimErr) {
        setError(`Could not load dimension scores: ${dimErr.message}`);
        setLoading(false);
        return;
      }

      setTrust(trustData as TrustRow);
      setDims((dimData as DimensionRow[]) || []);
      setLoading(false);
    };

    load();
  }, [runId]);

  useEffect(() => {
    if (!runId) return;
    setIsAdminViewer(sessionStorage.getItem(`ti_admin_${runId}`) === "1");
  }, [runId]);

  useEffect(() => {
    if (!runId) return;
    setIsUnlocked(localStorage.getItem(`ti_unlocked_${runId}`) === "1");
  }, [runId]);

  if (loading) {
    return (
      <main className="p-4 md:p-6 lg:p-10">
        <div className="text-verisum-grey">Loading dashboard…</div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="p-4 md:p-6 lg:p-10 space-y-4">
        <h1 className="text-2xl font-bold">TrustIndex Dashboard</h1>
        <div className="text-verisum-red">{error}</div>
      </main>
    );
  }

  const minRespondents = 5;

  const respondents = counts?.respondents ?? 0;
  const isExplorer = run?.mode === "explorer";
  const gateActive = !isExplorer && respondents < minRespondents;

  if (gateActive) {
    return (
      <main className="min-h-screen bg-verisum-white text-verisum-black">
        <div className="max-w-3xl mx-auto p-4 md:p-6 lg:p-10 space-y-6">
          <h1 className="text-3xl font-bold">TrustIndex™ Results</h1>
          <div className="text-verisum-grey">{run?.title}</div>

          <div className="border border-verisum-grey rounded-lg p-6 space-y-2">
            <div className="font-semibold">Not enough responses yet</div>
            <div className="text-verisum-grey">
              This survey is in <span className="font-semibold">Organisational</span> mode and requires at least{" "}
              <span className="font-semibold">{minRespondents}</span> respondents before results are shown.
            </div>
            <div className="text-sm text-verisum-grey">
              Current respondents: {respondents}
            </div>
            <div className="text-xs text-verisum-grey">
              This threshold protects anonymity and avoids over-interpreting very small samples.
            </div>
<div className="border border-verisum-grey rounded-lg p-6 space-y-3">
  <h2 className="text-lg font-semibold">Survey links</h2>
  <div className="text-sm text-verisum-grey">
    Completed: {invites.filter((i) => i.used_at).length} · Pending: {invites.filter((i) => !i.used_at).length}
  </div>

  {!isExplorer && (
    <div className="space-y-2">
      {invites.map((i) => (
        <div key={i.token} className="flex items-center justify-between text-sm">
          <div className="text-verisum-grey">
            {i.token.slice(0, 6)}…{i.token.slice(-4)}
          </div>
          <div className={i.used_at ? "text-verisum-green" : "text-verisum-yellow"}>
            {i.used_at ? "Completed" : "Pending"}
          </div>
        </div>
      ))}
    </div>
  )}

  {isExplorer ? (
    <div className="text-xs text-verisum-grey">
      Explorer mode uses a single private link. In organisational surveys, each person receives a unique link.
    </div>
  ) : (
    <div className="text-xs text-verisum-grey">
      Tokens are masked for safety. Each token corresponds to one survey link.
    </div>
  )}
</div>
          </div>
          <div className="text-sm text-verisum-grey">
            <span className="font-medium">Need to share or chase responses?</span>{" "}
            <a className="text-verisum-blue underline" href={adminHref}>
              Open Survey Admin
            </a>
          </div>
          <a className="text-verisum-blue underline" href={adminHref}>
            Back to Survey Admin
          </a>
        </div>
      </main>
    );
  }

if (!trust) {
  return (
    <main className="min-h-screen bg-verisum-white text-verisum-black">
      <div className="max-w-3xl mx-auto p-10 space-y-6">
        <h1 className="text-3xl font-bold">TrustIndex™ Results</h1>
        <div className="text-verisum-grey">{run?.title}</div>
        <div className="border border-verisum-grey rounded-lg p-6 space-y-2">
	<div className="text-verisum-grey font-medium">No responses yet.</div>
	<div className="text-verisum-grey text-sm mt-1">
 	 Once someone completes the survey, results will appear here.
	</div>
          <div className="text-sm text-verisum-grey">
            Respondents so far: {counts?.respondents ?? 0}
          </div>
        </div>

        <div className="border border-verisum-grey rounded-lg p-6 space-y-3">
          <h2 className="text-lg font-semibold">Survey links</h2>
          <div className="text-sm text-verisum-grey">
            Completed: {invites.filter((i) => i.used_at).length} · Pending: {invites.filter((i) => !i.used_at).length}
          </div>
          {!isExplorer && (
            <div className="space-y-2">
              {invites.map((i) => (
                <div key={i.token} className="flex items-center justify-between text-sm">
                  <div className="text-verisum-grey">
                    {i.token.slice(0, 6)}…{i.token.slice(-4)}
                  </div>
                  <div className={i.used_at ? "text-verisum-green" : "text-verisum-yellow"}>
                    {i.used_at ? "Completed" : "Pending"}
                  </div>
                </div>
              ))}
            </div>
          )}
          {isExplorer ? (
            <div className="text-xs text-verisum-grey">
              Explorer mode uses a single private link. In organisational surveys, each person receives a unique link.
            </div>
          ) : (
            <div className="text-xs text-verisum-grey">
              Tokens are masked for safety. Each token corresponds to one survey link.
            </div>
          )}
        </div>

        <div className="text-sm text-verisum-grey">
          <span className="font-medium">Need to share or chase responses?</span>{" "}
          <a className="text-verisum-blue underline" href={adminHref}>
            Open Survey Admin
          </a>
        </div>

	<a className="text-verisum-blue underline" href={adminHref}>
          Back to Survey Admin
        </a>
      </div>
    </main>
  );
}

  const isOrg = run?.mode === "org";
  const hasFullAccess = isExplorer || (isOrg && isUnlocked);
  const isTeaser = isOrg && respondents >= minRespondents && !hasFullAccess;
  const isAboveSample = isOrg && respondents > 10;
  const canExport = isUnlocked && isAdminViewer;
  const teaserCopy = {
    title: "Unlock the full TrustIndex breakdown",
    body: "You've got the headline score, one top insight, radar and the basic CSV survey data download all available in your Survey Admin.\nClick on the link below to unlock your path to improved Trust and Performance, gaining:",
    bullets: [
      "Full dimension-by-dimension diagnosis.",
      "Corresponding actions and probe questions tailored to weak spots.",
      "Further analysis, reports and implementation support.",
    ],
  };
  const aboveThresholdCopy = {
    title: "You’re above the free sample threshold",
    body: `This survey has ${respondents} respondents. The free sample covers up to 10. Unlock to see the full breakdown and export.`,
    helper:
      "Prefer to try first? Run a 5–10 respondent sample survey, or use Explorer mode for a private self-assessment.",
  };
  const overlayCopy = isAboveSample ? aboveThresholdCopy : teaserCopy;
  const lowestDim = dims.length
    ? dims.reduce((lowest, d) =>
        Number(d.mean_1_to_5) < Number(lowest.mean_1_to_5) ? d : lowest
      )
    : null;
  const lowestScore = lowestDim
    ? Math.round(((Number(lowestDim.mean_1_to_5) - 1) / 4) * 100)
    : null;
  const lowestInfo = lowestDim ? interpretationForDimension(lowestDim.dimension) : null;

  const downloadResponsesCsv = async () => {
    if (!runId) return;
    setExportStatus(null);
    setExporting(true);
    try {
      const { data: inviteRows, error: invitesErr } = await supabase
        .from("invites")
        .select("token, used_at, created_at")
        .eq("run_id", runId);

      if (invitesErr || !inviteRows) {
        throw new Error(invitesErr?.message || "Could not load invites.");
      }

      const { data: responses, error: responsesErr } = await supabase
        .from("responses")
        .select("run_id, invite_token, question_id, value, created_at")
        .eq("run_id", runId);

      if (responsesErr || !responses) {
        throw new Error(responsesErr?.message || "Could not load responses.");
      }

      const { data: questions, error: questionsErr } = await supabase
        .from("questions")
        .select("id, dimension, prompt");

      if (questionsErr || !questions) {
        throw new Error(questionsErr?.message || "Could not load questions.");
      }

      const inviteByToken = new Map(inviteRows.map((i) => [i.token, i]));
      const questionById = new Map(questions.map((q) => [q.id, q]));

      const header = [
        "run_id",
        "run_title",
        "mode",
        "invite_token",
        "completed",
        "invite_created_at",
        "invite_used_at",
        "question_id",
        "dimension",
        "question_text",
        "value",
        "response_created_at",
        "exported_at",
      ];

      const lines = [header.join(",")];
      const exportedAt = new Date().toISOString();

      responses.forEach((r) => {
        const invite = inviteByToken.get(r.invite_token);
        const q = questionById.get(r.question_id);
        lines.push(
          [
            r.run_id,
            run?.title || "",
            run?.mode || "",
            r.invite_token,
            invite?.used_at ? "true" : "false",
            invite?.created_at || "",
            invite?.used_at || "",
            r.question_id,
            q?.dimension || "",
            q?.prompt || "",
            toCsvValue(r.value),
            r.created_at || "",
            exportedAt,
          ]
            .map(escapeCsv)
            .join(",")
        );
      });

      const csv = lines.join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `trustindex_${runId}_responses.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setExportStatus("CSV downloaded.");
    } catch (err: any) {
      setExportStatus(err?.message || "Failed to export CSV.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <main className="min-h-screen bg-verisum-white text-verisum-black">
      <div className="max-w-4xl mx-auto p-4 md:p-6 lg:p-10 space-y-6 md:space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold">TrustIndex™ Results</h1>
          <div className="text-sm text-verisum-grey">Survey ID: {runId}</div>
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-verisum-grey">
            <div>
              Mode: {run?.mode ?? "—"} · Respondents: {counts?.respondents ?? 0}
            </div>
            <a className="text-verisum-blue underline whitespace-nowrap" href={adminHref}>
              Back to Survey Admin
            </a>
          </div>
        </header>

        <div className="border border-verisum-grey rounded-lg p-6 flex items-end justify-between">
          <div>
            <div className="text-sm text-verisum-grey">TrustIndex score</div>
            <div className="text-5xl font-bold">
              {Number(trust.trustindex_0_to_100).toFixed(1)}
            </div>
          </div>
          <div className="text-sm text-verisum-grey">
            Derived from mean score: {Number(trust.overall_mean_1_to_5).toFixed(2)} / 5
          </div>
        </div>

        <div className="border border-verisum-grey rounded-lg p-6 space-y-3">
          <div className="text-sm text-verisum-grey">What this means</div>

          {(() => {
            const score = Math.round(Number(trust.trustindex_0_to_100));
            const band = bandFor(score);
            return (
              <>
                <div className={`text-xl font-semibold ${band.color}`}>
                  {band.label} trust ({score}/100)
                </div>
                <div className="text-sm text-verisum-grey">{band.summary}</div>

                <div className="text-sm text-verisum-grey">
                  Recommended next step:{" "}
                  {run?.mode === "org"
                    ? "Review pending responses and then focus on the lowest-scoring dimension first."
                    : "Run an organisational survey (5–15 invites) to validate your self-assessment with real respondent data."}
                </div>
              </>
            );
          })()}
        </div>

        {run?.mode === "explorer" && (
          <div className="border border-verisum-grey rounded-lg p-6 space-y-3">
            <div className="text-lg font-semibold">Validate this with your organisation</div>
            <div className="text-sm text-verisum-grey">
              Explorer is a single self-assessment. To validate, run an organisational survey with 5–15 respondents.
              Results unlock once 5 people respond.
            </div>
            <a
              className="inline-flex items-center px-3 py-2 rounded bg-verisum-blue text-verisum-white text-sm font-semibold hover:bg-[#2a7bb8]"
              href="/admin/new-run"
            >
              Run an organisational survey
            </a>
            <div className="text-xs text-verisum-grey">
              Takes ~2 minutes to set up. Results unlock once 5 people respond.
            </div>
          </div>
        )}

<div className="border border-verisum-grey rounded-lg p-6 space-y-3">
  <h2 className="text-lg font-semibold">{isExplorer ? "Your completion" : "Survey completion"}</h2>
  <div className="text-sm text-verisum-grey">
    Completed: {invites.filter((i) => i.used_at).length} · Pending: {invites.filter((i) => !i.used_at).length}
  </div>

  {!isExplorer && (
    <div className="space-y-2">
      {invites.map((i) => (
        <div key={i.token} className="flex items-center justify-between text-sm">
          <div className="text-verisum-grey">
            {i.token.slice(0, 6)}…{i.token.slice(-4)}
          </div>
          <div className={i.used_at ? "text-verisum-green" : "text-verisum-yellow"}>
            {i.used_at ? "Completed" : "Pending"}
          </div>
        </div>
      ))}
    </div>
  )}

  {isExplorer ? (
    <div className="text-xs text-verisum-grey">
      Explorer mode uses a single private link. In organisational surveys, each person receives a unique link.
    </div>
  ) : (
    <div className="text-xs text-verisum-grey">
      Tokens are masked for safety. Each token corresponds to one survey link.
    </div>
  )}
</div>

        {!isTeaser && canExport && (
          <div className="border border-verisum-grey rounded-lg p-6 space-y-3">
            <h2 className="text-lg font-semibold">Export</h2>
            <button
              className="px-3 py-2 border border-verisum-grey rounded hover:bg-[#f5f5f5] text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={downloadResponsesCsv}
              disabled={exporting}
            >
              {exporting ? "Preparing CSV…" : "Download responses CSV"}
            </button>
            {exportStatus && <div className="text-sm text-verisum-grey">{exportStatus}</div>}
            <div className="text-xs text-verisum-grey">
              Admin view only (set when opened from Survey Admin).
            </div>
          </div>
        )}

        {isTeaser && (
          <>
            <div className="border border-verisum-grey rounded-lg p-6 space-y-3">
              <h2 className="text-lg font-semibold">Top insight (sample)</h2>
              {lowestDim && lowestInfo && lowestScore != null ? (
                <>
                  <div className="flex items-baseline justify-between gap-4">
                    <div className="font-semibold">{lowestInfo.short}</div>
                    <div className="text-sm text-verisum-grey">{lowestScore}/100</div>
                  </div>
                  <div className="text-sm text-verisum-grey">
                    {lowestScore >= 70 ? lowestInfo.highMeans : lowestInfo.lowMeans}
                  </div>
                </>
              ) : (
                <div className="text-sm text-verisum-grey">
                  We’ll show the top insight once dimension scores are available.
                </div>
              )}
            </div>

            <div className="border border-verisum-grey rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-4">Radar</h2>
              <div style={{ width: "100%", height: 300 }}>
                <ResponsiveContainer>
                  <RadarChart
                    data={radarData}
                    margin={{ top: 30, right: 60, bottom: 30, left: 60 }}
                  >
                    <PolarGrid />
                    <PolarAngleAxis
                      dataKey="dimension"
                      tick={{ fontSize: 11, fontWeight: 600, fill: "#4b5563" }}
                    />
                    <Radar dataKey="score" />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="relative">
              <div className="border border-verisum-grey rounded-lg bg-verisum-white p-6 space-y-4 mb-6">
                <h2 className="text-lg font-semibold">{overlayCopy.title}</h2>
                <div className="text-sm text-verisum-grey whitespace-pre-line">{overlayCopy.body}</div>
                {"bullets" in overlayCopy && (
                  <ul className="list-disc pl-5 text-sm text-verisum-grey">
                    {overlayCopy.bullets.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )}
                {"helper" in overlayCopy && (
                  <div className="text-xs text-verisum-grey">{overlayCopy.helper}</div>
                )}
                <div className="flex flex-wrap gap-2">
                  <a
                    className="px-4 py-2 rounded bg-verisum-blue text-verisum-white text-sm font-semibold hover:bg-[#2a7bb8]"
                    href={
                      "mailto:TrustIndexScores@verisum.org?" +
                      "subject=" +
                      encodeURIComponent(`TrustIndex unlock request – ${run?.title || runId}`) +
                      "&body=" +
                      encodeURIComponent(
                        `Hi Rob,\n\nI’d like to unlock the full TrustIndex report for:\n` +
                          `\t•\tSurvey: ${run?.title || "—"}\n` +
                          `\t•\tSurvey ID: ${runId}\n` +
                          `\t•\tMode: ${run?.mode || "—"}\n` +
                          `\t•\tRespondents: ${respondents}\n\n` +
                          `Results link:\n${window.location.origin}/dashboard/${runId}\n\n` +
                          `What I’d like (delete/leave as appropriate):\n` +
                          `1) Unlock the full breakdown (paid)\n` +
                          `2) Run a full org survey (11+ respondents)\n` +
                          `3) A short debrief / recommendations\n\n` +
                          `Notes / context:\n(briefly add anything relevant)\n\nThanks,`
                      )
                    }
                  >
                    Request unlock / pricing
                  </a>
                  <a
                    className="px-4 py-2 rounded border text-sm hover:bg-[#f5f5f5]"
                    href={
                      "mailto:TrustIndexScores@verisum.org?" +
                      "subject=" +
                      encodeURIComponent(`TrustIndex debrief – ${run?.title || runId}`) +
                      "&body=" +
                      encodeURIComponent(
                        `Hi Rob,\n\nCan we book a quick 20-minute debrief on this TrustIndex result?\n` +
                          `\t•\tSurvey: ${run?.title || "—"}\n` +
                          `\t•\tSurvey ID: ${runId}\n` +
                          `\t•\tMode: ${run?.mode || "—"}\n` +
                          `\t•\tRespondents: ${respondents}\n\n` +
                          `Results:\n${window.location.origin}/dashboard/${runId}\n\nThanks,`
                      )
                    }
                  >
                    Book a 20-min debrief
                  </a>
                </div>

              </div>
              <div className="filter blur-sm pointer-events-none select-none opacity-70">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="border border-verisum-grey rounded-lg p-6">
                    <h2 className="text-lg font-semibold mb-4">Dimensions and actions</h2>

                    <div className="space-y-4">
                      {dims.map((d) => {
                        const score = Math.round(((Number(d.mean_1_to_5) - 1) / 4) * 100);
                        const info = interpretationForDimension(d.dimension);

                        return (
                          <div key={d.dimension} className="border border-verisum-grey rounded p-4 space-y-2">
                            <div className="flex items-baseline justify-between gap-4">
                              <div className="font-semibold">{info.short}</div>
                              <div className="text-sm text-verisum-grey">{score}/100</div>
                            </div>

                            <div className="text-sm text-verisum-grey">
                              {score < 40
                                ? info.lowMeans
                                : score >= 70
                                ? info.highMeans
                                : "Mixed signal: likely strong in some teams, weak in others."}
                            </div>

                            <div className="text-sm">
                              <div className="font-semibold text-verisum-grey">Actions</div>
                              <ul className="list-disc pl-5 text-verisum-grey">
                                {info.actions.map((a) => (
                                  <li key={a}>{a}</li>
                                ))}
                              </ul>
                            </div>

                            <div className="text-sm">
                              <div className="font-semibold text-verisum-grey">Probe questions</div>
                              <ul className="list-disc pl-5 text-verisum-grey">
                                {info.probes.map((p) => (
                                  <li key={p}>{p}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="border border-verisum-grey rounded-lg p-6">
                    <h2 className="text-lg font-semibold mb-4">Radar</h2>
                    <div style={{ width: "100%", height: 300 }}>
                      <ResponsiveContainer>
                        <RadarChart
                          data={radarData}
                          margin={{ top: 30, right: 60, bottom: 30, left: 60 }}
                        >
                          <PolarGrid />
                          <PolarAngleAxis
                            dataKey="dimension"
                            tick={{ fontSize: 11, fontWeight: 600, fill: "#4b5563" }}
                          />
                          <Radar dataKey="score" />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {!isTeaser && (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="border border-verisum-grey rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-4">Dimensions and actions</h2>

              <div className="space-y-4">
                {dims.map((d) => {
                  const score = Math.round(((Number(d.mean_1_to_5) - 1) / 4) * 100);
                  const info = interpretationForDimension(d.dimension);

                  return (
                    <div key={d.dimension} className="border border-verisum-grey rounded p-4 space-y-2">
                      <div className="flex items-baseline justify-between gap-4">
                        <div className="font-semibold">{info.short}</div>
                        <div className="text-sm text-verisum-grey">{score}/100</div>
                      </div>

                      <div className="text-sm text-verisum-grey">
                        {score < 40
                          ? info.lowMeans
                          : score >= 70
                          ? info.highMeans
                          : "Mixed signal: likely strong in some teams, weak in others."}
                      </div>

                      <div className="text-sm">
                        <div className="font-semibold text-verisum-grey">Actions</div>
                        <ul className="list-disc pl-5 text-verisum-grey">
                          {info.actions.map((a) => (
                            <li key={a}>{a}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="text-sm">
                        <div className="font-semibold text-verisum-grey">Probe questions</div>
                        <ul className="list-disc pl-5 text-verisum-grey">
                          {info.probes.map((p) => (
                            <li key={p}>{p}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="border border-verisum-grey rounded-lg p-6">
    <h2 className="text-lg font-semibold mb-4">Radar</h2>
    <div style={{ width: "100%", height: 300 }}>
      <ResponsiveContainer>
        <RadarChart
          data={radarData}
          margin={{ top: 30, right: 60, bottom: 30, left: 60 }}
        >
          <PolarGrid />
          <PolarAngleAxis
            dataKey="dimension"
            tick={{ fontSize: 11, fontWeight: 600, fill: "#4b5563" }}
          />
          <Radar dataKey="score" />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  </div>
          </div>
        )}

        <div className="text-sm text-verisum-grey">
          <span className="font-medium">Need to share or chase responses?</span>{" "}
          <a className="text-verisum-blue underline" href={adminHref}>
            Open Survey Admin
          </a>
        </div>
      </div>
    </main>
  );
}
