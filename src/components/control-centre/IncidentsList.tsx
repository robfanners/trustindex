"use client";

import Link from "next/link";

type Escalation = {
  id: string;
  reason: string;
  severity: string;
  status: string;
  created_at: string;
  assigned_to?: string;
};

type Incident = {
  id: string;
  title: string;
  status: string;
  impact_level: string;
  created_at: string;
};

type Props = {
  escalations: Escalation[];
  incidents: Incident[];
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  if (diffMs < 0) return "just now";

  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

type Unified = {
  id: string;
  title: string;
  severity: string;
  status: string;
  created_at: string;
  kind: "escalation" | "incident";
  meta?: string;
};

function normaliseSeverity(raw: string): string {
  return raw.toLowerCase().replace(/\s+/g, "");
}

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function severityRank(s: string): number {
  return SEVERITY_ORDER[normaliseSeverity(s)] ?? 4;
}

const SEVERITY_DOT: Record<string, string> = {
  critical: "bg-[var(--destructive,#d4183d)]",
  high: "bg-[var(--warning,#FF8C00)]",
  medium: "bg-[var(--brand,#0066FF)]",
  low: "bg-[var(--muted-foreground,#6B7280)]",
};

const SEVERITY_TAG_BG: Record<string, string> = {
  critical: "bg-[var(--destructive,#d4183d)]/10 text-[var(--destructive,#d4183d)]",
  high: "bg-[var(--warning,#FF8C00)]/10 text-[var(--warning,#FF8C00)]",
  medium: "bg-[var(--brand,#0066FF)]/10 text-[var(--brand,#0066FF)]",
  low: "bg-gray-100 text-[var(--muted-foreground,#6B7280)]",
};

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export default function IncidentsList({ escalations, incidents }: Props) {
  // Merge into unified list
  const unified: Unified[] = [
    ...escalations.map<Unified>((e) => ({
      id: e.id,
      title: e.reason,
      severity: e.severity,
      status: e.status,
      created_at: e.created_at,
      kind: "escalation",
      meta: e.assigned_to ? `Assigned to ${e.assigned_to}` : "Unassigned",
    })),
    ...incidents.map<Unified>((i) => ({
      id: i.id,
      title: i.title,
      severity: i.impact_level,
      status: i.status,
      created_at: i.created_at,
      kind: "incident",
    })),
  ];

  // Sort by created_at desc, then severity
  unified.sort((a, b) => {
    const dateDiff =
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    if (dateDiff !== 0) return dateDiff;
    return severityRank(a.severity) - severityRank(b.severity);
  });

  const visible = unified.slice(0, 6);

  return (
    <div className="rounded-xl border border-[var(--border,rgba(0,0,0,0.08))] bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border,rgba(0,0,0,0.08))]">
        <h3 className="text-sm font-semibold text-gray-900">
          Active Escalations &amp; Incidents
        </h3>
        <Link
          href="/monitor/incidents"
          className="text-xs font-medium text-[var(--brand,#0066FF)] hover:underline"
        >
          View all &rarr;
        </Link>
      </div>

      {/* Body */}
      {visible.length === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-[var(--muted-foreground,#6B7280)]">
          No active escalations or incidents
        </div>
      ) : (
        <ul className="divide-y divide-[var(--border,rgba(0,0,0,0.08))]">
          {visible.map((item) => {
            const sev = normaliseSeverity(item.severity);
            return (
              <li
                key={`${item.kind}-${item.id}`}
                className="flex items-center gap-3 px-5 py-3"
              >
                {/* Severity dot */}
                <span
                  className={`shrink-0 w-2.5 h-2.5 rounded-full ${SEVERITY_DOT[sev] ?? SEVERITY_DOT.low}`}
                />

                {/* Title + meta */}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {item.title}
                  </p>
                  <p className="text-xs text-[var(--muted-foreground,#6B7280)] mt-0.5">
                    {item.kind === "escalation" ? "Escalation" : "Incident"}
                    {item.meta ? ` \u00b7 ${item.meta}` : ""}
                  </p>
                </div>

                {/* Severity tag + time */}
                <div className="shrink-0 flex flex-col items-end gap-1">
                  <span
                    className={`inline-block text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${SEVERITY_TAG_BG[sev] ?? SEVERITY_TAG_BG.low}`}
                  >
                    {sev}
                  </span>
                  <span className="text-[11px] text-[var(--muted-foreground,#6B7280)]">
                    {timeAgo(item.created_at)}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
