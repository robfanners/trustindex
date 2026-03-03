"use client";

import { useCallback, useEffect, useState } from "react";
import TierGate from "@/components/TierGate";

type Exchange = {
  id: string;
  proof_type: string;
  proof_id: string;
  verification_id: string;
  shared_with_name: string;
  shared_with_email: string | null;
  note: string | null;
  shared_by: string | null;
  shared_at: string;
  created_at: string;
};

type ProofOption = {
  id: string;
  title: string;
  verification_id: string;
};

const proofTypeBadge: Record<string, string> = {
  attestation: "bg-blue-100 text-blue-800",
  provenance: "bg-purple-100 text-purple-800",
  incident_lock: "bg-red-100 text-red-800",
};

const proofTypeLabel: Record<string, string> = {
  attestation: "Attestation",
  provenance: "Provenance",
  incident_lock: "Incident Lock",
};

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function TrustExchangePage() {
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const perPage = 20;

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [proofType, setProofType] = useState("");
  const [proofOptions, setProofOptions] = useState<ProofOption[]>([]);
  const [loadingProofs, setLoadingProofs] = useState(false);
  const [selectedProofId, setSelectedProofId] = useState("");
  const [sharedWithName, setSharedWithName] = useState("");
  const [sharedWithEmail, setSharedWithEmail] = useState("");
  const [note, setNote] = useState("");

  // Clipboard feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchExchanges = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        per_page: String(perPage),
      });
      const res = await fetch(`/api/prove/exchanges?${params}`);
      if (res.ok) {
        const data = await res.json();
        setExchanges(data.exchanges ?? []);
        setTotal(data.total ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchExchanges();
  }, [fetchExchanges]);

  // Fetch proof options when proof type changes
  useEffect(() => {
    if (!proofType) {
      setProofOptions([]);
      setSelectedProofId("");
      return;
    }

    let cancelled = false;

    const fetchProofs = async () => {
      setLoadingProofs(true);
      setProofOptions([]);
      setSelectedProofId("");
      try {
        if (proofType === "attestation") {
          const res = await fetch("/api/prove/attestations");
          if (res.ok && !cancelled) {
            const data = await res.json();
            const options: ProofOption[] = (data.attestations ?? []).map(
              (a: { id: string; title: string; verification_id: string }) => ({
                id: a.id,
                title: a.title,
                verification_id: a.verification_id,
              })
            );
            setProofOptions(options);
          }
        } else if (proofType === "provenance") {
          const res = await fetch("/api/prove/provenance");
          if (res.ok && !cancelled) {
            const data = await res.json();
            const options: ProofOption[] = (data.records ?? []).map(
              (r: { id: string; title: string; verification_id: string }) => ({
                id: r.id,
                title: r.title,
                verification_id: r.verification_id,
              })
            );
            setProofOptions(options);
          }
        } else if (proofType === "incident_lock") {
          const res = await fetch("/api/prove/incident-locks");
          if (res.ok && !cancelled) {
            const data = await res.json();
            const options: ProofOption[] = (data.locks ?? []).map(
              (l: {
                id: string;
                snapshot: { title: string };
                verification_id: string;
              }) => ({
                id: l.id,
                title: l.snapshot.title,
                verification_id: l.verification_id,
              })
            );
            setProofOptions(options);
          }
        }
      } finally {
        if (!cancelled) setLoadingProofs(false);
      }
    };

    fetchProofs();
    return () => {
      cancelled = true;
    };
  }, [proofType]);

  const selectedProof = proofOptions.find((p) => p.id === selectedProofId);

  const resetForm = () => {
    setProofType("");
    setProofOptions([]);
    setSelectedProofId("");
    setSharedWithName("");
    setSharedWithEmail("");
    setNote("");
    setShowForm(false);
  };

  const handleSubmit = async () => {
    if (!proofType || !selectedProofId || !sharedWithName.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/prove/exchanges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proof_type: proofType,
          proof_id: selectedProofId,
          shared_with_name: sharedWithName.trim(),
          shared_with_email: sharedWithEmail.trim() || undefined,
          note: note.trim() || undefined,
        }),
      });
      if (res.ok) {
        resetForm();
        setPage(1);
        await fetchExchanges();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const copyVerifyUrl = async (verificationId: string) => {
    try {
      await navigator.clipboard.writeText(`/verify/${verificationId}`);
      setCopiedId(verificationId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Clipboard API may not be available
    }
  };

  const totalPages = Math.ceil(total / perPage);

  return (
    <TierGate requiredTier="Verify" featureLabel="Trust Exchange">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-brand/10 text-brand">
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 4v12m0-12l-4 4m4-4l4 4"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-semibold">Trust Exchange</h1>
              <p className="text-sm text-muted-foreground">
                Share governance proofs with external parties for verification
              </p>
            </div>
          </div>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-brand text-white hover:bg-brand/90 transition-colors"
            >
              Share Proof
            </button>
          )}
        </div>

        {/* Share Form */}
        {showForm && (
          <div className="border border-border rounded-lg p-5 space-y-4 bg-muted/50">
            <div className="space-y-1.5">
              <label htmlFor="ex-proof-type" className="text-sm font-medium">
                Proof Type <span className="text-red-500">*</span>
              </label>
              <select
                id="ex-proof-type"
                value={proofType}
                onChange={(e) => setProofType(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
              >
                <option value="">Select proof type...</option>
                <option value="attestation">Attestation</option>
                <option value="provenance">Provenance</option>
                <option value="incident_lock">Incident Lock</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="ex-proof-id" className="text-sm font-medium">
                Proof <span className="text-red-500">*</span>
              </label>
              <select
                id="ex-proof-id"
                value={selectedProofId}
                onChange={(e) => setSelectedProofId(e.target.value)}
                disabled={!proofType || loadingProofs}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 disabled:opacity-40"
              >
                <option value="">
                  {loadingProofs
                    ? "Loading proofs..."
                    : !proofType
                      ? "Select a proof type first"
                      : proofOptions.length === 0
                        ? "No proofs available"
                        : "Select proof..."}
                </option>
                {proofOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.title}
                  </option>
                ))}
              </select>
              {selectedProof && (
                <p className="text-xs text-muted-foreground font-mono mt-1">
                  Verification ID: {selectedProof.verification_id}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="ex-recipient" className="text-sm font-medium">
                Recipient Name <span className="text-red-500">*</span>
              </label>
              <input
                id="ex-recipient"
                type="text"
                value={sharedWithName}
                onChange={(e) => setSharedWithName(e.target.value)}
                placeholder="Organisation or person name"
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="ex-email" className="text-sm font-medium">
                Recipient Email
              </label>
              <input
                id="ex-email"
                type="email"
                value={sharedWithEmail}
                onChange={(e) => setSharedWithEmail(e.target.value)}
                placeholder="contact@example.com"
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="ex-note" className="text-sm font-medium">
                Note
              </label>
              <textarea
                id="ex-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Additional context..."
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 resize-none"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleSubmit}
                disabled={
                  submitting ||
                  !proofType ||
                  !selectedProofId ||
                  !sharedWithName.trim()
                }
                className="px-4 py-2 text-sm font-medium rounded-lg bg-brand text-white hover:bg-brand/90 transition-colors disabled:opacity-40"
              >
                {submitting ? "Sharing..." : "Share Proof"}
              </button>
              <button
                onClick={resetForm}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-border hover:bg-muted/50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="text-sm text-muted-foreground py-8 text-center">
            Loading exchanges...
          </div>
        ) : exchanges.length === 0 ? (
          <div className="border border-dashed border-border rounded-xl p-12 text-center space-y-3">
            <div className="text-muted-foreground/60">
              <svg
                className="w-10 h-10 mx-auto mb-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 4v12m0-12l-4 4m4-4l4 4"
                />
              </svg>
            </div>
            <p className="text-sm text-muted-foreground">
              No proofs have been shared yet. Share an attestation, provenance
              certificate, or incident lock with external parties for
              independent verification.
            </p>
          </div>
        ) : (
          <>
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                      Date
                    </th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                      Type
                    </th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                      Shared With
                    </th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                      Verify Link
                    </th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                      Note
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {exchanges.map((ex) => (
                    <tr
                      key={ex.id}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        {new Date(ex.shared_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            proofTypeBadge[ex.proof_type] ??
                            "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {proofTypeLabel[ex.proof_type] ??
                            capitalize(ex.proof_type)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">
                          {ex.shared_with_name}
                        </div>
                        {ex.shared_with_email && (
                          <div className="text-xs text-muted-foreground">
                            {ex.shared_with_email}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5">
                          <a
                            href={`/verify/${ex.verification_id}`}
                            className="font-mono text-xs bg-muted/50 px-1.5 py-0.5 rounded hover:underline"
                          >
                            {ex.verification_id}
                          </a>
                          <button
                            onClick={() => copyVerifyUrl(ex.verification_id)}
                            title="Copy verify URL"
                            className="p-0.5 rounded hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
                          >
                            {copiedId === ex.verification_id ? (
                              <svg
                                className="w-3.5 h-3.5 text-green-600"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                            ) : (
                              <svg
                                className="w-3.5 h-3.5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <rect
                                  x="9"
                                  y="9"
                                  width="13"
                                  height="13"
                                  rx="2"
                                  ry="2"
                                  strokeWidth={1.5}
                                />
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={1.5}
                                  d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"
                                />
                              </svg>
                            )}
                          </button>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {ex.note
                          ? ex.note.length > 50
                            ? ex.note.slice(0, 50) + "..."
                            : ex.note
                          : "\u2014"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {total} exchanges total
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
      </div>
    </TierGate>
  );
}
