"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import DetailPanel from "@/components/ui/DetailPanel";
import { showActionToast } from "@/components/ui/Toast";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RiskSystem = {
  id: string;
  name: string;
  version_label: string | null;
  type: string | null;
  environment: string | null;
  risk_category: string | null;
  owner_name: string | null;
  owner_role: string | null;
  compliance_tags: string[] | null;
  ai_vendor_id: string | null;
  ai_vendors: { vendor_name: string; risk_category: string } | null;
  created_at: string;
  archived: boolean;
  trust_score: number | null;
  risk_flags: string[];
  last_assessed: string | null;
  open_incidents: number;
};

type ComplianceRequirement = {
  id: string;
  requirement_id: string;
  risk_categories: string[];
  name: string;
  description: string;
  compliance_status: {
    requirement_id: string;
    system_id: string;
    status: string;
    notes: string | null;
    assessed_at: string | null;
  } | null;
};

type LinkedModel = {
  id: string;
  model_name: string;
  model_version: string;
  provider: string | null;
  status: string | null;
  model_type: string | null;
  linked_systems_count: number;
};

type DecisionItem = {
  id: string;
  human_decision: string | null;
  decision_status: string;
  reviewed_at: string | null;
  ai_outputs: { output_summary: string; output_type: string | null } | null;
  profiles: { full_name: string } | null;
  policy_versions: { title: string; version: number } | null;
};

type EvidenceSummary = {
  system_id: string;
  system_name: string;
  period_days: number;
  completeness_score: number;
  total_evidence: number;
  categories: Record<string, {
    pass: number;
    fail: number;
    warning: number;
    total: number;
    items: { type: string; title: string; url: string | null; status: string; collected_at: string }[];
  }>;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const RISK_COLOURS: Record<string, string> = {
  minimal: "bg-green-100 text-green-800",
  limited: "bg-amber-100 text-amber-800",
  high: "bg-red-100 text-red-800",
  unacceptable: "bg-red-200 text-red-900",
};

const COMPLIANCE_COLOURS: Record<string, string> = {
  compliant: "bg-green-100 text-green-800",
  partially_compliant: "bg-amber-100 text-amber-800",
  non_compliant: "bg-red-100 text-red-800",
  not_applicable: "bg-gray-100 text-gray-600",
  not_assessed: "bg-gray-100 text-gray-600",
};

function scoreBadgeClass(score: number | null): string {
  if (score === null) return "bg-gray-100 text-gray-600";
  if (score >= 70) return "bg-green-100 text-green-800";
  if (score >= 40) return "bg-amber-100 text-amber-800";
  return "bg-red-100 text-red-800";
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
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatStatus(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

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
// AI Risk Registry page
// ---------------------------------------------------------------------------

export default function AIRegistryPage() {
  const [systems, setSystems] = useState<RiskSystem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [riskFilter, setRiskFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [scoreBand, setScoreBand] = useState<ScoreBand>("all");

  // Pagination
  const [page, setPage] = useState(1);
  const perPage = 20;

  // Detail panel
  const [selectedSystem, setSelectedSystem] = useState<RiskSystem | null>(null);
  const [compliance, setCompliance] = useState<ComplianceRequirement[]>([]);
  const [evidence, setEvidence] = useState<EvidenceSummary | null>(null);
  const [models, setModels] = useState<LinkedModel[]>([]);
  const [decisions, setDecisions] = useState<DecisionItem[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState<"compliance" | "evidence" | "models" | "decisions">("compliance");
  const [savingCompliance, setSavingCompliance] = useState<string | null>(null);

  // Link model state
  const [showLinkModel, setShowLinkModel] = useState(false);
  const [availableModels, setAvailableModels] = useState<{ id: string; model_name: string; model_version: string }[]>([]);
  const [linkModelId, setLinkModelId] = useState("");
  const [linkRole, setLinkRole] = useState("primary");
  const [linkingModel, setLinkingModel] = useState(false);

  // Fetch systems from risk-registry API
  const fetchSystems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/risk-registry");
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to load risk registry");
      }
      const d = await res.json();
      setSystems(d.data ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load risk registry");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSystems();
  }, [fetchSystems]);

  // Fetch detail data when a system is selected
  useEffect(() => {
    if (!selectedSystem) return;
    setDetailLoading(true);
    Promise.allSettled([
      fetch(`/api/risk-registry/${selectedSystem.id}/compliance`).then((r) =>
        r.ok ? r.json() : null
      ),
      fetch(`/api/risk-registry/${selectedSystem.id}/evidence`).then((r) =>
        r.ok ? r.json() : null
      ),
      fetch(`/api/model-registry?system_id=${selectedSystem.id}`).then((r) =>
        r.ok ? r.json() : null
      ),
      fetch(`/api/happ/systems/${selectedSystem.id}/decisions?per_page=10`).then((r) =>
        r.ok ? r.json() : null
      ),
    ]).then(([compRes, evRes, modRes, decRes]) => {
      if (compRes.status === "fulfilled" && compRes.value) {
        setCompliance(compRes.value.data ?? []);
      }
      if (evRes.status === "fulfilled" && evRes.value) {
        setEvidence(evRes.value.data ?? null);
      }
      if (modRes.status === "fulfilled" && modRes.value) {
        setModels(modRes.value.models ?? []);
      }
      if (decRes.status === "fulfilled" && decRes.value) {
        setDecisions(decRes.value.records ?? []);
      }
      setDetailLoading(false);
    });
  }, [selectedSystem]);

  // Fetch available models for linking
  const fetchAvailableModels = useCallback(async () => {
    try {
      const res = await fetch("/api/model-registry?per_page=100");
      if (res.ok) {
        const d = await res.json();
        setAvailableModels(d.models ?? []);
      }
    } catch { /* ignore */ }
  }, []);

  // Refresh linked models for selected system
  const refreshLinkedModels = useCallback(async () => {
    if (!selectedSystem) return;
    const res = await fetch(`/api/model-registry?system_id=${selectedSystem.id}`);
    if (res.ok) {
      const d = await res.json();
      setModels(d.models ?? []);
    }
  }, [selectedSystem]);

  // Link a model to the selected system
  const handleLinkModel = async () => {
    if (!selectedSystem || !linkModelId) return;
    setLinkingModel(true);
    try {
      const res = await fetch("/api/model-registry/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ system_id: selectedSystem.id, model_id: linkModelId, role: linkRole }),
      });
      if (!res.ok) {
        const d = await res.json();
        showActionToast(d.error || "Failed to link");
      } else {
        showActionToast("Model linked");
        setShowLinkModel(false);
        setLinkModelId("");
        setLinkRole("primary");
        await refreshLinkedModels();
      }
    } catch { showActionToast("Failed to link model"); }
    finally { setLinkingModel(false); }
  };

  // Unlink a model from the selected system
  const handleUnlinkModel = async (modelId: string) => {
    if (!selectedSystem) return;
    try {
      const res = await fetch("/api/model-registry/links", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ system_id: selectedSystem.id, model_id: modelId }),
      });
      if (res.ok) {
        showActionToast("Model unlinked");
        await refreshLinkedModels();
      }
    } catch { showActionToast("Failed to unlink"); }
  };

  // Update compliance status
  const updateComplianceStatus = async (requirementId: string, status: string) => {
    if (!selectedSystem) return;
    setSavingCompliance(requirementId);
    try {
      const res = await fetch(`/api/risk-registry/${selectedSystem.id}/compliance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requirement_id: requirementId, status }),
      });
      if (res.ok) {
        setCompliance((prev) =>
          prev.map((c) =>
            c.requirement_id === requirementId
              ? {
                  ...c,
                  compliance_status: {
                    requirement_id: requirementId,
                    system_id: selectedSystem.id,
                    status,
                    notes: c.compliance_status?.notes ?? null,
                    assessed_at: new Date().toISOString(),
                  },
                }
              : c
          )
        );
      }
    } finally {
      setSavingCompliance(null);
    }
  };

  // Filter logic
  const uniqueTypes = useMemo(() => {
    const types = new Set<string>();
    for (const s of systems) {
      if (s.type) types.add(s.type);
    }
    return Array.from(types).sort();
  }, [systems]);

  const uniqueRisks = useMemo(() => {
    const risks = new Set<string>();
    for (const s of systems) {
      if (s.risk_category) risks.add(s.risk_category);
    }
    return Array.from(risks).sort();
  }, [systems]);

  const filtered = useMemo(() => {
    return systems.filter((s) => {
      if (riskFilter && s.risk_category !== riskFilter) return false;
      if (typeFilter && s.type !== typeFilter) return false;
      if (!matchesScoreBand(s.trust_score, scoreBand)) return false;
      return true;
    });
  }, [systems, riskFilter, typeFilter, scoreBand]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paginated = useMemo(() => {
    const start = (page - 1) * perPage;
    return filtered.slice(start, start + perPage);
  }, [filtered, page]);

  // Summary stats
  const totalSystems = systems.length;
  const assessed = systems.filter((s) => s.trust_score !== null);
  const avgScore =
    assessed.length > 0
      ? Math.round(assessed.reduce((sum, s) => sum + (s.trust_score ?? 0), 0) / assessed.length)
      : null;
  const totalIncidents = systems.reduce((sum, s) => sum + s.open_incidents, 0);
  const highRiskCount = systems.filter(
    (s) => s.risk_category === "high" || s.risk_category === "unacceptable"
  ).length;

  useEffect(() => {
    setPage(1);
  }, [riskFilter, typeFilter, scoreBand]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-brand/10 text-brand">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">AI Risk Registry</h1>
          <p className="text-sm text-muted-foreground">
            Systems with risk classification, compliance status, and live evidence
          </p>
        </div>
        <Link
          href="/trustsys"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand/90 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Register System
        </Link>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
          <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          Loading risk registry...
        </div>
      )}

      {error && <div className="text-sm text-destructive py-4">{error}</div>}

      {!loading && !error && (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="border border-border rounded-xl p-4">
              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Total Systems</div>
              <div className="text-2xl font-semibold mt-1">{totalSystems}</div>
            </div>
            <div className="border border-border rounded-xl p-4">
              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Avg Trust Score</div>
              <div className="text-2xl font-semibold mt-1">
                {avgScore !== null ? avgScore : <span className="text-muted-foreground">&mdash;</span>}
              </div>
            </div>
            <div className="border border-border rounded-xl p-4">
              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">High Risk</div>
              <div className={`text-2xl font-semibold mt-1 ${highRiskCount > 0 ? "text-red-600" : ""}`}>
                {highRiskCount}
              </div>
            </div>
            <div className="border border-border rounded-xl p-4">
              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Open Incidents</div>
              <div className={`text-2xl font-semibold mt-1 ${totalIncidents > 0 ? "text-amber-600" : ""}`}>
                {totalIncidents}
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-border bg-background text-sm"
            >
              <option value="">All risk levels</option>
              {uniqueRisks.map((r) => (
                <option key={r} value={r}>{formatType(r)}</option>
              ))}
            </select>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-border bg-background text-sm"
            >
              <option value="">All types</option>
              {uniqueTypes.map((t) => (
                <option key={t} value={t}>{formatType(t)}</option>
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
          {systems.length === 0 ? (
            <div className="border border-dashed border-border rounded-xl p-12 text-center">
              <p className="text-sm text-muted-foreground mb-3">
                No AI systems registered yet. Register your first system to begin tracking risk.
              </p>
              <Link
                href="/trustsys"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand/90 transition-colors"
              >
                Register System
              </Link>
            </div>
          ) : filtered.length === 0 ? (
            <div className="border border-dashed border-border rounded-xl p-12 text-center">
              <p className="text-sm text-muted-foreground">No systems match the current filters.</p>
            </div>
          ) : (
            <>
              {/* Table */}
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">System</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Risk Level</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Trust Score</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Vendor</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Owner</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Incidents</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Last Assessed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {paginated.map((s) => (
                      <tr
                        key={s.id}
                        className="hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => {
                          setSelectedSystem(s);
                          setCompliance([]);
                          setEvidence(null);
                          setModels([]);
                          setDecisions([]);
                          setDetailTab("compliance");
                        }}
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium text-foreground">{s.name}</div>
                          {s.version_label && (
                            <div className="text-xs text-muted-foreground mt-0.5">{s.version_label}</div>
                          )}
                          {s.type && (
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 mt-1 inline-block">
                              {formatType(s.type)}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {s.risk_category ? (
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${RISK_COLOURS[s.risk_category] ?? "bg-gray-100 text-gray-600"}`}>
                              {formatType(s.risk_category)}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">&mdash;</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${scoreBadgeClass(s.trust_score)}`}>
                            {s.trust_score !== null ? s.trust_score : "\u2014"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {s.ai_vendors?.vendor_name ?? <span className="text-xs">&mdash;</span>}
                        </td>
                        <td className="px-4 py-3">
                          {s.owner_name ? (
                            <div>
                              <div className="text-sm">{s.owner_name}</div>
                              {s.owner_role && <div className="text-xs text-muted-foreground">{s.owner_role}</div>}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">&mdash;</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {s.open_incidents > 0 ? (
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-800">
                              {s.open_incidents}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">0</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">
                          {s.last_assessed ? formatDate(s.last_assessed) : "Never"}
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

      {/* Detail Panel — Compliance & Evidence */}
      <DetailPanel
        open={!!selectedSystem}
        onClose={() => setSelectedSystem(null)}
        title={selectedSystem?.name ?? ""}
        subtitle="Risk Registry"
        badge={
          selectedSystem?.risk_category ? (
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${RISK_COLOURS[selectedSystem.risk_category] ?? "bg-gray-100 text-gray-600"}`}>
              {formatType(selectedSystem.risk_category)}
            </span>
          ) : undefined
        }
      >
        {selectedSystem && (
          <div className="space-y-5">
            {/* System info summary */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Trust Score</dt>
                <dd>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${scoreBadgeClass(selectedSystem.trust_score)}`}>
                    {selectedSystem.trust_score ?? "\u2014"}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Vendor</dt>
                <dd className="text-sm">{selectedSystem.ai_vendors?.vendor_name ?? "\u2014"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Owner</dt>
                <dd className="text-sm">
                  {selectedSystem.owner_name ?? "\u2014"}
                  {selectedSystem.owner_role && <span className="text-xs text-muted-foreground ml-1">({selectedSystem.owner_role})</span>}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Open Incidents</dt>
                <dd className="text-sm">{selectedSystem.open_incidents}</dd>
              </div>
            </div>

            {/* Compliance tags */}
            {selectedSystem.compliance_tags && selectedSystem.compliance_tags.length > 0 && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Compliance Tags</dt>
                <dd className="flex flex-wrap gap-1">
                  {selectedSystem.compliance_tags.map((tag) => (
                    <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">{tag}</span>
                  ))}
                </dd>
              </div>
            )}

            {/* Tabs */}
            <div className="flex gap-1 border-b border-border">
              <button
                onClick={() => setDetailTab("compliance")}
                className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                  detailTab === "compliance"
                    ? "border-brand text-brand"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                Compliance
              </button>
              <button
                onClick={() => setDetailTab("evidence")}
                className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                  detailTab === "evidence"
                    ? "border-brand text-brand"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                Evidence
              </button>
              <button
                onClick={() => setDetailTab("models")}
                className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                  detailTab === "models"
                    ? "border-brand text-brand"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                Models
              </button>
              <button
                onClick={() => setDetailTab("decisions")}
                className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                  detailTab === "decisions"
                    ? "border-brand text-brand"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                Decisions
              </button>
            </div>

            {detailLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                Loading...
              </div>
            ) : detailTab === "decisions" ? (
              /* Decision records */
              <div className="space-y-3">
                {decisions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No decisions recorded. <Link href="/prove/decisions" className="text-brand hover:underline">Go to Decision Ledger</Link> to record decisions.
                  </p>
                ) : (
                  decisions.map((d) => (
                    <div key={d.id} className="border border-border rounded-lg p-3 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{d.ai_outputs?.output_summary ?? "\u2014"}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {d.profiles?.full_name ?? "Unknown"}{d.policy_versions ? ` \u00B7 ${d.policy_versions.title} v${d.policy_versions.version}` : ""}
                          </div>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          {d.human_decision && (
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                              d.human_decision === "approved" ? "bg-green-100 text-green-800" :
                              d.human_decision === "rejected" ? "bg-red-100 text-red-800" :
                              d.human_decision === "escalated" ? "bg-amber-100 text-amber-800" :
                              "bg-blue-100 text-blue-800"
                            }`}>
                              {d.human_decision.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                            </span>
                          )}
                        </div>
                      </div>
                      {d.reviewed_at && (
                        <div className="text-xs text-muted-foreground">{formatDate(d.reviewed_at)}</div>
                      )}
                    </div>
                  ))
                )}
              </div>
            ) : detailTab === "models" ? (
              /* Linked models */
              <div className="space-y-3">
                {/* Link Model button */}
                <div className="flex justify-end">
                  <button
                    onClick={() => { setShowLinkModel(!showLinkModel); if (!showLinkModel) fetchAvailableModels(); }}
                    className="text-xs font-medium text-brand hover:text-brand-hover transition-colors"
                  >
                    {showLinkModel ? "Cancel" : "+ Link Model"}
                  </button>
                </div>

                {/* Link form */}
                {showLinkModel && (
                  <div className="border border-brand/30 rounded-lg p-3 space-y-2 bg-brand/5">
                    <select
                      value={linkModelId}
                      onChange={(e) => setLinkModelId(e.target.value)}
                      className="w-full text-sm border border-border rounded px-2 py-1.5 bg-white"
                    >
                      <option value="">Select a model...</option>
                      {availableModels
                        .filter((am) => !models.some((m) => m.id === am.id))
                        .map((am) => <option key={am.id} value={am.id}>{am.model_name} ({am.model_version})</option>)}
                    </select>
                    <select
                      value={linkRole}
                      onChange={(e) => setLinkRole(e.target.value)}
                      className="w-full text-sm border border-border rounded px-2 py-1.5 bg-white"
                    >
                      <option value="primary">Primary</option>
                      <option value="fallback">Fallback</option>
                      <option value="evaluation">Evaluation</option>
                      <option value="component">Component</option>
                    </select>
                    <button
                      onClick={handleLinkModel}
                      disabled={!linkModelId || linkingModel}
                      className="w-full text-xs font-medium px-3 py-1.5 rounded bg-brand text-white hover:bg-brand-hover disabled:opacity-50 transition-colors"
                    >
                      {linkingModel ? "Linking..." : "Link Model"}
                    </button>
                  </div>
                )}

                {models.length === 0 && !showLinkModel ? (
                  <p className="text-sm text-muted-foreground">
                    No models linked to this system. <Link href="/govern/models" className="text-brand hover:underline">Go to Model Registry</Link> to link models.
                  </p>
                ) : (
                  models.map((m) => (
                    <div key={m.id} className="border border-border rounded-lg p-3 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium">{m.model_name}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {m.model_version}{m.provider ? ` \u00B7 ${m.provider}` : ""}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {m.status && (
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                              m.status === "active" ? "bg-green-100 text-green-800" :
                              m.status === "evaluating" ? "bg-amber-100 text-amber-800" :
                              "bg-gray-100 text-gray-600"
                            }`}>
                              {formatType(m.status)}
                            </span>
                          )}
                          <button
                            onClick={() => handleUnlinkModel(m.id)}
                            className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                            title="Unlink model"
                          >
                            &times;
                          </button>
                        </div>
                      </div>
                      {m.model_type && (
                        <div className="text-xs text-muted-foreground">Type: {formatType(m.model_type)}</div>
                      )}
                    </div>
                  ))
                )}
              </div>
            ) : detailTab === "compliance" ? (
              /* Compliance requirements */
              <div className="space-y-3">
                {compliance.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No compliance requirements mapped for this system&apos;s risk category.
                  </p>
                ) : (
                  compliance.map((c) => (
                    <div key={c.requirement_id} className="border border-border rounded-lg p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium">{c.name}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">{c.description}</div>
                        </div>
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${
                            COMPLIANCE_COLOURS[c.compliance_status?.status ?? "not_assessed"] ?? "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {formatStatus(c.compliance_status?.status ?? "not_assessed")}
                        </span>
                      </div>
                      <select
                        value={c.compliance_status?.status ?? "not_assessed"}
                        onChange={(e) => updateComplianceStatus(c.requirement_id, e.target.value)}
                        disabled={savingCompliance === c.requirement_id}
                        className="px-2 py-1 text-xs rounded border border-border bg-background disabled:opacity-50"
                      >
                        <option value="not_assessed">Not Assessed</option>
                        <option value="compliant">Compliant</option>
                        <option value="partially_compliant">Partially Compliant</option>
                        <option value="non_compliant">Non-Compliant</option>
                        <option value="not_applicable">Not Applicable</option>
                      </select>
                    </div>
                  ))
                )}
              </div>
            ) : (
              /* Evidence summary */
              <div className="space-y-4">
                {!evidence ? (
                  <p className="text-sm text-muted-foreground">No evidence collected yet. Connect GitHub in Settings &rarr; Integrations to start collecting.</p>
                ) : (
                  <>
                    {/* Completeness score */}
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">
                          Evidence Completeness
                        </div>
                        <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              evidence.completeness_score >= 70 ? "bg-green-500" : evidence.completeness_score >= 40 ? "bg-amber-500" : "bg-red-500"
                            }`}
                            style={{ width: `${evidence.completeness_score}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-lg font-semibold">{evidence.completeness_score}%</span>
                    </div>

                    <div className="text-xs text-muted-foreground">
                      {evidence.total_evidence} evidence items collected over {evidence.period_days} days
                    </div>

                    {/* Categories */}
                    {Object.entries(evidence.categories).map(([category, data]) => (
                      <div key={category} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-medium capitalize">{category}</h4>
                          <div className="flex gap-2 text-xs">
                            <span className="text-green-700">{data.pass} pass</span>
                            <span className="text-red-700">{data.fail} fail</span>
                            <span className="text-amber-700">{data.warning} warn</span>
                          </div>
                        </div>
                        {data.items.length > 0 ? (
                          <div className="space-y-1">
                            {data.items.slice(0, 5).map((item, i) => (
                              <div key={i} className="flex items-center gap-2 text-xs">
                                <span className={`w-2 h-2 rounded-full shrink-0 ${
                                  item.status === "pass" ? "bg-green-500" : item.status === "fail" ? "bg-red-500" : "bg-amber-500"
                                }`} />
                                <span className="flex-1 truncate">{item.title}</span>
                                <span className="text-muted-foreground shrink-0">
                                  {formatDate(item.collected_at)}
                                </span>
                              </div>
                            ))}
                            {data.items.length > 5 && (
                              <div className="text-xs text-muted-foreground">
                                +{data.items.length - 5} more
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">No evidence in this category</p>
                        )}
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </DetailPanel>
    </div>
  );
}
