"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import TierGate from "@/components/TierGate";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import DetailPanel from "@/components/ui/DetailPanel";
import { showActionToast } from "@/components/ui/Toast";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Model = {
  id: string;
  organisation_id: string;
  model_name: string;
  model_version: string;
  provider: string | null;
  model_type: string | null;
  capabilities: string[] | null;
  training_data_sources: string[] | null;
  deployment_date: string | null;
  retired_date: string | null;
  status: string;
  parent_model_id: string | null;
  model_card_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  linked_systems_count: number;
};

type LineageNode = {
  id: string;
  model_name: string;
  model_version: string;
  provider: string | null;
  model_type: string | null;
  status: string;
};

type LinkedSystem = {
  system_id: string;
  role: string;
  systems: { id: string; name: string } | null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_COLOURS: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  evaluating: "bg-amber-100 text-amber-800",
  retired: "bg-gray-100 text-gray-600",
};

const TYPE_COLOURS: Record<string, string> = {
  foundation: "bg-blue-100 text-blue-800",
  fine_tuned: "bg-purple-100 text-purple-800",
  custom: "bg-indigo-100 text-indigo-800",
  rag: "bg-teal-100 text-teal-800",
  agent: "bg-orange-100 text-orange-800",
  other: "bg-gray-100 text-gray-600",
};

const ROLE_COLOURS: Record<string, string> = {
  primary: "bg-blue-100 text-blue-800",
  fallback: "bg-amber-100 text-amber-800",
  evaluation: "bg-purple-100 text-purple-800",
  component: "bg-gray-100 text-gray-600",
};

function formatType(type: string | null): string {
  if (!type) return "Unknown";
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const headerIcon = (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3v2m6-2v2M9 19v2m6-2v2M3 9h2m-2 6h2m14-6h2m-2 6h2M7 7h10v10H7V7z" />
  </svg>
);

// ---------------------------------------------------------------------------
// Model Registry Page
// ---------------------------------------------------------------------------

export default function ModelRegistryPage() {
  const [models, setModels] = useState<Model[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");

  // Pagination
  const [page, setPage] = useState(1);
  const perPage = 50;

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    model_name: "",
    model_version: "",
    provider: "",
    model_type: "",
    deployment_date: "",
    model_card_url: "",
    notes: "",
    capabilities: "",
    training_data_sources: "",
  });

  // Detail panel
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);
  const [detailTab, setDetailTab] = useState<"details" | "lineage" | "systems">("details");
  const [lineage, setLineage] = useState<{ ancestors: LineageNode[]; current: LineageNode; children: LineageNode[] } | null>(null);
  const [linkedSystems, setLinkedSystems] = useState<LinkedSystem[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Link system state
  const [showLinkSystem, setShowLinkSystem] = useState(false);
  const [availableSystems, setAvailableSystems] = useState<{ id: string; name: string }[]>([]);
  const [linkSystemId, setLinkSystemId] = useState("");
  const [linkRole, setLinkRole] = useState("primary");
  const [linking, setLinking] = useState(false);

  // Fetch models
  const fetchModels = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), per_page: String(perPage) });
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/model-registry?${params}`);
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to load models");
      }
      const d = await res.json();
      setModels(d.models ?? []);
      setTotal(d.total ?? 0);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load models");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  // Fetch detail data
  useEffect(() => {
    if (!selectedModel) return;
    setDetailLoading(true);
    Promise.allSettled([
      fetch(`/api/model-registry/${selectedModel.id}/lineage`).then((r) => r.ok ? r.json() : null),
      fetch(`/api/model-registry/${selectedModel.id}`).then((r) => r.ok ? r.json() : null),
    ]).then(([lineageRes, detailRes]) => {
      if (lineageRes.status === "fulfilled" && lineageRes.value) {
        setLineage(lineageRes.value.data ?? null);
      }
      if (detailRes.status === "fulfilled" && detailRes.value?.data?.linked_systems) {
        setLinkedSystems(detailRes.value.data.linked_systems ?? []);
      }
      setDetailLoading(false);
    });
  }, [selectedModel]);

  // Fetch available systems for linking
  const fetchAvailableSystems = useCallback(async () => {
    try {
      const res = await fetch("/api/systems");
      if (res.ok) {
        const d = await res.json();
        setAvailableSystems((d.data ?? d) as { id: string; name: string }[]);
      }
    } catch { /* ignore */ }
  }, []);

  // Refresh linked systems for selected model
  const refreshLinkedSystems = useCallback(async () => {
    if (!selectedModel) return;
    const res = await fetch(`/api/model-registry/${selectedModel.id}`);
    if (res.ok) {
      const d = await res.json();
      setLinkedSystems(d.data?.linked_systems ?? []);
    }
  }, [selectedModel]);

  // Link a system to the selected model
  const handleLinkSystem = async () => {
    if (!selectedModel || !linkSystemId) return;
    setLinking(true);
    try {
      const res = await fetch("/api/model-registry/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ system_id: linkSystemId, model_id: selectedModel.id, role: linkRole }),
      });
      if (!res.ok) {
        const d = await res.json();
        showActionToast(d.error || "Failed to link");
      } else {
        showActionToast("System linked");
        setShowLinkSystem(false);
        setLinkSystemId("");
        setLinkRole("primary");
        await refreshLinkedSystems();
        fetchModels();
      }
    } catch { showActionToast("Failed to link system"); }
    finally { setLinking(false); }
  };

  // Unlink a system from the selected model
  const handleUnlinkSystem = async (systemId: string) => {
    if (!selectedModel) return;
    try {
      const res = await fetch("/api/model-registry/links", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ system_id: systemId, model_id: selectedModel.id }),
      });
      if (res.ok) {
        showActionToast("System unlinked");
        await refreshLinkedSystems();
        fetchModels();
      }
    } catch { showActionToast("Failed to unlink"); }
  };

  // Create model
  const handleSubmit = async () => {
    if (!formData.model_name.trim() || !formData.model_version.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        model_name: formData.model_name.trim(),
        model_version: formData.model_version.trim(),
      };
      if (formData.provider) body.provider = formData.provider.trim();
      if (formData.model_type) body.model_type = formData.model_type;
      if (formData.deployment_date) body.deployment_date = formData.deployment_date;
      if (formData.model_card_url) body.model_card_url = formData.model_card_url.trim();
      if (formData.notes) body.notes = formData.notes.trim();
      if (formData.capabilities) {
        body.capabilities = formData.capabilities.split(",").map((s) => s.trim()).filter(Boolean);
      }
      if (formData.training_data_sources) {
        body.training_data_sources = formData.training_data_sources.split(",").map((s) => s.trim()).filter(Boolean);
      }

      const res = await fetch("/api/model-registry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setFormData({ model_name: "", model_version: "", provider: "", model_type: "", deployment_date: "", model_card_url: "", notes: "", capabilities: "", training_data_sources: "" });
        setShowForm(false);
        await fetchModels();
        showActionToast("Model registered");
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "Failed to register model");
      }
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  // Filter logic
  const uniqueTypes = useMemo(() => {
    const types = new Set<string>();
    for (const m of models) {
      if (m.model_type) types.add(m.model_type);
    }
    return Array.from(types).sort();
  }, [models]);

  const filtered = useMemo(() => {
    return models.filter((m) => {
      if (typeFilter && m.model_type !== typeFilter) return false;
      return true;
    });
  }, [models, typeFilter]);

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  // Summary stats
  const activeCount = models.filter((m) => m.status === "active").length;
  const evaluatingCount = models.filter((m) => m.status === "evaluating").length;
  const retiredCount = models.filter((m) => m.status === "retired").length;

  useEffect(() => { setPage(1); }, [statusFilter, typeFilter]);

  return (
    <TierGate requiredTier="Assure" featureLabel="Model Registry">
      <div className="space-y-6">
        {/* Header */}
        <PageHeader
          icon={headerIcon}
          title="Model Registry"
          description="Track AI models, versions, lineage, and provenance across your systems"
          actions={
            !showForm ? (
              <button
                onClick={() => setShowForm(true)}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-brand text-white hover:bg-brand/90 transition-colors"
              >
                Register Model
              </button>
            ) : undefined
          }
        />

        {/* Inline Form */}
        {showForm && (
          <div className="border border-border rounded-lg p-5 space-y-4 bg-muted/50">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="m-name" className="text-sm font-medium">Model Name *</label>
                <input id="m-name" type="text" value={formData.model_name} onChange={(e) => setFormData({ ...formData, model_name: e.target.value })} placeholder="e.g. GPT-4o" className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-brand/30" />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="m-version" className="text-sm font-medium">Version *</label>
                <input id="m-version" type="text" value={formData.model_version} onChange={(e) => setFormData({ ...formData, model_version: e.target.value })} placeholder="e.g. gpt-4o-2024-05-13" className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-brand/30" />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="m-provider" className="text-sm font-medium">Provider</label>
                <input id="m-provider" type="text" value={formData.provider} onChange={(e) => setFormData({ ...formData, provider: e.target.value })} placeholder="e.g. OpenAI" className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-brand/30" />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="m-type" className="text-sm font-medium">Type</label>
                <select id="m-type" value={formData.model_type} onChange={(e) => setFormData({ ...formData, model_type: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm">
                  <option value="">Select type</option>
                  <option value="foundation">Foundation</option>
                  <option value="fine_tuned">Fine-Tuned</option>
                  <option value="custom">Custom</option>
                  <option value="rag">RAG</option>
                  <option value="agent">Agent</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="m-deploy" className="text-sm font-medium">Deployment Date</label>
                <input id="m-deploy" type="date" value={formData.deployment_date} onChange={(e) => setFormData({ ...formData, deployment_date: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-brand/30" />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="m-url" className="text-sm font-medium">Model Card URL</label>
                <input id="m-url" type="text" value={formData.model_card_url} onChange={(e) => setFormData({ ...formData, model_card_url: e.target.value })} placeholder="https://..." className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-brand/30" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="m-caps" className="text-sm font-medium">Capabilities</label>
              <input id="m-caps" type="text" value={formData.capabilities} onChange={(e) => setFormData({ ...formData, capabilities: e.target.value })} placeholder="text_generation, code_generation, vision (comma-separated)" className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-brand/30" />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="m-training" className="text-sm font-medium">Training Data Sources</label>
              <input id="m-training" type="text" value={formData.training_data_sources} onChange={(e) => setFormData({ ...formData, training_data_sources: e.target.value })} placeholder="public_web, internal_docs, curated_dataset (comma-separated)" className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-brand/30" />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="m-notes" className="text-sm font-medium">Notes</label>
              <textarea id="m-notes" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={2} placeholder="Additional details..." className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 resize-y" />
            </div>
            <div className="flex gap-2">
              <button onClick={handleSubmit} disabled={submitting || !formData.model_name.trim() || !formData.model_version.trim()} className="px-4 py-2 text-sm font-medium rounded-lg bg-brand text-white hover:bg-brand/90 transition-colors disabled:opacity-40">
                {submitting ? "Registering..." : "Register Model"}
              </button>
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm font-medium rounded-lg border border-border hover:bg-muted/50 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">{error}</div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
            <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
            Loading model registry...
          </div>
        ) : models.length === 0 ? (
          <EmptyState
            icon={headerIcon}
            title="No models registered yet"
            description="Register your AI models to track provenance, lineage, and link them to system assessments."
            ctaLabel="Register your first model"
            ctaAction={() => setShowForm(true)}
          />
        ) : (
          <>
            {/* Summary stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="border border-border rounded-xl p-4">
                <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Total Models</div>
                <div className="text-2xl font-semibold mt-1">{models.length}</div>
              </div>
              <div className="border border-border rounded-xl p-4">
                <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Active</div>
                <div className="text-2xl font-semibold mt-1 text-green-700">{activeCount}</div>
              </div>
              <div className="border border-border rounded-xl p-4">
                <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Evaluating</div>
                <div className="text-2xl font-semibold mt-1 text-amber-700">{evaluatingCount}</div>
              </div>
              <div className="border border-border rounded-xl p-4">
                <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Retired</div>
                <div className="text-2xl font-semibold mt-1">{retiredCount}</div>
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3">
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-1.5 rounded-lg border border-border bg-background text-sm">
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="evaluating">Evaluating</option>
                <option value="retired">Retired</option>
              </select>
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="px-3 py-1.5 rounded-lg border border-border bg-background text-sm">
                <option value="">All types</option>
                {uniqueTypes.map((t) => (
                  <option key={t} value={t}>{formatType(t)}</option>
                ))}
              </select>
            </div>

            {/* Table */}
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Model</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Provider</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Type</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Status</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Systems</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Deployed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((m) => (
                    <tr
                      key={m.id}
                      className="hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => { setSelectedModel(m); setLineage(null); setLinkedSystems([]); setDetailTab("details"); }}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{m.model_name}</div>
                        <div className="text-xs text-muted-foreground font-mono mt-0.5">{m.model_version}</div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{m.provider ?? "\u2014"}</td>
                      <td className="px-4 py-3">
                        {m.model_type ? (
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TYPE_COLOURS[m.model_type] ?? "bg-gray-100 text-gray-600"}`}>
                            {formatType(m.model_type)}
                          </span>
                        ) : <span className="text-xs text-muted-foreground">&mdash;</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLOURS[m.status] ?? "bg-gray-100 text-gray-600"}`}>
                          {m.status.charAt(0).toUpperCase() + m.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{m.linked_systems_count}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {m.deployment_date ? formatDate(m.deployment_date) : "\u2014"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{total} model{total !== 1 ? "s" : ""} total</span>
                <div className="flex gap-2">
                  <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1 rounded border border-border disabled:opacity-40">Previous</button>
                  <span className="px-3 py-1 text-muted-foreground">Page {page} of {totalPages}</span>
                  <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1 rounded border border-border disabled:opacity-40">Next</button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Detail Panel */}
        <DetailPanel
          open={!!selectedModel}
          onClose={() => setSelectedModel(null)}
          title={selectedModel?.model_name ?? ""}
          subtitle={selectedModel?.model_version ?? ""}
          badge={
            selectedModel ? (
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLOURS[selectedModel.status] ?? "bg-gray-100 text-gray-600"}`}>
                {selectedModel.status.charAt(0).toUpperCase() + selectedModel.status.slice(1)}
              </span>
            ) : undefined
          }
          actions={
            selectedModel?.model_card_url ? (
              <a
                href={selectedModel.model_card_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-border hover:bg-muted/50 transition-colors"
              >
                View Model Card
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            ) : undefined
          }
        >
          {selectedModel && (
            <div className="space-y-5">
              {/* Tabs */}
              <div className="flex gap-1 border-b border-border">
                {(["details", "lineage", "systems"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setDetailTab(tab)}
                    className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors capitalize ${
                      detailTab === tab
                        ? "border-brand text-brand"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {detailLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                  <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                  Loading...
                </div>
              ) : detailTab === "details" ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Provider</dt>
                      <dd className="text-sm">{selectedModel.provider ?? "\u2014"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Type</dt>
                      <dd>
                        {selectedModel.model_type ? (
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TYPE_COLOURS[selectedModel.model_type] ?? "bg-gray-100 text-gray-600"}`}>
                            {formatType(selectedModel.model_type)}
                          </span>
                        ) : "\u2014"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Deployment Date</dt>
                      <dd className="text-sm">{selectedModel.deployment_date ? formatDate(selectedModel.deployment_date) : "\u2014"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Linked Systems</dt>
                      <dd className="text-sm">{selectedModel.linked_systems_count}</dd>
                    </div>
                  </div>

                  {selectedModel.capabilities && selectedModel.capabilities.length > 0 && (
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Capabilities</dt>
                      <dd className="flex flex-wrap gap-1">
                        {selectedModel.capabilities.map((cap) => (
                          <span key={cap} className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">{cap}</span>
                        ))}
                      </dd>
                    </div>
                  )}

                  {selectedModel.training_data_sources && selectedModel.training_data_sources.length > 0 && (
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Training Data Sources</dt>
                      <dd className="flex flex-wrap gap-1">
                        {selectedModel.training_data_sources.map((src) => (
                          <span key={src} className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">{src}</span>
                        ))}
                      </dd>
                    </div>
                  )}

                  {selectedModel.notes && (
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Notes</dt>
                      <dd className="text-sm whitespace-pre-wrap">{selectedModel.notes}</dd>
                    </div>
                  )}
                </div>
              ) : detailTab === "lineage" ? (
                <div className="space-y-3">
                  {lineage ? (
                    <div className="space-y-2">
                      {lineage.ancestors.length === 0 && lineage.children.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No lineage — this model has no parent or children.</p>
                      ) : (
                        <>
                          {/* Ancestors */}
                          {lineage.ancestors.map((node, i) => (
                            <div key={node.id} className="flex items-center gap-2">
                              <div className="text-xs text-muted-foreground w-6 text-right">{i === 0 ? "Base" : ""}</div>
                              <div className="border border-border rounded-lg p-2 flex-1 opacity-60">
                                <div className="text-sm font-medium">{node.model_name}</div>
                                <div className="text-xs text-muted-foreground font-mono">{node.model_version}</div>
                              </div>
                            </div>
                          ))}
                          {lineage.ancestors.length > 0 && (
                            <div className="flex items-center gap-2 pl-8">
                              <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                              </svg>
                            </div>
                          )}
                          {/* Current */}
                          <div className="flex items-center gap-2">
                            <div className="text-xs text-brand font-medium w-6 text-right">You</div>
                            <div className="border-2 border-brand rounded-lg p-2 flex-1 bg-brand/5">
                              <div className="text-sm font-medium">{lineage.current.model_name}</div>
                              <div className="text-xs text-muted-foreground font-mono">{lineage.current.model_version}</div>
                            </div>
                          </div>
                          {/* Children */}
                          {lineage.children.length > 0 && (
                            <div className="flex items-center gap-2 pl-8">
                              <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                              </svg>
                            </div>
                          )}
                          {lineage.children.map((node) => (
                            <div key={node.id} className="flex items-center gap-2">
                              <div className="text-xs text-muted-foreground w-6 text-right" />
                              <div className="border border-border rounded-lg p-2 flex-1 opacity-60">
                                <div className="text-sm font-medium">{node.model_name}</div>
                                <div className="text-xs text-muted-foreground font-mono">{node.model_version}</div>
                              </div>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Loading lineage...</p>
                  )}
                </div>
              ) : (
                /* Systems tab */
                <div className="space-y-3">
                  {/* Link System button */}
                  <div className="flex justify-end">
                    <button
                      onClick={() => { setShowLinkSystem(!showLinkSystem); if (!showLinkSystem) fetchAvailableSystems(); }}
                      className="text-xs font-medium text-brand hover:text-brand-hover transition-colors"
                    >
                      {showLinkSystem ? "Cancel" : "+ Link System"}
                    </button>
                  </div>

                  {/* Link form */}
                  {showLinkSystem && (
                    <div className="border border-brand/30 rounded-lg p-3 space-y-2 bg-brand/5">
                      <select
                        value={linkSystemId}
                        onChange={(e) => setLinkSystemId(e.target.value)}
                        className="w-full text-sm border border-border rounded px-2 py-1.5 bg-white"
                      >
                        <option value="">Select a system...</option>
                        {availableSystems
                          .filter((s) => !linkedSystems.some((ls) => ls.system_id === s.id))
                          .map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
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
                        onClick={handleLinkSystem}
                        disabled={!linkSystemId || linking}
                        className="w-full text-xs font-medium px-3 py-1.5 rounded bg-brand text-white hover:bg-brand-hover disabled:opacity-50 transition-colors"
                      >
                        {linking ? "Linking..." : "Link System"}
                      </button>
                    </div>
                  )}

                  {linkedSystems.length === 0 && !showLinkSystem ? (
                    <p className="text-sm text-muted-foreground">This model is not linked to any systems yet. Click <span className="font-medium text-brand">+ Link System</span> above to connect it.</p>
                  ) : (
                    linkedSystems.map((link) => (
                      <div key={link.system_id} className="border border-border rounded-lg p-3 flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium">{link.systems?.name ?? link.system_id}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ROLE_COLOURS[link.role] ?? "bg-gray-100 text-gray-600"}`}>
                            {link.role}
                          </span>
                          <button
                            onClick={() => handleUnlinkSystem(link.system_id)}
                            className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                            title="Unlink system"
                          >
                            &times;
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </DetailPanel>
      </div>
    </TierGate>
  );
}
