"use client";

import TierBadge from "./TierBadge";
import type { ExecSummaryOutput, Severity } from "@/lib/executiveSummary";

type Props = {
  summary: ExecSummaryOutput;
};

function severityChip(severity: Severity) {
  const config: Record<Severity, { label: string; className: string }> = {
    strength: {
      label: "Strength",
      className: "bg-tier-trusted/10 text-tier-trusted",
    },
    watch: {
      label: "Watch",
      className: "bg-tier-elevated/10 text-tier-elevated",
    },
    weak: {
      label: "Weak",
      className: "bg-tier-critical/10 text-tier-critical",
    },
  };
  const c = config[severity];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${c.className}`}
    >
      {c.label}
    </span>
  );
}

export default function ExecutiveSummary({ summary }: Props) {
  return (
    <div className="space-y-6">
      {/* Header: Tier + Status */}
      <div className="flex items-center gap-3">
        <TierBadge tier={summary.tier} />
        {summary.status !== "stable" && (
          <span className="text-xs text-muted-foreground px-2 py-0.5 rounded-full bg-muted">
            {summary.status === "insufficient_data"
              ? "Early signal"
              : "Provisional"}
          </span>
        )}
      </div>

      {/* Headline */}
      <h2 className="text-xl font-semibold leading-snug">
        {summary.headline}
      </h2>

      {/* Posture */}
      <p className="text-sm text-muted-foreground leading-relaxed">
        {summary.posture}
      </p>

      {/* Primary Drivers */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-foreground">
          Primary Drivers
        </h3>
        <div className="space-y-2">
          {summary.primaryDrivers.map((driver) => (
            <div
              key={driver.key}
              className="flex items-start gap-3 rounded-xl bg-card border border-border p-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">{driver.label}</span>
                  {severityChip(driver.severity)}
                  <span className="text-xs text-muted-foreground ml-auto">
                    {driver.score}/100
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{driver.why}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Priorities */}
      {summary.priorities.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-foreground">Priorities</h3>
          <div className="grid gap-4 md:grid-cols-2">
            {summary.priorities.map((priority, i) => (
              <div
                key={i}
                className="rounded-xl bg-card border border-border p-5 space-y-3"
              >
                <h4 className="font-medium text-sm">{priority.title}</h4>
                <p className="text-xs text-muted-foreground">
                  {priority.rationale}
                </p>
                <div className="space-y-1.5">
                  <div className="text-xs font-medium text-muted-foreground">
                    Questions to explore:
                  </div>
                  <ul className="space-y-1">
                    {priority.probes.map((probe, j) => (
                      <li
                        key={j}
                        className="text-xs text-muted-foreground flex gap-2"
                      >
                        <span className="text-muted-foreground/50 select-none">
                          {j + 1}.
                        </span>
                        {probe}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Confidence + Trend notes */}
      <div className="space-y-1 pt-2">
        <p className="text-xs text-muted-foreground">
          {summary.confidenceNote}
        </p>
        {summary.trendNote && (
          <p className="text-xs text-muted-foreground">
            {summary.trendNote}
          </p>
        )}
      </div>
    </div>
  );
}
