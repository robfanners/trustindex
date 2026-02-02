"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import AppShell from "@/components/AppShell";

type RunRow = { id: string; mode: "explorer" | "org"; title: string };
type InviteRow = {
  token: string;
  used_at: string | null;
  created_at: string;
  team?: string | null;
  level?: string | null;
  location?: string | null;
};
type RecentRun = {
  runId: string;
  title: string;
  mode: "explorer" | "org";
  createdAtISO: string;
};

export default function AdminRunPage() {
  const params = useParams<{ runId: string }>();
  const runId = params?.runId;
  const router = useRouter();
  const searchParams = useSearchParams();
  const ownerToken = searchParams.get("ownerToken");

  const [loading, setLoading] = useState(true);
  const [run, setRun] = useState<RunRow | null>(null);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [summaryExporting, setSummaryExporting] = useState(false);
  const [clientSafeExport, setClientSafeExport] = useState(true);
  const [includeSegmentation, setIncludeSegmentation] = useState(false);
  const [pendingFilterType, setPendingFilterType] = useState<"all" | "team" | "level" | "location">("all");
  const [pendingFilterValue, setPendingFilterValue] = useState("");
  const [authorising, setAuthorising] = useState(false);
  const [recentRuns, setRecentRuns] = useState<RecentRun[]>([]);
  const [rememberDevice, setRememberDevice] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [adminCode, setAdminCode] = useState<string | null>(null);

  async function copyText(label: string, text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  }

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

  function maskToken(t: string) {
    if (!t) return "";
    if (t.length <= 12) return t;
    return `${t.slice(0, 6)}…${t.slice(-4)}`;
  }

  // Storage abstraction for recent runs history
  function getStorageBackend() {
    return rememberDevice ? localStorage : sessionStorage;
  }

  function getHistory(): RecentRun[] {
    try {
      const storage = getStorageBackend();
      const raw = storage.getItem("ti_recent_runs");
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function setHistory(history: RecentRun[]) {
    try {
      const storage = getStorageBackend();
      storage.setItem("ti_recent_runs", JSON.stringify(history));
    } catch {
      // Ignore storage errors
    }
  }

  function clearHistory() {
    try {
      // Clear both for safety
      sessionStorage.removeItem("ti_recent_runs");
      localStorage.removeItem("ti_recent_runs");
    } catch {
      // Ignore storage errors
    }
  }

  function addOrUpdateHistoryEntry(entry: RecentRun) {
    const existing = getHistory();
    const filtered = existing.filter((r) => r.runId !== entry.runId);
    // Keep most recent createdAtISO
    const merged = [entry, ...filtered].sort((a, b) => 
      new Date(b.createdAtISO).getTime() - new Date(a.createdAtISO).getTime()
    ).slice(0, 10);
    setHistory(merged);
    return merged;
  }

  function migrateHistory(from: Storage, to: Storage): RecentRun[] {
    try {
      const raw = from.getItem("ti_recent_runs");
      const parsed: RecentRun[] = raw ? JSON.parse(raw) : [];

      // read existing from target
      const existingRaw = to.getItem("ti_recent_runs");
      const existing: RecentRun[] = existingRaw ? JSON.parse(existingRaw) : [];

      // Merge + dedupe by runId, keep most recent createdAtISO
      const merged = [...existing, ...parsed].reduce<RecentRun[]>((acc, entry) => {
        const found = acc.find((e: RecentRun) => e.runId === entry.runId);
        if (!found) acc.push(entry);
        else if (
          new Date(entry.createdAtISO).getTime() >
          new Date(found.createdAtISO).getTime()
        ) {
          Object.assign(found, entry);
        }
        return acc;
      }, []);

      to.setItem("ti_recent_runs", JSON.stringify(merged));
      from.removeItem("ti_recent_runs");

      return merged;
    } catch {
      return [];
    }
  }

  const loadData = async () => {
    if (!runId) return;

      setLoading(true);
      setError(null);

    try {
      const { data: runData, error: runErr } = await supabase
        .from("survey_runs")
        .select("id, mode, title")
        .eq("id", runId)
        .single();

      if (runErr) {
        setError(`Could not load run: ${runErr.message}`);
        setLoading(false);
        return;
      }

      setRun(runData as RunRow);

      const invitesWithSeg = await supabase
        .from("invites")
        .select("token, used_at, created_at, team, level, location")
        .eq("run_id", runId)
        .order("created_at", { ascending: true });

      if (invitesWithSeg.error) {
        const invitesBasic = await supabase
          .from("invites")
          .select("token, used_at, created_at")
          .eq("run_id", runId)
          .order("created_at", { ascending: true });
        if (invitesBasic.error) {
          setError(`Could not load invites: ${invitesBasic.error.message}`);
        setLoading(false);
        return;
        }
        setInvites((invitesBasic.data as InviteRow[]) || []);
      } else {
        setInvites((invitesWithSeg.data as InviteRow[]) || []);
      }

      // Fetch admin code from run_admin_tokens
      const { data: adminTokenData, error: adminTokenErr } = await supabase
        .from("run_admin_tokens")
        .select("token")
        .eq("run_id", runId)
        .limit(1)
        .single();

      if (!adminTokenErr && adminTokenData) {
        setAdminCode(adminTokenData.token as string);
      }
      
      // Update last updated timestamp on successful load
      setLastUpdated(new Date());
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!runId) return;
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  // Polling: refresh data every 10 minutes
  useEffect(() => {
    if (!runId) return;

    const interval = setInterval(() => {
      loadData();
    }, 600000); // 10 minutes

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  // Load remember device preference on mount
  useEffect(() => {
    try {
      const pref = localStorage.getItem("ti_remember_device");
      setRememberDevice(pref === "1");
    } catch {
      setRememberDevice(false);
    }
  }, []);

  // Load recent surveys on mount and when preference changes
  useEffect(() => {
    const history = getHistory();
    setRecentRuns(history);
  }, [rememberDevice]);

  // Save current run to recent surveys when successfully loaded
  useEffect(() => {
    if (!run || !runId || loading) return;
    const entry: RecentRun = {
      runId,
      title: run.title || `Survey ${runId.slice(0, 8)}`,
      mode: run.mode,
      createdAtISO: new Date().toISOString(),
    };
    const updated = addOrUpdateHistoryEntry(entry);
    setRecentRuns(updated);
  }, [run, runId, loading, rememberDevice]);

  useEffect(() => {
    async function run() {
      if (!ownerToken || !runId) return;
      setAuthorising(true);
      try {
        const res = await fetch("/api/auth-owner", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ runId, token: ownerToken }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.ok) throw new Error(json?.error || "Access denied");
        const url = new URL(window.location.href);
        url.searchParams.delete("ownerToken");
        router.replace(url.pathname + (url.search ? url.search : ""));
      } catch {
        router.replace(
          `/?auth=required&role=owner&runId=${encodeURIComponent(
            runId
          )}&next=${encodeURIComponent(`/admin/run/${runId}`)}`
        );
      } finally {
        setAuthorising(false);
      }
    }
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerToken, runId]);

  if (authorising) {
    return (
      <main className="p-10">
        <div className="text-verisum-grey">Authorising…</div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="p-10">
        <div className="text-verisum-grey">Loading…</div>
      </main>
    );
  }

  if (error || !runId) {
    return (
      <AppShell>
        <div className="p-4 md:p-6 lg:p-10 space-y-3">
          <h1 className="text-2xl font-bold">Survey Dashboard</h1>
          <div className="text-verisum-red">{error || "Missing runId"}</div>
        </div>
      </AppShell>
    );
  }

  const dashboardHref = `/dashboard/${runId}`;
  const surveyLinks = invites.map((i) => `${window.location.origin}/survey/${i.token}`).join("\n");
  const pendingInvites = invites.filter((i) => !i.used_at);
  const pendingFilterValues = {
    team: Array.from(new Set(invites.map((i) => i.team).filter((v) => v && String(v).trim()))).sort(),
    level: Array.from(new Set(invites.map((i) => i.level).filter((v) => v && String(v).trim()))).sort(),
    location: Array.from(new Set(invites.map((i) => i.location).filter((v) => v && String(v).trim()))).sort(),
  };
  const filteredPendingInvites =
    pendingFilterType === "all" || !pendingFilterValue
      ? pendingInvites
      : pendingInvites.filter(
          (i) => (i as any)[pendingFilterType] && (i as any)[pendingFilterType] === pendingFilterValue
        );
  const pendingLinks = filteredPendingInvites
  .map((i) => `${window.location.origin}/survey/${i.token}`)
  .join("\n");
  const adminUrl = `${window.location.origin}/admin/run/${runId}`;
  const resultsUrl = `${window.location.origin}${dashboardHref}`;
  const linkPack = `Survey Dashboard: ${adminUrl}\nResults: ${resultsUrl}\n\nSurvey links:\n${surveyLinks}`;

  const formatCounts = (items: Array<string | null | undefined>) => {
    const counts = new Map<string, number>();
    items.forEach((item) => {
      const key = typeof item === "string" ? item.trim() : "";
      if (!key) return;
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    const entries = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
    return entries.length ? entries.map(([value, count]) => `${value} (${count})`).join(", ") : "—";
  };

  const downloadLinkPack = () => {
    const blob = new Blob([linkPack], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trustindex-links-${runId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadResponsesCsv = async () => {
    if (!runId) return;
    setExportStatus(null);
    setExporting(true);
    try {
      let inviteRows: Array<{
        token: string;
        used_at: string | null;
        created_at?: string | null;
        team?: string | null;
        level?: string | null;
        location?: string | null;
      }> = [];

      const { data: invitesWithSeg, error: invitesWithSegErr } = await supabase
        .from("invites")
        .select("token, used_at, created_at, team, level, location")
        .eq("run_id", runId);

      if (invitesWithSegErr) {
        const { data: invitesBasic, error: invitesBasicErr } = await supabase
          .from("invites")
          .select("token, used_at, created_at")
          .eq("run_id", runId);
        if (invitesBasicErr || !invitesBasic) {
          throw new Error(invitesBasicErr?.message || "Could not load invites.");
        }
        inviteRows = invitesBasic;
      } else {
        inviteRows = invitesWithSeg || [];
      }

      const { data: responses, error: responsesErr } = await supabase
        .from("responses")
        .select("run_id, invite_token, question_id, value, created_at")
        .eq("run_id", runId);

      if (responsesErr || !responses) {
        throw new Error(responsesErr?.message || "Could not load responses.");
      }

      let questions: any[] | null = null;
      let questionsErr: any = null;

      const questionsPrompt = await supabase
        .from("questions")
        .select("id, dimension, prompt");
      if (questionsPrompt.error) {
        const questionsQuestion = await supabase
          .from("questions")
          .select("id, dimension, question");
        if (questionsQuestion.error) {
          const questionsText = await supabase
            .from("questions")
            .select("id, dimension, text");
          if (questionsText.error) {
            questionsErr = questionsText.error;
          } else {
            questions = questionsText.data || [];
          }
        } else {
          questions = questionsQuestion.data || [];
        }
      } else {
        questions = questionsPrompt.data || [];
      }

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
      ];
      if (includeSegmentation) {
        header.push("team", "level", "location");
      }
      header.push("question_id", "dimension", "question_text", "value", "response_created_at", "exported_at");

      const lines = [header.join(",")];
      const exportedAt = new Date().toISOString();

      const sorted = [...responses].sort((a, b) =>
        (a.invite_token + a.question_id).localeCompare(b.invite_token + b.question_id)
      );

      sorted.forEach((r) => {
        const invite = inviteByToken.get(r.invite_token);
        const q = questionById.get(r.question_id) as any;
        const questionText = q?.prompt ?? q?.text ?? q?.question ?? "";
        const row = [
          r.run_id,
          run?.title || "",
          run?.mode || "",
          clientSafeExport ? maskToken(r.invite_token) : r.invite_token,
          invite?.used_at ? "true" : "false",
          invite?.created_at || "",
          invite?.used_at || "",
        ];
        if (includeSegmentation) {
          row.push(invite?.team || "", invite?.level || "", invite?.location || "");
        }
        row.push(
          r.question_id,
          q?.dimension || "",
          questionText,
          toCsvValue(r.value),
          r.created_at || "",
          exportedAt
        );
        lines.push(row.map(escapeCsv).join(","));
      });

      const csv = lines.join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const baseName = `trustindex_${runId}_responses`;
      const safeSuffix = clientSafeExport ? "_client_safe" : "";
      const segSuffix = includeSegmentation ? "" : "_no_seg";
      a.download = `${baseName}${safeSuffix}${segSuffix}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setExportStatus("CSV downloaded.");
    } catch (err: any) {
      setExportStatus(err?.message || "Failed to export CSV.");
    } finally {
      setExporting(false);
    }
  };

  const downloadSummaryCsv = async () => {
    if (!runId) return;
    setExportStatus(null);
    setSummaryExporting(true);
    try {
      const { data: trust, error: trustErr } = await supabase
        .from("v_trustindex_scores")
        .select("run_id, overall_mean_1_to_5, trustindex_0_to_100")
        .eq("run_id", runId)
        .maybeSingle();

      if (trustErr || !trust) {
        throw new Error(trustErr?.message || "Could not load trust scores.");
      }

      const { data: counts, error: countsErr } = await supabase
        .from("v_run_response_counts")
        .select("run_id, respondents")
        .eq("run_id", runId)
        .maybeSingle();

      if (countsErr || !counts) {
        throw new Error(countsErr?.message || "Could not load response counts.");
      }

      const { data: dims, error: dimsErr } = await supabase
        .from("v_dimension_scores")
        .select("run_id, dimension, mean_1_to_5, n_answers")
        .eq("run_id", runId);

      if (dimsErr || !dims) {
        throw new Error(dimsErr?.message || "Could not load dimension scores.");
      }

      const lines: string[] = [];
      lines.push(
        [
          "run_id",
          "run_title",
          "mode",
          "respondents",
          "overall_mean_1_to_5",
          "trustindex_0_to_100",
        ].join(",")
      );
      lines.push(
        [
          trust.run_id,
          run?.title || "",
          run?.mode || "",
          counts.respondents ?? "",
          trust.overall_mean_1_to_5 ?? "",
          trust.trustindex_0_to_100 ?? "",
        ]
          .map(escapeCsv)
          .join(",")
      );
      lines.push("");
      lines.push(
        ["run_id", "dimension", "mean_1_to_5", "score_0_to_100", "n_answers"].join(",")
      );

      dims.forEach((d) => {
        const mean = Number(d.mean_1_to_5);
        const score = Math.round(((mean - 1) / 4) * 100 * 10) / 10;
        lines.push(
          [
            d.run_id,
            d.dimension,
            d.mean_1_to_5 ?? "",
            Number.isFinite(score) ? score : "",
            d.n_answers ?? "",
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
      const baseName = `trustindex_${runId}_summary`;
      const safeSuffix = clientSafeExport ? "_client_safe" : "";
      const segSuffix = includeSegmentation ? "" : "_no_seg";
      a.download = `${baseName}${safeSuffix}${segSuffix}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setExportStatus("Summary CSV downloaded.");
    } catch (err: any) {
      setExportStatus(err?.message || "Failed to export summary CSV.");
    } finally {
      setSummaryExporting(false);
    }
  };

  return (
    <AppShell>
      <div className="p-4 md:p-6 lg:p-10 space-y-6">
        <h1 className="text-2xl md:text-3xl font-bold">Survey Dashboard</h1>

      <div className="border border-verisum-grey rounded-lg p-6 space-y-2">
        <div>
          <span className="font-semibold">Survey:</span> {run?.title}
        </div>
        <div>
          <span className="font-semibold">Mode:</span>{" "}
          {run?.mode === "org" ? "Organisational" : "Explorer (self-assessment)"}
        </div>
        <div className="break-words">
          <span className="font-semibold">Survey ID:</span> <span className="font-mono">{runId}</span>
        </div>
        {adminCode && (
          <div>
            <div className="break-words">
              <span className="font-semibold">Admin Code:</span> <span className="font-mono">{adminCode}</span>
            </div>
            <div className="text-xs text-verisum-grey mt-1">
              Safely save this admin code. It cannot be recovered. Do not share it.
            </div>
          </div>
        )}
        <div>
          <span className="font-semibold">Admin Instructions:</span>{" "}
          From this dashboard you can:
          <ul className="list-disc pl-5 mt-1 space-y-0.5 text-sm">
            <li>Share survey links and track participation</li>
            <li>View live results as responses arrive</li>
            <li>Return at any time using your admin code</li>
            <li>Create additional surveys when needed</li>
          </ul>
        </div>
      </div>

      <div className="border border-verisum-grey rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">
            Your surveys
          </h2>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={rememberDevice}
                onChange={(e) => {
                  const newValue = e.target.checked;
                  setRememberDevice(newValue);
                  try {
                    localStorage.setItem("ti_remember_device", newValue ? "1" : "0");
                    
                    // Migrate history when preference changes
                    if (newValue) {
                      // Migrate from sessionStorage to localStorage
                      const migrated = migrateHistory(sessionStorage, localStorage);
                      setRecentRuns(migrated ?? []);
                    } else {
                      // Migrate from localStorage to sessionStorage
                      const migrated = migrateHistory(localStorage, sessionStorage);
                      setRecentRuns(migrated ?? []);
                    }
                  } catch {
                    // Ignore errors
                  }
                }}
                className="rounded"
              />
              <span>Remember this device</span>
            </label>
            {recentRuns.length > 0 && (
              <button
                className="text-xs text-verisum-grey underline"
                onClick={() => {
                  clearHistory();
                  setRecentRuns([]);
                }}
              >
                Clear history
              </button>
            )}
          </div>
        </div>
          <div className="text-xs text-verisum-grey">
            If enabled, your surveys will be available on this device after you close your browser.
          </div>

        {recentRuns.length > 0 && (

          <div className="space-y-3">
            {recentRuns.map((r) => {
              const isCurrentRun = r.runId === runId;
              return (
                <div key={r.runId} className="border border-verisum-grey rounded p-4 space-y-2">
                  <div className="font-semibold text-verisum-black">{r.title}</div>
                  <div className="text-xs text-verisum-grey">
                    {r.mode === "org" ? "Organisational" : "Explorer"} ·{" "}
                    {new Date(r.createdAtISO).toLocaleDateString()}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {isCurrentRun ? (
                      <button
                        className="px-3 py-2 border border-verisum-grey rounded text-sm opacity-50 cursor-not-allowed bg-[#f5f5f5]"
                        disabled
                        title="You're already viewing the Survey Dashboard for this survey"
                      >
                        Open Survey Dashboard
                      </button>
                    ) : (
                      <a className="px-3 py-2 border border-verisum-grey rounded hover:bg-[#f5f5f5] text-sm" href={`/admin/run/${r.runId}`}>
                        Open Survey Dashboard
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="border border-verisum-grey rounded-lg p-6 space-y-4">
        <h2 className="text-xl font-semibold">
          {run?.mode === "explorer" ? "Download your responses (CSV)" : "Export data (CSV)"}
        </h2>
        <div className="space-y-3">
          <label className="flex items-start gap-3 text-sm text-verisum-grey">
            <input
              type="checkbox"
              className="mt-1"
              checked={clientSafeExport}
              onChange={(e) => setClientSafeExport(e.target.checked)}
            />
            <span>
              <span className="font-medium">Client-safe export (mask tokens)</span>
              <div className="text-xs text-verisum-grey">
                Masks invite tokens to protect respondent privacy. Use this when sharing externally.
              </div>
            </span>
          </label>
          <label className="flex items-start gap-3 text-sm text-verisum-grey">
            <input
              type="checkbox"
              className="mt-1"
              checked={includeSegmentation}
              onChange={(e) => setIncludeSegmentation(e.target.checked)}
            />
            <span>
              <span className="font-medium">Include segmentation (team / level / location)</span>
              <div className="text-xs text-verisum-grey">
                Only enable if you’re confident it won’t identify individuals in small teams.
              </div>
            </span>
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="px-3 py-2 border border-verisum-grey rounded hover:bg-[#f5f5f5] text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={downloadResponsesCsv}
            disabled={exporting}
          >
            {exporting ? "Preparing CSV…" : "Download responses CSV"}
          </button>
          <button
            className="px-3 py-2 border border-verisum-grey rounded hover:bg-[#f5f5f5] text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={downloadSummaryCsv}
            disabled={summaryExporting}
          >
            {summaryExporting ? "Preparing summary…" : "Download summary CSV"}
          </button>
        </div>
        {exportStatus && <div className="text-sm text-verisum-grey">{exportStatus}</div>}
      </div>

      {run?.mode === "org" && (
        <div className="border border-verisum-grey rounded-lg p-6 space-y-3">
          <h2 className="text-xl font-semibold">Segmentation summary</h2>
          <div className="text-sm text-verisum-grey">Teams: {formatCounts(invites.map((i) => i.team))}</div>
          <div className="text-sm text-verisum-grey">Levels: {formatCounts(invites.map((i) => i.level))}</div>
          <div className="text-sm text-verisum-grey">Locations: {formatCounts(invites.map((i) => i.location))}</div>
        </div>
      )}


      <div className="border border-verisum-grey rounded-lg p-6 space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Results & progress</h2>
          <div className="text-sm text-verisum-grey">Track progress and manage distribution in one place.</div>
        </div>

        {/* Live progress line */}
        {(() => {
          const responseCount = invites.filter((i) => i.used_at).length;
          const isEarlyState = responseCount < 5;
          
          if (run?.mode === "org") {
            return (
              <>
                <div className="text-base font-medium">
                  {isEarlyState
                    ? `${responseCount} responses so far • Results unlock at 5+ responses`
                    : `${responseCount} responses received • Results available`}
                </div>
                {isEarlyState && (
                  <div className="text-sm text-verisum-grey">
                    Share your survey link below to start collecting responses.
                  </div>
                )}
              </>
            );
          }
          
          return (
            <>
              <div className="text-base font-medium">
                Explorer mode • Results available immediately
              </div>
            </>
          );
        })()}

        {/* Live feel status line */}
        {lastUpdated && (
          <div className="text-xs text-verisum-grey flex items-center gap-2">
            <span>
              Updates every 10 mins. Last updated: {lastUpdated.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}.
            </span>
            <button
              type="button"
              className="text-verisum-blue underline hover:no-underline"
              onClick={() => loadData()}
              disabled={loading}
            >
              Refresh Now
            </button>
          </div>
        )}

        {/* Primary CTA button */}
        <div className="space-y-2">
          <a
            className="inline-block px-5 py-3 rounded bg-verisum-blue text-verisum-white font-semibold hover:bg-[#2a7bb8]"
            href={dashboardHref}
            onClick={() => sessionStorage.setItem(`ti_admin_${runId}`, "1")}
          >
            View results
          </a>
          {(invites.filter((i) => i.used_at).length < 5 && run?.mode === "org") ? (
            <div className="text-xs text-verisum-grey">
              Share your survey link below to start collecting responses.
            </div>
          ) : (
            <div className="text-xs text-verisum-grey">
              View live results and manage survey access below.
            </div>
          )}
        </div>

        {/* Survey links list */}
        <div className="space-y-3 pt-4 border-t border-verisum-grey">
          <div className="font-semibold text-sm">Survey links</div>
          <div className="text-sm text-verisum-grey">
          Completed: {invites.filter((i) => i.used_at).length} · Pending:{" "}
          {invites.filter((i) => !i.used_at).length}
        </div>

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

          <div className="text-xs text-verisum-grey">
          Tokens are masked for safety. Each token corresponds to one survey link.
        </div>
        </div>
      </div>

      <div className="border border-verisum-grey rounded-lg p-6 space-y-4">
        <h2 className="text-xl font-semibold">Share, save & chase</h2>

        {run?.mode === "org" && (
          <>
            <div className="text-sm text-verisum-grey">
              Copy links and send one per person (recommended for organisational mode). Use "pending" for reminders.
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="text-xs text-verisum-grey">Filter pending by</label>
                <select
                  className="mt-1 w-full border border-verisum-grey rounded px-3 py-2 text-sm"
                  value={pendingFilterType}
                  onChange={(e) => {
                    setPendingFilterType(e.target.value as "all" | "team" | "level" | "location");
                    setPendingFilterValue("");
                  }}
                >
                  <option value="all">All</option>
                  <option value="team">Team</option>
                  <option value="level">Level</option>
                  <option value="location">Location</option>
                </select>
              </div>
              {pendingFilterType !== "all" && (
                <div>
                  <label className="text-xs text-verisum-grey">Value</label>
                  <select
                    className="mt-1 w-full border border-verisum-grey rounded px-3 py-2 text-sm"
                    value={pendingFilterValue}
                    onChange={(e) => setPendingFilterValue(e.target.value)}
                  >
                    <option value="">All</option>
                    {pendingFilterValues[pendingFilterType]
                      .filter((v): v is string => typeof v === "string" && v.length > 0)
                      .map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                  </select>
                </div>
              )}
        </div>

            <div className="flex flex-wrap gap-2">
              <button
                className="px-3 py-2 border border-verisum-grey rounded hover:bg-[#f5f5f5] text-sm"
                onClick={() => copyText("Pending links copied", pendingLinks)}
              >
                Copy pending links
              </button>

              <a
                className="px-3 py-2 border border-verisum-grey rounded hover:bg-[#f5f5f5] text-sm inline-block"
                href={
                  "mailto:?" +
                  "subject=" +
                  encodeURIComponent(`Reminder: ${run?.title || "TrustIndex survey"}`) +
                  "&body=" +
                  encodeURIComponent(
                    `Hi,\n\nQuick reminder to complete the TrustIndex survey using your personal link below:\n\n` +
                      pendingLinks +
                      `\n\nThank you.`
                  )
                }
              >
                Open reminder email (pending only)
              </a>
            </div>
          </>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            className="px-3 py-2 border border-verisum-grey rounded hover:bg-[#f5f5f5] text-sm"
            onClick={() => copyText("All survey links copied", surveyLinks)}
          >
            Copy all survey links
          </button>

          <button
            className="px-3 py-2 border border-verisum-grey rounded hover:bg-[#f5f5f5] text-sm"
            onClick={downloadLinkPack}
          >
            Download link pack (.txt)
          </button>

          <a
            className="px-3 py-2 border border-verisum-grey rounded hover:bg-[#f5f5f5] text-sm inline-block"
            href={
              "mailto:?" +
              "subject=" +
              encodeURIComponent(`TrustIndex links – ${run?.title || "Survey"}`) +
              "&body=" +
              encodeURIComponent(
                `${linkPack}\n\nAdmin code: [Your admin code - save this from when you created the survey]`
              )
            }
          >
            Email links & code to myself
          </a>

          {invites.length > 0 && (
            <>
              <div className="text-xs text-verisum-grey w-full">
                Do not forward. If you are taking the survey yourself, use this link.
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <a
                  className="px-3 py-2 border border-verisum-grey rounded hover:bg-[#f5f5f5] text-sm inline-block"
                  href={`/survey/${invites[0].token}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open Your Survey
                </a>
                <button
                  className="px-3 py-2 border border-verisum-grey rounded hover:bg-[#f5f5f5] text-sm"
                  onClick={() => {
                    const firstLink = `${window.location.origin}/survey/${invites[0].token}`;
                    copyText("Your survey link copied", firstLink);
                  }}
                >
                  Copy Your Survey Link
                </button>
                {(() => {
                  const responseCount = invites.filter((i) => i.used_at).length;
                  let statusLabel = "";
                  if (responseCount === 0) {
                    statusLabel = "Not started";
                  } else if (responseCount < 5) {
                    statusLabel = "In progress";
                  } else {
                    statusLabel = "Results available";
                  }
                  return (
                    <span className="text-xs text-verisum-grey">
                      {statusLabel}
                    </span>
                  );
                })()}
              </div>
            </>
          )}
        </div>

        {copied && <div className="text-sm text-verisum-green">{copied}</div>}
      </div>

        <a className="text-verisum-blue underline" href="/admin/new-run">
          Create another survey
        </a>
      </div>
    </AppShell>
  );
}
