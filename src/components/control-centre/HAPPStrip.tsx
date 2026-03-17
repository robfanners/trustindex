"use client";

import Link from "next/link";

type HAPPStripProps = {
  proofCount: number;
  attestationCount: number;
  plan: string;
};

function ShieldIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M9 1L2 4.5v3.5c0 4.97 3 9.13 7 10 4-.87 7-5.03 7-10V4.5L9 1z"
        stroke="white"
        strokeWidth="1.4"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M6.5 9.5l2 2 3.5-4"
        stroke="white"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="3"
        y="6"
        width="8"
        height="6"
        rx="1.5"
        stroke="white"
        strokeWidth="1.2"
        fill="none"
      />
      <path
        d="M5 6V4.5a2 2 0 014 0V6"
        stroke="white"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function HAPPStrip({
  proofCount,
  attestationCount,
  plan,
}: HAPPStripProps) {
  const isEnterprise = plan === "enterprise";

  return (
    <div className="relative overflow-hidden rounded-xl border border-[var(--brand,#0066FF)]/30 bg-[var(--foreground,#111827)]/95 px-5 py-4">
      <div className="flex items-center gap-4">
        {/* shield icon */}
        <div
          className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: "var(--brand, #0066FF)" }}
        >
          {isEnterprise ? <ShieldIcon /> : <LockIcon />}
        </div>

        {/* text */}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">
            HAPP Protocol &middot; Governance Proof Ready
          </p>
          {isEnterprise ? (
            <p className="mt-0.5 text-xs text-white/60">
              {proofCount} proof{proofCount !== 1 ? "s" : ""} generated
              &middot; {attestationCount} attestation
              {attestationCount !== 1 ? "s" : ""} on record
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-white/60">
              Enterprise feature &middot; Cryptographic governance proofs &amp;
              board packs
            </p>
          )}
        </div>

        {/* actions */}
        <div className="flex shrink-0 items-center gap-2">
          {isEnterprise ? (
            <>
              <Link
                href="/prove/verification"
                className="rounded-lg border border-white/20 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-white/10"
              >
                Verify Proof
              </Link>
              <Link
                href="/reports"
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-colors hover:opacity-90"
                style={{ backgroundColor: "var(--brand, #0066FF)" }}
              >
                Board Pack
              </Link>
            </>
          ) : (
            <Link
              href="/upgrade"
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-colors hover:opacity-90"
              style={{ backgroundColor: "var(--brand, #0066FF)" }}
            >
              Upgrade
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
