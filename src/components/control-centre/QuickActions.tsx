"use client";

import Link from "next/link";

/* ------------------------------------------------------------------ */
/*  Icons (inline SVGs)                                               */
/* ------------------------------------------------------------------ */

const iconCls = "w-5 h-5";

function EscalateIcon() {
  return (
    <svg className={iconCls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    </svg>
  );
}

function AssessmentIcon() {
  return (
    <svg className={iconCls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  );
}

function PolicyIcon() {
  return (
    <svg className={iconCls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function AttestationIcon() {
  return (
    <svg className={iconCls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}

function DriftIcon() {
  return (
    <svg className={iconCls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  );
}

function ReportIcon() {
  return (
    <svg className={iconCls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Action definitions                                                */
/* ------------------------------------------------------------------ */

type Action = {
  label: string;
  href: string;
  icon: React.ReactNode;
  iconBg: string;
};

const ACTIONS: Action[] = [
  {
    label: "Escalate Incident",
    href: "/monitor/escalations",
    icon: <EscalateIcon />,
    iconBg: "bg-[var(--destructive,#d4183d)]/10 text-[var(--destructive,#d4183d)]",
  },
  {
    label: "New Assessment",
    href: "/trustsys",
    icon: <AssessmentIcon />,
    iconBg: "bg-[var(--brand,#0066FF)]/10 text-[var(--brand,#0066FF)]",
  },
  {
    label: "Run Policy Check",
    href: "/copilot/generate-policy",
    icon: <PolicyIcon />,
    iconBg: "bg-[var(--warning,#FF8C00)]/10 text-[var(--warning,#FF8C00)]",
  },
  {
    label: "Issue Attestation",
    href: "/prove/attestations",
    icon: <AttestationIcon />,
    iconBg: "bg-[var(--teal,#0d9488)]/10 text-[var(--teal,#0d9488)]",
  },
  {
    label: "Check Drift Score",
    href: "/monitor/drift",
    icon: <DriftIcon />,
    iconBg: "bg-[var(--coral,#e8614d)]/10 text-[var(--coral,#e8614d)]",
  },
  {
    label: "Board Report Pack",
    href: "/reports",
    icon: <ReportIcon />,
    iconBg: "bg-gray-100 text-[var(--muted-foreground,#6B7280)] border border-[var(--border,rgba(0,0,0,0.08))]",
  },
];

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export default function QuickActions() {
  return (
    <div className="rounded-xl border border-[var(--border,rgba(0,0,0,0.08))] bg-white">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[var(--border,rgba(0,0,0,0.08))]">
        <h3 className="text-sm font-semibold text-gray-900">Quick Actions</h3>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-3 p-5">
        {ACTIONS.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="flex items-center gap-3 rounded-lg px-3 py-3 transition-all duration-150 border border-transparent hover:border-[var(--brand,#0066FF)] hover:bg-[var(--brand,#0066FF)]/5"
          >
            <span
              className={`shrink-0 flex items-center justify-center w-9 h-9 rounded-lg ${action.iconBg}`}
            >
              {action.icon}
            </span>
            <span className="text-sm font-medium text-gray-800">
              {action.label}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
