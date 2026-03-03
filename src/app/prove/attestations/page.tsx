"use client";

import { useCallback, useEffect, useState } from "react";
import TierGate from "@/components/TierGate";

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

export default function AttestationsPage() {
  const [attestations, setAttestations] = useState<Attestation[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState("");
  const [statement, setStatement] = useState("");
  const [page, setPage] = useState(1);
  const [copiedId, setCopiedId] = useState<string | null>(null);
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
    try {
      const res = await fetch("/api/prove/attestations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), statement: statement.trim() }),
      });
      if (res.ok) {
        setTitle("");
        setStatement("");
        setShowForm(false);
        setPage(1);
        await fetchAttestations();
      }
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-brand/10 text-brand">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 21h14M12 17V9m-3 8h6l1-4H8l1 4zM9 9a3 3 0 116 0" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-semibold">Attestations</h1>
              <p className="text-sm text-muted-foreground">Build and issue signed governance attestations</p>
            </div>
          </div>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-brand text-white hover:bg-brand/90 transition-colors"
            >
              New Attestation
            </button>
          )}
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

        {/* Content */}
        {loading ? (
          <div className="text-sm text-muted-foreground py-8 text-center">Loading attestations...</div>
        ) : attestations.length === 0 ? (
          <div className="border border-dashed border-border rounded-xl p-12 text-center">
            <p className="text-sm text-muted-foreground">No attestations issued yet</p>
          </div>
        ) : (
          <>
            <div className="border border-border rounded-lg overflow-hidden">
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
                    <tr key={att.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">{new Date(att.attested_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3 font-medium">{att.title}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="font-mono text-xs bg-muted/50 px-1.5 py-0.5 rounded">
                            {att.verification_id}
                          </span>
                          <button
                            onClick={() => copyVerificationId(att.verification_id)}
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
      </div>
    </TierGate>
  );
}
