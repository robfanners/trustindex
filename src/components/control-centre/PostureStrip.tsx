"use client";

type PostureData = {
  govern: {
    health_score: number | null;
    open_actions: number;
    overdue_actions: number;
  };
  monitor: {
    escalation_count: number;
    drift_count: number;
    incident_count: number;
  };
  prove: {
    attestation_count: number;
    provenance_count: number;
  };
};

type PostureStripProps = {
  data: PostureData;
};

/* ---- tiny inline SVG icons ---- */

function GovernIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M7 1L1 4v2c0 3.87 2.56 7.49 6 8.5 3.44-1.01 6-4.63 6-8.5V4L7 1z"
        stroke="var(--brand, #0066FF)"
        strokeWidth="1.4"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

function MonitorIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M1 10l3-4 3 2.5L11 3"
        stroke="var(--coral, #e8614d)"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="13" cy="1" r="0" fill="none" />
    </svg>
  );
}

function ProveIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3 7.5l2.5 2.5L11 4"
        stroke="var(--teal, #0d9488)"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ---- metric cell ---- */

function Metric({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-2xl font-semibold font-mono leading-none tracking-tight">
        {value}
      </span>
      <span className="text-[11px] text-[var(--muted-foreground,#6B7280)] leading-tight">
        {label}
      </span>
    </div>
  );
}

/* ---- tier column ---- */

function TierColumn({
  label,
  icon,
  barColor,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  barColor: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="group relative flex flex-1 flex-col items-center gap-3 rounded-lg px-4 py-4 transition-colors duration-150 hover:bg-black/[0.025]"
    >
      {/* tier label */}
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground,#6B7280)]">
          {label}
        </span>
      </div>

      {/* metrics row */}
      <div className="flex items-end justify-center gap-6">{children}</div>

      {/* colored bottom bar */}
      <div
        className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full"
        style={{ backgroundColor: barColor }}
      />
    </div>
  );
}

/* ---- main component ---- */

export default function PostureStrip({ data }: PostureStripProps) {
  const { govern, monitor, prove } = data;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-[var(--border,rgba(0,0,0,0.08))] bg-white sm:flex-row sm:gap-0 sm:divide-x sm:divide-[var(--border,rgba(0,0,0,0.08))]">
      {/* Govern */}
      <TierColumn
        label="Govern"
        icon={<GovernIcon />}
        barColor="var(--brand, #0066FF)"
      >
        <Metric
          value={govern.health_score != null ? govern.health_score : "--"}
          label="Health"
        />
        <Metric value={govern.open_actions} label="Open" />
        <Metric value={govern.overdue_actions} label="Overdue" />
      </TierColumn>

      {/* Monitor */}
      <TierColumn
        label="Monitor"
        icon={<MonitorIcon />}
        barColor="var(--coral, #e8614d)"
      >
        <Metric value={monitor.escalation_count} label="Escalations" />
        <Metric value={monitor.drift_count} label="Drift" />
        <Metric value={monitor.incident_count} label="Incidents" />
      </TierColumn>

      {/* Prove */}
      <TierColumn
        label="Prove"
        icon={<ProveIcon />}
        barColor="var(--teal, #0d9488)"
      >
        <Metric value={prove.attestation_count} label="Attestations" />
        <Metric value={prove.provenance_count} label="Provenance" />
      </TierColumn>
    </div>
  );
}
