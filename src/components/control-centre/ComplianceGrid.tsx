"use client";

import Link from "next/link";

type Framework = {
  id: string;
  name: string;
  coverage_pct: number;
  status: string;
  due_date: string | null;
};

function barColor(pct: number): string {
  if (pct >= 85) return "var(--success, #00C851)";
  if (pct >= 70) return "var(--warning, #FF8C00)";
  return "var(--destructive, #d4183d)";
}

function DueLabel({ dueDate, status }: { dueDate: string | null; status: string }) {
  if (!dueDate) {
    return (
      <span className="text-[11px] text-[var(--muted-foreground,#6B7280)] leading-tight">
        {status}
      </span>
    );
  }

  const now = new Date();
  const due = new Date(dueDate);
  const diffMs = due.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return (
      <span className="text-[11px] font-medium text-[var(--destructive,#d4183d)] leading-tight">
        Overdue
      </span>
    );
  }

  const formatted = due.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });

  if (diffDays <= 14) {
    return (
      <span className="text-[11px] font-medium text-[var(--coral,#e8614d)] leading-tight">
        Due {formatted}
      </span>
    );
  }

  return (
    <span className="text-[11px] text-[var(--muted-foreground,#6B7280)] leading-tight">
      Due {formatted}
    </span>
  );
}

function classify(frameworks: Framework[]) {
  const now = new Date();
  let onTrack = 0;
  let atRisk = 0;
  let overdue = 0;

  for (const f of frameworks) {
    if (f.due_date && new Date(f.due_date) < now) {
      overdue++;
    } else if (f.coverage_pct < 70) {
      atRisk++;
    } else {
      onTrack++;
    }
  }

  return { onTrack, atRisk, overdue };
}

export default function ComplianceGrid({
  frameworks,
}: {
  frameworks: Framework[];
}) {
  const visible = frameworks.slice(0, 6);
  const stats = classify(frameworks);

  if (frameworks.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border,rgba(0,0,0,0.08))] bg-white">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border,rgba(0,0,0,0.08))]">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">Compliance Frameworks</h3>
            <span className="rounded-full bg-black/5 px-2 py-0.5 text-[11px] font-medium text-[var(--muted-foreground,#6B7280)]">
              0
            </span>
          </div>
          <Link
            href="/govern/registry"
            className="text-xs font-medium text-[var(--brand,#0066FF)] hover:underline"
          >
            Manage
          </Link>
        </div>
        <div className="flex flex-col items-center justify-center gap-2 py-12 px-5">
          <p className="text-sm text-[var(--muted-foreground,#6B7280)]">
            No frameworks configured yet
          </p>
          <Link
            href="/govern/registry"
            className="text-xs font-medium text-[var(--brand,#0066FF)] hover:underline"
          >
            Go to settings
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--border,rgba(0,0,0,0.08))] bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border,rgba(0,0,0,0.08))]">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">Compliance Frameworks</h3>
          <span className="rounded-full bg-black/5 px-2 py-0.5 text-[11px] font-medium text-[var(--muted-foreground,#6B7280)]">
            {frameworks.length}
          </span>
        </div>
        <Link
          href="/govern/registry"
          className="text-xs font-medium text-[var(--brand,#0066FF)] hover:underline"
        >
          Manage
        </Link>
      </div>

      {/* 2-column grid with 1px separators */}
      <div className="grid grid-cols-2 gap-px bg-[var(--border,rgba(0,0,0,0.08))]">
        {visible.map((f) => {
          const color = barColor(f.coverage_pct);
          return (
            <div key={f.id} className="flex flex-col gap-2 bg-white px-5 py-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium truncate mr-2">
                  {f.name}
                </span>
                <span
                  className="text-xs font-semibold font-mono tabular-nums shrink-0"
                  style={{ color }}
                >
                  {f.coverage_pct}%
                </span>
              </div>

              {/* Progress bar */}
              <div className="h-1.5 w-full rounded-full bg-black/[0.06]">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(f.coverage_pct, 100)}%`,
                    backgroundColor: color,
                  }}
                />
              </div>

              <DueLabel dueDate={f.due_date} status={f.status} />
            </div>
          );
        })}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 divide-x divide-[var(--border,rgba(0,0,0,0.08))] border-t border-[var(--border,rgba(0,0,0,0.08))]">
        <div className="flex flex-col items-center gap-0.5 py-3">
          <span className="text-lg font-semibold font-mono text-[var(--success,#00C851)]">
            {stats.onTrack}
          </span>
          <span className="text-[11px] text-[var(--muted-foreground,#6B7280)]">
            On Track
          </span>
        </div>
        <div className="flex flex-col items-center gap-0.5 py-3">
          <span className="text-lg font-semibold font-mono text-[var(--warning,#FF8C00)]">
            {stats.atRisk}
          </span>
          <span className="text-[11px] text-[var(--muted-foreground,#6B7280)]">
            At Risk
          </span>
        </div>
        <div className="flex flex-col items-center gap-0.5 py-3">
          <span className="text-lg font-semibold font-mono text-[var(--destructive,#d4183d)]">
            {stats.overdue}
          </span>
          <span className="text-[11px] text-[var(--muted-foreground,#6B7280)]">
            Overdue
          </span>
        </div>
      </div>
    </div>
  );
}
