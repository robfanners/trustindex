"use client";

import { useCallback, useEffect, useState } from "react";
import TierGate from "@/components/TierGate";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import DetailPanel from "@/components/ui/DetailPanel";
import OnboardingTour from "@/components/ui/OnboardingTour";
import { showActionToast } from "@/components/ui/Toast";

type Attestation = {
  id: string;
  organisation_id: string;
  title: string;
  statement: string;
  posture_snapshot: unknown;
  attested_by: string;
  attested_at: string;
  verification_id: string;
  event_hash: string;
  chain_tx_hash: string | null;
  chain_status: string;
  created_at: string;
};

const chainStatusBadge: Record<string, string> = {
  anchored: "bg-green-100 text-green-800",
  skipped: "bg-gray-100 text-gray-600",
  failed: "bg-red-100 text-red-800",
  pending: "bg-amber-100 text-amber-800",
};

const headerIcon = (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 21h14M12 17V9m-3 8h6l1-4H8l1 4zM9 9a3 3 0 116 0" />
  </svg>
);

const tourSteps = [
  { target: "[data-tour='page-header']", title: "Governance Attestations", content: "Create cryptographically signed governance statements that prove your compliance posture at a point in time." },
  { target: "[data-tour='new-attestation']", title: "Issue an Attestation", content: "Sign a governance statement. It will receive a unique verification ID and event hash." },
  { target: "[data-tour='attestations-table']", title: "Attestation History", content: "Click any row to see the full statement, posture snapshot, and chain status." },
  { target: "[data-tour='workflow-hint']", title: "Share & Verify", content: "Share attestations with third parties via Trust Exchange, who can verify them in the Verification Portal." },
];

export default function AttestationsPage() {
  const [attestations, setAttestations] = useState<Attestation[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [statement, setStatement] = useState("");
  const [page, setPage] = useState(1);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<Attestation | null>(null);
  const perPage = 20;

  const fetchAttestations = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        per_page: String(perPage),
      });
      const res = await fetch(`/api/prove/attestations?${params}`);
      if (res.ok) {
        const data = await res.json();
        setAttestations(data.attestations ?? []);
        setTotal(data.total ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchAttestations();
  }, [fetchAttestations]);

  const handleSubmit = async () => {
    if (!title.trim() || !statement.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/prove/attestations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), statement: statement.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setTitle("");
        setStatement("");
        setShowForm(false);
        setPage(1);
        await fetchAttestations();
        showActionToast("Attestation issued — " + (data.verification_id ?? ""));
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.error || `Failed to issue attestation (${res.status})`);
      }
    } catch {
      setError("Network error — please try again");
    } finally {
      setSubmitting(false);
    }
  };

  const copyVerificationId = async (verificationId: string) => {
    try {
      await navigator.clipboard.writeText(verificationId);
      setCopiedId(verificationId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Clipboard API may not be available
    }
  };

  const totalPages = Math.ceil(total / perPage);

  return (
    <TierGate requiredTier="Verify" featureLabel="Attestations">
      <div className="space-y-6">
        {/* Header */}
        <div data-tour="page-header">
          <PageHeader
            icon={headerIcon}
            title="Attestations"
            description="Governance statements with cryptographic proof — signed declarations of your compliance posture"
            workflowHint={[
              { label: "Attestations", href: "/prove/attestations" },
              { label: "Exchanges", href: "/prove/exchanges" },
              { label: "Verification", href: "/prove/verification" },
            ]}
            actions={
              !showForm ? (
                <button
                  data-tour="new-attestation"
                  onClick={() => setShowForm(true)}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-brand text-white hover:bg-brand/90 transition-colors"
                >
                  New Attestation
                </button>
              ) : undefined
            }
          />
        </div>

        {/* Inline Form */}
        {showForm && (
          <div className="border border-border rounded-lg p-5 space-y-4 bg-muted/50">
            <div className="space-y-1.5">
              <label htmlFor="att-title" className="text-sm font-medium">
                Title
              </label>
              <input
                id="att-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Q1 2026 Governance Compliance"
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="att-statement" className="text-sm font-medium">
                Statement
              </label>
              <textarea
                id="att-statement"
                value={statement}
                onChange={(e) => setStatement(e.target.value)}
                placeholder="Describe the governance attestation in detail..."
                rows={5}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 resize-y"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSubmit}
                disabled={submitting || !title.trim() || !statement.trim()}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-brand text-white hover:bg-brand/90 transition-colors disabled:opacity-40"
              >
                {submitting ? "Issuing..." : "Issue Attestation"}
              </button>
              <button
                onClick={() => {
                  setShowForm(false);
                  setTitle("");
                  setStatement("");
                }}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-border hover:bg-muted/50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
            {error}
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="text-sm text-muted-foreground py-8 text-center">Loading attestations...</div>
        ) : attestations.length === 0 ? (
          <EmptyState
            icon={headerIcon}
            title="No attestations issued yet"
            description="Issue a signed governance attestation to create a verifiable proof of your compliance posture. Attestations can be shared via Trust Exchange."
            ctaLabel="Issue your first attestation"
            ctaAction={() => setShowForm(true)}
          />
        ) : (
          <>
            <div className="border border-border rounded-lg overflow-hidden" data-tour="attestations-table">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Date</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Title</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Verification ID</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Chain Status</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Attested By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {attestations.map((att) => (
                    <tr key={att.id} className="hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => setSelectedItem(att)}>
                      <td className="px-4 py-3">{new Date(att.attested_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3 font-medium">{att.title}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="font-mono text-xs bg-muted/50 px-1.5 py-0.5 rounded">
                            {att.verification_id}
                          </span>
                          <button
                            onClick={(e) => { e.stopPropagation(); copyVerificationId(att.verification_id); }}
                            title="Copy verification ID"
                            className="p-0.5 rounded hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
                          >
                            {copiedId === att.verification_id ? (
                              <svg className="w-3.5 h-3.5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" strokeWidth={1.5} />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                              </svg>
                            )}
                          </button>
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            chainStatusBadge[att.chain_status] ?? "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {att.chain_status.charAt(0).toUpperCase() + att.chain_status.slice(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs font-mono">
                        {att.attested_by.slice(0, 8)}...
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{total} attestations total</span>
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
          subtitle="Attestation"
          actions={
            selectedItem ? (
              <button
                onClick={() => copyVerificationId(selectedItem.verification_id)}
                className="px-3 py-1.5 text-sm font-medium rounded-lg border border-border hover:bg-muted/50 transition-colors"
              >
                {copiedId === selectedItem.verification_id ? "Copied!" : "Copy Verification ID"}
              </button>
            ) : undefined
          }
        >
          {selectedItem && (
            <div className="space-y-4">
              <div>
                <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Statement</dt>
                <dd className="text-sm whitespace-pre-wrap">{selectedItem.statement}</dd>
              </div>

              {selectedItem.posture_snapshot != null && typeof selectedItem.posture_snapshot === "object" ? (
                <div>
                  <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Posture Snapshot</dt>
                  <dd className="text-sm space-y-1">
                    {Object.entries(selectedItem.posture_snapshot as Record<string, unknown>).map(([key, value]) => (
                      <div key={key} className="flex gap-2">
                        <span className="font-medium text-muted-foreground">{key}:</span>
                        <span>{String(value)}</span>
                      </div>
                    ))}
                  </dd>
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Verification ID</dt>
                  <dd className="flex items-center text-sm">
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
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${chainStatusBadge[selectedItem.chain_status] ?? "bg-gray-100 text-gray-600"}`}>
                      {selectedItem.chain_status.charAt(0).toUpperCase() + selectedItem.chain_status.slice(1)}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Attested By</dt>
                  <dd className="text-sm font-mono text-xs">{selectedItem.attested_by}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Created At</dt>
                  <dd className="text-sm">{new Date(selectedItem.created_at).toLocaleString()}</dd>
                </div>
              </div>
            </div>
          )}
        </DetailPanel>

        <OnboardingTour tourId="attestations" steps={tourSteps} />
      </div>
    </TierGate>
  );
}
