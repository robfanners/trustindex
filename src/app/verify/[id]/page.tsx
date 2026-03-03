"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import AppShell from "@/components/AppShell";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type VerificationRecord = {
  id: string;
  title: string;
  verification_id: string;
  event_hash: string;
  chain_tx_hash: string | null;
  chain_status: string;
  organisation_id: string;
  organisation_name: string;
  created_at: string;
  // Attestation fields
  statement?: string;
  attested_by?: string;
  attested_at?: string;
  // Provenance fields
  ai_system?: string;
  model_version?: string;
  reviewed_by?: string;
  reviewed_at?: string;
};

type VerificationResult =
  | { found: true; type: "attestation" | "provenance"; record: VerificationRecord }
  | { found: false };

// ---------------------------------------------------------------------------
// Inline CopyButton
// ---------------------------------------------------------------------------

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="ml-1.5 p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
      title="Copy to clipboard"
    >
      {copied ? (
        <svg className="w-3.5 h-3.5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <rect strokeWidth={1.5} x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
        </svg>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Inline ChainStatusIndicator
// ---------------------------------------------------------------------------

function ChainStatusIndicator({ status, txHash }: { status: string; txHash: string | null }) {
  switch (status) {
    case "anchored":
      return (
        <div className="flex items-center gap-2 text-sm">
          <span className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0" />
          <span className="text-green-700">Anchored on-chain</span>
          {txHash && (
            <span className="font-mono text-xs text-muted-foreground" title={txHash}>
              {txHash.slice(0, 16)}...
            </span>
          )}
        </div>
      );
    case "skipped":
      return (
        <div className="flex items-center gap-2 text-sm">
          <span className="w-2.5 h-2.5 rounded-full bg-gray-400 shrink-0" />
          <span className="text-muted-foreground">Off-chain record</span>
        </div>
      );
    case "failed":
      return (
        <div className="flex items-center gap-2 text-sm">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
          <span className="text-red-700">Chain anchoring failed</span>
        </div>
      );
    case "pending":
      return (
        <div className="flex items-center gap-2 text-sm">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
          <span className="text-amber-700">Chain anchoring in progress</span>
        </div>
      );
    default:
      return (
        <div className="flex items-center gap-2 text-sm">
          <span className="w-2.5 h-2.5 rounded-full bg-gray-300 shrink-0" />
          <span className="text-muted-foreground">{status}</span>
        </div>
      );
  }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PublicVerifyPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<VerificationResult | null>(null);

  useEffect(() => {
    if (!id) return;

    const verify = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/public/verify?id=${encodeURIComponent(id)}`);
        if (res.ok) {
          const data: VerificationResult = await res.json();
          setResult(data);
        } else {
          setResult({ found: false });
        }
      } catch {
        setResult({ found: false });
      } finally {
        setLoading(false);
      }
    };

    verify();
  }, [id]);

  // -------------------------------------------------------------------------
  // Loading
  // -------------------------------------------------------------------------

  if (loading) {
    return (
      <AppShell>
        <div className="max-w-2xl mx-auto px-4 py-16 sm:py-24">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-brand/10 text-brand mb-4">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold">Governance Proof Verification</h1>
            <p className="text-sm text-muted-foreground mt-1">Independent verification of governance records</p>
          </div>

          {/* Spinner */}
          <div className="flex flex-col items-center justify-center py-16">
            <svg className="w-6 h-6 animate-spin text-brand mb-3" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-sm text-muted-foreground">Verifying...</p>
          </div>

          {/* Footer */}
          <div className="text-center mt-16">
            <p className="text-xs text-muted-foreground">
              Verified by Verisum &mdash; AI governance you can prove
            </p>
          </div>
        </div>
      </AppShell>
    );
  }

  // -------------------------------------------------------------------------
  // Found
  // -------------------------------------------------------------------------

  if (result?.found) {
    const { type, record } = result;

    return (
      <AppShell>
        <div className="max-w-2xl mx-auto px-4 py-16 sm:py-24">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-brand/10 text-brand mb-4">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold">Governance Proof Verification</h1>
            <p className="text-sm text-muted-foreground mt-1">Independent verification of governance records</p>
          </div>

          {/* Card */}
          <div className="border border-border rounded-xl overflow-hidden bg-white">
            {/* Green verified banner */}
            <div className="bg-green-50 border-b border-green-200 px-6 py-4 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-sm font-semibold text-green-800">Verified Governance Record</span>
            </div>

            <div className="px-6 py-6 space-y-6">
              {/* Type badge */}
              <div>
                <span
                  className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                    type === "attestation"
                      ? "bg-blue-100 text-blue-800"
                      : "bg-purple-100 text-purple-800"
                  }`}
                >
                  {type === "attestation" ? "Attestation" : "Provenance Certificate"}
                </span>
              </div>

              {/* Title */}
              <h2 className="text-lg font-semibold">{record.title}</h2>

              {/* Organisation + date */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                    Organisation
                  </dt>
                  <dd className="text-sm">{record.organisation_name}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                    Date
                  </dt>
                  <dd className="text-sm">
                    {new Date(record.created_at).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </dd>
                </div>
              </div>

              {/* Attestation: statement */}
              {type === "attestation" && record.statement && (
                <div>
                  <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                    Statement
                  </dt>
                  <dd className="text-sm bg-muted/50 border border-border rounded-lg px-4 py-3 leading-relaxed">
                    {record.statement}
                  </dd>
                </div>
              )}

              {/* Provenance: AI system + model version */}
              {type === "provenance" && (
                <div className="grid gap-4 sm:grid-cols-2">
                  {record.ai_system && (
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                        AI System
                      </dt>
                      <dd className="text-sm">{record.ai_system}</dd>
                    </div>
                  )}
                  {record.model_version && (
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                        Model Version
                      </dt>
                      <dd className="text-sm font-mono">{record.model_version}</dd>
                    </div>
                  )}
                </div>
              )}

              {/* Divider */}
              <div className="border-t border-border" />

              {/* Verification details */}
              <div className="space-y-4">
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Verification Details
                </h3>

                <div className="grid gap-4 sm:grid-cols-2">
                  {/* Verification ID */}
                  <div>
                    <dt className="text-xs text-muted-foreground mb-1">Verification ID</dt>
                    <dd className="flex items-center">
                      <code className="font-mono text-xs bg-muted/50 px-2 py-0.5 rounded">
                        {record.verification_id}
                      </code>
                      <CopyButton text={record.verification_id} />
                    </dd>
                  </div>

                  {/* Event hash */}
                  <div>
                    <dt className="text-xs text-muted-foreground mb-1">Event Hash</dt>
                    <dd className="flex items-center">
                      <code
                        className="font-mono text-xs bg-muted/50 px-2 py-0.5 rounded cursor-help"
                        title={record.event_hash}
                      >
                        {record.event_hash.slice(0, 16)}...
                      </code>
                      <CopyButton text={record.event_hash} />
                    </dd>
                  </div>
                </div>
              </div>

              {/* Chain status */}
              <div className="pt-2 border-t border-border">
                <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Chain Status
                </dt>
                <ChainStatusIndicator
                  status={record.chain_status}
                  txHash={record.chain_tx_hash}
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center mt-12">
            <p className="text-xs text-muted-foreground">
              Verified by Verisum &mdash; AI governance you can prove
            </p>
          </div>
        </div>
      </AppShell>
    );
  }

  // -------------------------------------------------------------------------
  // Not found
  // -------------------------------------------------------------------------

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-4 py-16 sm:py-24">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-brand/10 text-brand mb-4">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold">Governance Proof Verification</h1>
          <p className="text-sm text-muted-foreground mt-1">Independent verification of governance records</p>
        </div>

        {/* Not-found card */}
        <div className="border border-border rounded-xl bg-white px-6 py-8">
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center">
              <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle strokeWidth={1.5} cx="12" cy="12" r="10" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 16h.01M12 8v4" />
              </svg>
            </div>
            <h2 className="text-base font-semibold">No governance record found</h2>
            <p className="text-sm text-muted-foreground max-w-md">
              The verification ID{" "}
              <code className="font-mono text-xs bg-muted/50 px-1.5 py-0.5 rounded">{id}</code>{" "}
              does not match any record in the Verisum registry.
            </p>
            <p className="text-xs text-muted-foreground">
              If you believe this is an error, contact the issuing organisation.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-12">
          <p className="text-xs text-muted-foreground">
            Verified by Verisum &mdash; AI governance you can prove
          </p>
        </div>
      </div>
    </AppShell>
  );
}
