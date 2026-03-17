"use client";

import Link from "next/link";

type DriftEvent = {
  id: string;
  run_type: string;
  delta_score: number;
  created_at: string;
};

type Severity = "Critical" | "Warning" | "Drifting";

function getSeverity(delta: number): Severity {
  const abs = Math.abs(delta);
  if (abs >= 10) return "Critical";
  if (abs >= 5) return "Warning";
  return "Drifting";
}

const severityConfig: Record<
  Severity,
  { color: string; bg: string; iconColor: string }
> = {
  Critical: {
    color: "var(--destructive, #d4183d)",
    bg: "rgba(212, 24, 61, 0.08)",
    iconColor: "var(--destructive, #d4183d)",
  },
  Warning: {
    color: "var(--warning, #FF8C00)",
    bg: "rgba(255, 140, 0, 0.08)",
    iconColor: "var(--warning, #FF8C00)",
  },
  Drifting: {
    color: "var(--brand, #0066FF)",
    bg: "rgba(0, 102, 255, 0.08)",
    iconColor: "var(--brand, #0066FF)",
  },
};

function DriftIcon({ color }: { color: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M2 12l3.5-5 3 3L13 4"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function runTypeLabel(runType: string): string {
  switch (runType) {
    case "system":
      return "System Assessment";
    case "org":
      return "Org Assessment";
    default:
      return runType.charAt(0).toUpperCase() + runType.slice(1) + " Assessment";
  }
}

function relativeTime(dateStr: string): string {
  const now = new Date();
  const then = new Date(dateStr);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  return `${diffDays}d ago`;
}

export default function DriftList({ events }: { events: DriftEvent[] }) {
  const visible = events.slice(0, 4);

  return (
    <div className="rounded-xl border border-[var(--border,rgba(0,0,0,0.08))] bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border,rgba(0,0,0,0.08))]">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">Drift Detection</h3>
          <span className="rounded-full bg-black/5 px-2 py-0.5 text-[11px] font-medium text-[var(--muted-foreground,#6B7280)]">
            {events.length}
          </span>
        </div>
        <Link
          href="/monitor/drift"
          className="text-xs font-medium text-[var(--brand,#0066FF)] hover:underline"
        >
          View all
        </Link>
      </div>

      {/* Event list */}
      {visible.length === 0 ? (
        <div className="flex items-center justify-center py-12 px-5">
          <p className="text-sm text-[var(--muted-foreground,#6B7280)]">
            No drift alerts
          </p>
        </div>
      ) : (
        <div className="divide-y divide-[var(--border,rgba(0,0,0,0.08))]">
          {visible.map((ev) => {
            const severity = getSeverity(ev.delta_score);
            const config = severityConfig[severity];
            const sign = ev.delta_score > 0 ? "+" : "";

            return (
              <div
                key={ev.id}
                className="flex items-center gap-3 px-5 py-3 transition-colors duration-150 hover:bg-black/[0.015]"
              >
                {/* Icon */}
                <div
                  className="flex shrink-0 items-center justify-center rounded-lg w-8 h-8"
                  style={{ backgroundColor: config.bg }}
                >
                  <DriftIcon color={config.iconColor} />
                </div>

                {/* Label + delta */}
                <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                  <span className="text-sm font-medium truncate">
                    {runTypeLabel(ev.run_type)}
                  </span>
                  <div className="flex items-center gap-2">
                    <span
                      className="text-xs font-semibold font-mono tabular-nums"
                      style={{ color: config.color }}
                    >
                      {sign}
                      {ev.delta_score}
                    </span>
                    <span className="text-[11px] text-[var(--muted-foreground,#6B7280)]">
                      {relativeTime(ev.created_at)}
                    </span>
                  </div>
                </div>

                {/* Severity badge */}
                <span
                  className="flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium"
                  style={{ backgroundColor: config.bg, color: config.color }}
                >
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: config.color }}
                  />
                  {severity}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
