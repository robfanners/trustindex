"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import TierGate from "@/components/TierGate";
import OnboardingTour from "@/components/ui/OnboardingTour";

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
          <span className="text-muted-foreground">Chain anchoring not configured</span>
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
          <span className="text-amber-700">Chain anchoring pending</span>
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

export default function VerificationPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-muted-foreground">Loading...</div>}>
      <VerificationPageInner />
    </Suspense>
  );
}

function VerificationPageInner() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [searched, setSearched] = useState(false);

  const handleVerify = useCallback(async (verificationId?: string) => {
    const trimmed = (verificationId ?? query).trim();
    if (!trimmed) return;

    setLoading(true);
    setResult(null);
    setSearched(true);
    try {
      const res = await fetch(`/api/prove/verify?id=${encodeURIComponent(trimmed)}`);
      if (res.ok) {
        const data: VerificationResult = await res.json();
        setResult(data);
      }
    } finally {
      setLoading(false);
    }
  }, [query]);

  // Auto-populate and verify from ?id= query param on mount
  useEffect(() => {
    const id = searchParams.get("id");
    if (id) {
      setQuery(id);
      handleVerify(id);
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleVerify();
  };

  return (
    <TierGate requiredTier="Verify" featureLabel="Verification Portal">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3" data-tour="page-header">
          <div className="p-2 rounded-lg bg-brand/10 text-brand">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle strokeWidth={1.5} cx="11" cy="11" r="8" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-4.35-4.35" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Verification Portal</h1>
            <p className="text-sm text-muted-foreground">
              Validate governance proofs and verify attestation signatures
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="flex gap-3" data-tour="search-input">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter verification ID (e.g., VER-A1B2C3D4)"
            className="flex-1 px-5 py-4 rounded-lg border border-border bg-background text-lg font-mono placeholder:font-sans placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand/50"
          />
          <button
            type="button"
            onClick={() => handleVerify()}
            disabled={loading || !query.trim()}
            className="px-6 py-3 rounded-lg bg-brand text-white font-medium hover:bg-brand/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Verifying
              </span>
            ) : (
              "Verify"
            )}
          </button>
        </div>

        {/* Results */}
        {loading ? (
          <div className="text-sm text-muted-foreground py-8 text-center">
            Looking up verification record...
          </div>
        ) : result ? (
          result.found ? (
            <div className="bg-white border border-border rounded-xl p-6 space-y-5">
              {/* Type badge */}
              <div>
                <span
                  className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                    result.type === "attestation"
                      ? "bg-blue-100 text-blue-800"
                      : "bg-purple-100 text-purple-800"
                  }`}
                >
                  {result.type === "attestation" ? "Attestation" : "Provenance"}
                </span>
              </div>

              {/* Title */}
              <h2 className="text-xl font-semibold">{result.record.title}</h2>

              {/* Details grid */}
              <div className="grid gap-4 sm:grid-cols-2">
                {/* Organisation */}
                <div>
                  <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                    Organisation
                  </dt>
                  <dd className="text-sm">{result.record.organisation_name}</dd>
                </div>

                {/* Date */}
                <div>
                  <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                    Created
                  </dt>
                  <dd className="text-sm">
                    {new Date(result.record.created_at).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </dd>
                </div>

                {/* Verification ID */}
                <div>
                  <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                    Verification ID
                  </dt>
                  <dd className="flex items-center text-sm">
                    <code className="font-mono text-xs bg-muted/50 px-2 py-0.5 rounded">
                      {result.record.verification_id}
                    </code>
                    <CopyButton text={result.record.verification_id} />
                  </dd>
                </div>

                {/* Event hash */}
                <div>
                  <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                    Event Hash
                  </dt>
                  <dd className="flex items-center text-sm">
                    <code
                      className="font-mono text-xs bg-muted/50 px-2 py-0.5 rounded cursor-help"
                      title={result.record.event_hash}
                    >
                      {result.record.event_hash.slice(0, 16)}...
                    </code>
                    <CopyButton text={result.record.event_hash} />
                  </dd>
                </div>
              </div>

              {/* Chain status */}
              <div className="pt-2 border-t border-border">
                <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Chain Status
                </dt>
                <ChainStatusIndicator
                  status={result.record.chain_status}
                  txHash={result.record.chain_tx_hash}
                />
              </div>
            </div>
          ) : (
            /* Not found */
            <div className="border border-border rounded-xl p-6 bg-blue-50/50">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle strokeWidth={1.5} cx="12" cy="12" r="10" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 16h.01M12 8v4" />
                </svg>
                <div>
                  <p className="text-sm font-medium">No proof found for this verification ID</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Double-check the ID and try again. Verification IDs are case-sensitive and follow the format VER-XXXXXXXX.
                  </p>
                </div>
              </div>
            </div>
          )
        ) : !searched ? (
          /* Initial state */
          <div className="border border-dashed border-border rounded-xl p-12 text-center space-y-4">
            <div className="text-muted-foreground/40">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-foreground">
              Verify Governance Proof
            </h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Enter a verification ID to look up a governance attestation, provenance certificate, or incident lock.
            </p>
            <p className="text-xs font-mono text-muted-foreground/60">
              Format: VER-xxxxxxxx
            </p>
          </div>
        ) : null}

        <OnboardingTour
          tourId="verification"
          steps={[
            { target: "[data-tour='page-header']", title: "Verification Portal", content: "Look up any governance proof using its verification ID. Proofs are cryptographically signed and independently verifiable." },
            { target: "[data-tour='search-input']", title: "Enter a Verification ID", content: "Paste a VER-xxxxxxxx code to verify an attestation, provenance certificate, or incident lock." },
          ]}
        />
      </div>
    </TierGate>
  );
}
