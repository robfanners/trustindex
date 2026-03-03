"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Assessment = {
  id: string;
  name: string;
  version_label: string | null;
  type: string | null;
  environment: string | null;
  created_at: string;
  latest_score: number | null;
  latest_status: string | null;
  stability_status: string;
  run_count: number;
  has_in_progress: boolean;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function scoreBadgeClass(score: number | null): string {
  if (score === null) return "bg-gray-100 text-gray-600";
  if (score >= 70) return "bg-green-100 text-green-800";
  if (score >= 40) return "bg-amber-100 text-amber-800";
  return "bg-red-100 text-red-800";
}

function envBadgeClass(env: string | null): string {
  if (!env) return "bg-gray-100 text-gray-600";
  const lower = env.toLowerCase();
  if (lower === "production" || lower === "prod") return "bg-blue-100 text-blue-800";
  if (lower === "staging") return "bg-amber-100 text-amber-800";
  if (lower === "pilot") return "bg-teal-100 text-teal-800";
  return "bg-gray-100 text-gray-600";
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatType(type: string | null): string {
  if (!type) return "Unknown";
  return type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatEnv(env: string | null): string {
  if (!env) return "Unknown";
  if (env.toLowerCase() === "prod") return "Production";
  return env.charAt(0).toUpperCase() + env.slice(1);
}

// ---------------------------------------------------------------------------
// Score band filter logic
// ---------------------------------------------------------------------------

type ScoreBand = "all" | "good" | "moderate" | "attention" | "unassessed";

function matchesScoreBand(score: number | null, band: ScoreBand): boolean {
  if (band === "all") return true;
  if (band === "unassessed") return score === null;
  if (score === null) return false;
  if (band === "good") return score >= 70;
  if (band === "moderate") return score >= 40 && score < 70;
  if (band === "attention") return score < 40;
  return true;
}

// ---------------------------------------------------------------------------
// AI Registry page
// ---------------------------------------------------------------------------

export default function AIRegistryPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [envFilter, setEnvFilter] = useState<string>("");
  const [scoreBand, setScoreBand] = useState<ScoreBand>("all");

  // Pagination
  const [page, setPage] = useState(1);
  const perPage = 20;

  // Fetch assessments
  const fetchAssessments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/trustsys/assessments");
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to load assessments");
      }
      const d = await res.json();
      setAssessments(d.assessments ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load assessments");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAssessments();
  }, [fetchAssessments]);

  // Unique types and environments for filter dropdowns
  const uniqueTypes = useMemo(() => {
    const types = new Set<string>();
    for (const a of assessments) {
      if (a.type) types.add(a.type);
    }
    return Array.from(types).sort();
  }, [assessments]);

  const uniqueEnvs = useMemo(() => {
    const envs = new Set<string>();
    for (const a of assessments) {
      if (a.environment) envs.add(a.environment);
    }
    return Array.from(envs).sort();
  }, [assessments]);

  // Client-side filtered list
  const filtered = useMemo(() => {
    return assessments.filter((a) => {
      if (typeFilter && a.type !== typeFilter) return false;
      if (envFilter && a.environment !== envFilter) return false;
      if (!matchesScoreBand(a.latest_score, scoreBand)) return false;
      return true;
    });
  }, [assessments, typeFilter, envFilter, scoreBand]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paginated = useMemo(() => {
    const start = (page - 1) * perPage;
    return filtered.slice(start, start + perPage);
  }, [filtered, page]);

  // Summary stats
  const totalSystems = assessments.length;
  const assessed = assessments.filter((a) => a.latest_score !== null);
  const assessedCount = assessed.length;
  const avgScore =
    assessedCount > 0
      ? Math.round(assessed.reduce((sum, a) => sum + (a.latest_score ?? 0), 0) / assessedCount)
      : null;
  const envCount = uniqueEnvs.length;

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [typeFilter, envFilter, scoreBand]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-brand/10 text-brand">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <rect x="2" y="3" width="20" height="8" rx="2" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="7" cy="7" r="1" fill="currentColor" stroke="none" />
            <circle cx="11" cy="7" r="1" fill="currentColor" stroke="none" />
            <rect x="2" y="13" width="20" height="8" rx="2" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="7" cy="17" r="1" fill="currentColor" stroke="none" />
            <circle cx="11" cy="17" r="1" fill="currentColor" stroke="none" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-semibold">AI Registry</h1>
          <p className="text-sm text-muted-foreground">
            Governance inventory of all registered AI systems
          </p>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
          <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          Loading AI systems...
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="text-sm text-destructive py-4">{error}</div>
      )}

      {/* Content */}
      {!loading && !error && (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="border border-border rounded-xl p-4">
              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                Total Systems
              </div>
              <div className="text-2xl font-semibold mt-1">{totalSystems}</div>
            </div>
            <div className="border border-border rounded-xl p-4">
              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                Assessed
              </div>
              <div className="text-2xl font-semibold mt-1">{assessedCount}</div>
            </div>
            <div className="border border-border rounded-xl p-4">
              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                Average Score
              </div>
              <div className="text-2xl font-semibold mt-1">
                {avgScore !== null ? avgScore : <span className="text-muted-foreground">&mdash;</span>}
              </div>
            </div>
            <div className="border border-border rounded-xl p-4">
              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                Environments
              </div>
              <div className="text-2xl font-semibold mt-1">{envCount}</div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-border bg-background text-sm"
            >
              <option value="">All types</option>
              {uniqueTypes.map((t) => (
                <option key={t} value={t}>
                  {formatType(t)}
                </option>
              ))}
            </select>
            <select
              value={envFilter}
              onChange={(e) => setEnvFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-border bg-background text-sm"
            >
              <option value="">All environments</option>
              {uniqueEnvs.map((e) => (
                <option key={e} value={e}>
                  {formatEnv(e)}
                </option>
              ))}
            </select>
            <select
              value={scoreBand}
              onChange={(e) => setScoreBand(e.target.value as ScoreBand)}
              className="px-3 py-1.5 rounded-lg border border-border bg-background text-sm"
            >
              <option value="all">All scores</option>
              <option value="good">Good (&ge;70)</option>
              <option value="moderate">Moderate (40-69)</option>
              <option value="attention">Needs Attention (&lt;40)</option>
              <option value="unassessed">Unassessed</option>
            </select>
          </div>

          {/* Empty state */}
          {assessments.length === 0 ? (
            <div className="border border-dashed border-border rounded-xl p-12 text-center">
              <div className="flex justify-center mb-4 text-muted-foreground">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <rect x="2" y="3" width="20" height="8" rx="2" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="7" cy="7" r="1" fill="currentColor" stroke="none" />
                  <circle cx="11" cy="7" r="1" fill="currentColor" stroke="none" />
                  <rect x="2" y="13" width="20" height="8" rx="2" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="7" cy="17" r="1" fill="currentColor" stroke="none" />
                  <circle cx="11" cy="17" r="1" fill="currentColor" stroke="none" />
                </svg>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                No AI systems registered yet. Register systems through TrustSys to begin
                tracking their governance posture.
              </p>
              <Link
                href="/trustsys"
                className="inline-flex items-center gap-1 text-sm text-brand hover:text-brand/80 font-medium transition-colors"
              >
                Go to TrustSys
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          ) : filtered.length === 0 ? (
            <div className="border border-dashed border-border rounded-xl p-12 text-center">
              <p className="text-sm text-muted-foreground">
                No systems match the current filters.
              </p>
            </div>
          ) : (
            <>
              {/* Table */}
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                        System
                      </th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                        Type
                      </th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                        Environment
                      </th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                        Score
                      </th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                        Status
                      </th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                        Runs
                      </th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                        Last Assessed
                      </th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {paginated.map((a) => (
                      <tr key={a.id} className="hover:bg-muted/30 transition-colors">
                        {/* System name + version */}
                        <td className="px-4 py-3">
                          <div className="font-medium text-foreground">{a.name}</div>
                          {a.version_label && (
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {a.version_label}
                            </div>
                          )}
                        </td>

                        {/* Type */}
                        <td className="px-4 py-3">
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                            {formatType(a.type)}
                          </span>
                        </td>

                        {/* Environment */}
                        <td className="px-4 py-3">
                          <span
                            className={`text-xs font-medium px-2 py-0.5 rounded-full ${envBadgeClass(a.environment)}`}
                          >
                            {formatEnv(a.environment)}
                          </span>
                        </td>

                        {/* Score */}
                        <td className="px-4 py-3">
                          <span
                            className={`text-xs font-medium px-2 py-0.5 rounded-full ${scoreBadgeClass(a.latest_score)}`}
                          >
                            {a.latest_score !== null ? a.latest_score : "\u2014"}
                          </span>
                        </td>

                        {/* Stability status */}
                        <td className="px-4 py-3">
                          <span className="text-xs text-muted-foreground capitalize">
                            {a.stability_status.replace(/_/g, " ")}
                          </span>
                        </td>

                        {/* Runs */}
                        <td className="px-4 py-3 text-muted-foreground">{a.run_count}</td>

                        {/* Last Assessed */}
                        <td className="px-4 py-3 text-muted-foreground">
                          {a.run_count > 0 ? formatDate(a.created_at) : "Never"}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3">
                          <Link
                            href="/trustsys"
                            className="text-xs text-brand hover:text-brand/80 font-medium transition-colors"
                          >
                            Assess &rarr;
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {filtered.length} system{filtered.length !== 1 ? "s" : ""} total
                  </span>
                  <div className="flex gap-2">
                    <button
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                      className="px-3 py-1 rounded border border-border disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <span className="px-3 py-1 text-muted-foreground">
                      Page {page} of {totalPages}
                    </span>
                    <button
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                      className="px-3 py-1 rounded border border-border disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
