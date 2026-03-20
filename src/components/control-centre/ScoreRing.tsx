"use client";

import { useState } from "react";
import Link from "next/link";

type ScoreRingProps = {
  score: number | null;
  orgScore?: number | null;
  sysScore?: number | null;
  dimensions?: { label: string; value: number }[];
};

const RADIUS = 38;
const STROKE = 7;
const SIZE = 96;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function Ring({ score }: { score: number | null }) {
  const pct = score != null ? Math.max(0, Math.min(100, score)) : 0;
  const offset = CIRCUMFERENCE - (pct / 100) * CIRCUMFERENCE;

  return (
    <svg
      width={SIZE}
      height={SIZE}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="shrink-0"
      aria-label={score != null ? `Score: ${score}` : "No score"}
    >
      {/* background track */}
      <circle
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={RADIUS}
        fill="none"
        stroke="var(--border, rgba(0,0,0,0.08))"
        strokeWidth={STROKE}
      />
      {/* filled arc */}
      {score != null && (
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="var(--brand, #0066FF)"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      )}
      {/* center text */}
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-current text-gray-900"
        style={{ fontSize: score != null ? "22px" : "16px", fontWeight: 700 }}
      >
        {score != null ? score : "--"}
      </text>
    </svg>
  );
}

function DimensionBar({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  const pct = Math.max(0, Math.min(100, value));

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-24 shrink-0 truncate text-xs text-[var(--muted-foreground,#6B7280)]">
        {label}
      </span>
      <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-[var(--brand,#0066FF)] transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-8 shrink-0 text-right text-xs font-semibold font-mono tabular-nums text-gray-700">
        {value}
      </span>
    </div>
  );
}

function HelpTooltip() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-[var(--border,rgba(0,0,0,0.15))] text-[var(--muted-foreground,#6B7280)] hover:bg-gray-100 transition-colors"
        aria-label="What is the Verisum Score?"
      >
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden="true">
          <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fill="currentColor" fontSize="7" fontWeight="600">?</text>
        </svg>
      </button>
      {open && (
        <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-50 w-64 rounded-lg border border-[var(--border,rgba(0,0,0,0.08))] bg-white p-3 shadow-lg text-xs text-[var(--muted-foreground,#6B7280)] leading-relaxed">
          <p className="font-medium text-[var(--foreground,#111)] mb-1">Verisum Score</p>
          <p className="mb-2">
            Your composite TrustGraph score combines organisational readiness (TrustOrg) and individual system assessments (TrustSys) into a single governance health metric.
          </p>
          <p>
            A higher score indicates stronger AI governance posture. Click the links below to improve each component.
          </p>
          <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 border-l border-t border-[var(--border,rgba(0,0,0,0.08))] bg-white" />
        </div>
      )}
    </div>
  );
}

export default function ScoreRing({ score, orgScore, sysScore, dimensions }: ScoreRingProps) {
  const hasDimensions = dimensions && dimensions.length > 0;

  return (
    <div className="rounded-xl border border-[var(--border,rgba(0,0,0,0.08))] bg-white p-5">
      {/* header */}
      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground,#6B7280)]">
          Verisum Score{" "}
          <span className="font-normal">&middot; TrustGraph composite</span>
        </h3>
        <HelpTooltip />
      </div>

      {hasDimensions ? (
        <div className="flex items-start gap-6">
          {/* ring */}
          <Ring score={score} />

          {/* dimension bars */}
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            {dimensions.map((d) => (
              <DimensionBar key={d.label} label={d.label} value={d.value} />
            ))}
          </div>
        </div>
      ) : (
        <div className="flex justify-center">
          <Ring score={score} />
        </div>
      )}

      {/* TrustOrg / TrustSys component links */}
      <div className="mt-4 pt-3 border-t border-[var(--border,rgba(0,0,0,0.06))] flex items-center gap-4">
        <Link
          href="/govern/trustgraph?tab=trustorg"
          className="group flex items-center gap-2 text-xs text-[var(--muted-foreground,#6B7280)] hover:text-[var(--foreground,#111)] transition-colors no-underline"
        >
          <span className="flex items-center justify-center w-5 h-5 rounded bg-[var(--brand,#0066FF)]/10 text-[var(--brand,#0066FF)]">
            <svg width="10" height="10" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M7 1L1 4v2c0 3.87 2.56 7.49 6 8.5 3.44-1.01 6-4.63 6-8.5V4L7 1z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" fill="none" />
            </svg>
          </span>
          <span>
            <span className="font-medium">TrustOrg</span>
            {orgScore != null && (
              <span className="ml-1 font-mono tabular-nums">{orgScore}</span>
            )}
          </span>
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden="true"
            className="opacity-0 group-hover:opacity-60 transition-opacity">
            <path d="M2.5 1.5L5.5 4L2.5 6.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>

        <div className="w-px h-4 bg-[var(--border,rgba(0,0,0,0.08))]" />

        <Link
          href="/govern/trustgraph?tab=trustsys"
          className="group flex items-center gap-2 text-xs text-[var(--muted-foreground,#6B7280)] hover:text-[var(--foreground,#111)] transition-colors no-underline"
        >
          <span className="flex items-center justify-center w-5 h-5 rounded bg-purple-500/10 text-purple-600">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
              <path d="M9 9h6M9 12h6M9 15h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </span>
          <span>
            <span className="font-medium">TrustSys</span>
            {sysScore != null && (
              <span className="ml-1 font-mono tabular-nums">{sysScore}</span>
            )}
          </span>
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden="true"
            className="opacity-0 group-hover:opacity-60 transition-opacity">
            <path d="M2.5 1.5L5.5 4L2.5 6.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>

        <div className="flex-1" />

        <Link
          href="/govern/trustgraph"
          className="text-xs text-[var(--brand,#0066FF)] hover:text-[var(--brand,#0066FF)]/80 font-medium transition-colors no-underline"
        >
          View TrustGraph
        </Link>
      </div>
    </div>
  );
}
