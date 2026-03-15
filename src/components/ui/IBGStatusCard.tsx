"use client";

import type { IBGSpecification } from "@/lib/ibgTypes";
import { checkIBGCompleteness } from "@/lib/ibgTypes";

type Props = {
  spec: IBGSpecification | null;
  compact?: boolean;
};

const CheckIcon = () => (
  <svg className="w-3.5 h-3.5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
  </svg>
);

const CrossIcon = () => (
  <svg className="w-3.5 h-3.5 text-muted-foreground/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

export default function IBGStatusCard({ spec, compact = false }: Props) {
  const completeness = checkIBGCompleteness(spec);

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className="font-medium text-muted-foreground">IBG</span>
        <span className={
          completeness.overall === "complete"
            ? "text-green-600 font-medium"
            : completeness.overall === "partial"
            ? "text-amber-600 font-medium"
            : "text-muted-foreground"
        }>
          {completeness.overall === "complete"
            ? "Complete"
            : completeness.overall === "partial"
            ? "Partial"
            : "Not defined"}
        </span>
      </div>
    );
  }

  return (
    <div className="border border-border rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-2">
        <div className="p-1 rounded bg-brand/10 text-brand">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
        <span className="text-xs font-semibold text-foreground tracking-wide uppercase">
          Intent-Based Governance&trade;
        </span>
        {spec && (
          <span className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full ${
            spec.status === "active"
              ? "bg-green-100 text-green-800"
              : "bg-amber-100 text-amber-800"
          }`}>
            {spec.status === "active" ? "Active" : "Draft"} v{spec.version}
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="flex items-center gap-1.5">
          {completeness.goals ? <CheckIcon /> : <CrossIcon />}
          <span className={completeness.goals ? "text-foreground" : "text-muted-foreground"}>
            Goals
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {completeness.authorities ? <CheckIcon /> : <CrossIcon />}
          <span className={completeness.authorities ? "text-foreground" : "text-muted-foreground"}>
            Authorities
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {completeness.blastRadius ? <CheckIcon /> : <CrossIcon />}
          <span className={completeness.blastRadius ? "text-foreground" : "text-muted-foreground"}>
            Blast Radius
          </span>
        </div>
      </div>
    </div>
  );
}
