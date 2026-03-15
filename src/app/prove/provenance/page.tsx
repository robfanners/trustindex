"use client";

import { useCallback, useEffect, useState } from "react";
import TierGate from "@/components/TierGate";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import DetailPanel from "@/components/ui/DetailPanel";
import OnboardingTour from "@/components/ui/OnboardingTour";
import { showActionToast } from "@/components/ui/Toast";

type ProvenanceRecord = {
  id: string;
  organisation_id: string;
  title: string;
  ai_system: string | null;
  model_version: string | null;
  output_description: string | null;
  data_sources: string[] | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  verification_id: string;
  event_hash: string;
  chain_tx_hash: string | null;
  chain_status: string;
  created_at: string;
};

const chainBadge: Record<string, string> = {
  anchored: "bg-green-100 text-green-800",
  skipped: "bg-gray-100 text-gray-600",
  failed: "bg-red-100 text-red-800",
  pending: "bg-amber-100 text-amber-800",
};

const headerIcon = (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
  </svg>
);

const tourSteps = [
  { target: "[data-tour='page-header']", title: "Provenance Certificates", content: "Record chain-of-custody for AI outputs covering data sources, model versions, and human review trails." },
  { target: "[data-tour='new-certificate']", title: "Record a Certificate", content: "Document the lineage of an AI output to create a verifiable provenance trail." },
  { target: "[data-tour='provenance-table']", title: "Certificate History", content: "Click any row to see the full provenance details including data sources and review notes." },
];

export default function ProvenancePage() {
  const [records, setRecords] = useState<ProvenanceRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const perPage = 20;

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [aiSystem, setAiSystem] = useState("");
  const [modelVersion, setModelVersion] = useState("");
  const [outputDescription, setOutputDescription] = useState("");
  const [dataSources, setDataSources] = useState("");
  const [reviewNote, setReviewNote] = useState("");

  // Clipboard feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Detail panel state
  const [selectedItem, setSelectedItem] = useState<ProvenanceRecord | null>(null);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        per_page: String(perPage),
      });
      const res = await fetch(`/api/prove/provenance?${params}`);
      if (res.ok) {
        const data = await res.json();
        setRecords(data.records ?? []);
        setTotal(data.total ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const resetForm = () => {
    setFormTitle("");
    setAiSystem("");
    setModelVersion("");
    setOutputDescription("");
    setDataSources("");
    setReviewNote("");
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/prove/provenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formTitle.trim(),
          ai_system: aiSystem.trim() || undefined,
          model_version: modelVersion.trim() || undefined,
          output_description: outputDescription.trim() || undefined,
          data_sources: dataSources.trim() || undefined,
          review_note: reviewNote.trim() || undefined,
        }),
      });
      if (res.ok) {
        resetForm();
        setPage(1);
        await fetchRecords();
        showActionToast("Provenance certificate created");
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.error || `Failed to issue certificate (${res.status})`);
      }
    } catch {
      setError("Network error — please try again");
    } finally {
      setSubmitting(false);
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // Clipboard API may fail in some contexts
    }
  };

  const totalPages = Math.ceil(total / perPage);

  return (
    <TierGate requiredTier="Verify" featureLabel="Provenance Certificates">
      <div className="space-y-6">
        {/* Header */}
        <div data-tour="page-header">
          <PageHeader
            icon={headerIcon}
            title="Provenance Certificates"
            description="Chain-of-custody records for AI outputs — documenting data sources, model versions, and review trails"
            workflowHint={[
              { label: "Provenance", href: "/prove/provenance" },
              { label: "Exchanges", href: "/prove/exchanges" },
              { label: "Verification", href: "/prove/verification" },
            ]}
            actions={
              !showForm ? (
                <button
                  data-tour="new-certificate"
                  onClick={() => setShowForm(true)}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-brand text-white hover:bg-brand/90 transition-colors"
                >
                  New Certificate
                </button>
              ) : undefined
            }
          />
        </div>

        {/* Inline Form */}
        {showForm && (
          <form onSubmit={handleSubmit} className="border border-border rounded-lg p-5 space-y-4 bg-muted/50">
            <div>
              <label className="block text-sm font-medium mb-1">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                required
                placeholder="e.g. Q1 Risk Assessment Output"
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">AI System</label>
                <input
                  type="text"
                  value={aiSystem}
                  onChange={(e) => setAiSystem(e.target.value)}
                  placeholder="e.g. GPT-4o, Claude 3.5"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Model Version</label>
                <input
                  type="text"
                  value={modelVersion}
                  onChange={(e) => setModelVersion(e.target.value)}
                  placeholder="e.g. gpt-4o-2024-05-13"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Output Description</label>
              <textarea
                value={outputDescription}
                onChange={(e) => setOutputDescription(e.target.value)}
                rows={2}
                placeholder="Describe the AI output being certified..."
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Data Sources</label>
              <input
                type="text"
                value={dataSources}
                onChange={(e) => setDataSources(e.target.value)}
                placeholder="Comma-separated, e.g. internal-db, vendor-api, public-dataset"
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Review Note</label>
              <textarea
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                rows={2}
                placeholder="Optional reviewer comments..."
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm resize-none"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={submitting || !formTitle.trim()}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-brand text-white hover:bg-brand/90 transition-colors disabled:opacity-40"
              >
                {submitting ? "Issuing..." : "Issue Certificate"}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-border hover:bg-muted/50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
            {error}
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="text-sm text-muted-foreground py-8 text-center">Loading provenance certificates...</div>
        ) : records.length === 0 ? (
          <EmptyState
            icon={headerIcon}
            title="No provenance certificates yet"
            description="Record the lineage of an AI output to create a verifiable chain-of-custody trail covering data sources, model version, and human review."
            ctaLabel="Record your first certificate"
            ctaAction={() => setShowForm(true)}
          />
        ) : (
          <>
            <div className="border border-border rounded-lg overflow-hidden" data-tour="provenance-table">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Date</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Title</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">AI System</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Verification ID</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Chain Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {records.map((rec) => (
                    <tr key={rec.id} className="hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => setSelectedItem(rec)}>
                      <td className="px-4 py-3">{new Date(rec.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3 font-medium">{rec.title}</td>
                      <td className="px-4 py-3 text-muted-foreground">{rec.ai_system || "\u2014"}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5">
                          <code className="font-mono text-xs bg-muted/50 px-1.5 py-0.5 rounded">{rec.verification_id}</code>
                          <button
                            onClick={(e) => { e.stopPropagation(); copyToClipboard(rec.verification_id, rec.id); }}
                            className="p-0.5 rounded hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
                            title="Copy verification ID"
                          >
                            {copiedId === rec.id ? (
                              <svg className="w-3.5 h-3.5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <rect x="9" y="9" width="13" height="13" rx="2" strokeWidth={2} />
                                <path strokeWidth={2} d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                              </svg>
                            )}
                          </button>
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            chainBadge[rec.chain_status] ?? "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {rec.chain_status.charAt(0).toUpperCase() + rec.chain_status.slice(1)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{total} certificates total</span>
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

        {/* Detail Panel */}
        <DetailPanel
          open={!!selectedItem}
          onClose={() => setSelectedItem(null)}
          title={selectedItem?.title ?? ""}
          subtitle={selectedItem ? [selectedItem.ai_system, selectedItem.model_version].filter(Boolean).join(" ") || "Provenance Certificate" : ""}
          actions={
            selectedItem ? (
              <button
                onClick={() => copyToClipboard(selectedItem.verification_id, "panel")}
                className="px-3 py-1.5 text-sm font-medium rounded-lg border border-border hover:bg-muted/50 transition-colors"
              >
                {copiedId === "panel" ? "Copied!" : "Copy Verification ID"}
              </button>
            ) : undefined
          }
        >
          {selectedItem && (
            <div className="space-y-4">
              {selectedItem.output_description && (
                <div>
                  <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Output Description</dt>
                  <dd className="text-sm">{selectedItem.output_description}</dd>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                {selectedItem.ai_system && (
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">AI System</dt>
                    <dd className="text-sm">{selectedItem.ai_system}</dd>
                  </div>
                )}
                {selectedItem.model_version && (
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Model Version</dt>
                    <dd className="text-sm font-mono text-xs">{selectedItem.model_version}</dd>
                  </div>
                )}
              </div>

              {selectedItem.data_sources && selectedItem.data_sources.length > 0 && (
                <div>
                  <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Data Sources</dt>
                  <dd>
                    <ul className="list-disc list-inside text-sm space-y-0.5">
                      {selectedItem.data_sources.map((src, i) => (
                        <li key={i}>{src}</li>
                      ))}
                    </ul>
                  </dd>
                </div>
              )}

              {selectedItem.review_note && (
                <div>
                  <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Review Note</dt>
                  <dd className="text-sm">{selectedItem.review_note}</dd>
                </div>
              )}

              {selectedItem.reviewed_by && (
                <div>
                  <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Reviewed By</dt>
                  <dd className="text-sm font-mono text-xs">{selectedItem.reviewed_by}</dd>
                </div>
              )}

              <div className="border-t border-border pt-4 grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Verification ID</dt>
                  <dd className="text-sm">
                    <code className="font-mono text-xs bg-muted/50 px-2 py-0.5 rounded">{selectedItem.verification_id}</code>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Event Hash</dt>
                  <dd className="text-sm font-mono text-xs" title={selectedItem.event_hash}>
                    {selectedItem.event_hash.slice(0, 16)}...
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Chain Status</dt>
                  <dd>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${chainBadge[selectedItem.chain_status] ?? "bg-gray-100 text-gray-600"}`}>
                      {selectedItem.chain_status.charAt(0).toUpperCase() + selectedItem.chain_status.slice(1)}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Created At</dt>
                  <dd className="text-sm">{new Date(selectedItem.created_at).toLocaleString()}</dd>
                </div>
              </div>
            </div>
          )}
        </DetailPanel>

        <OnboardingTour tourId="provenance" steps={tourSteps} />
      </div>
    </TierGate>
  );
}
