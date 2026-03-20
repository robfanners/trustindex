"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type GovernData = {
  health_score: number | null;
  org_base: number | null;
  sys_base: number | null;
  open_actions: number;
  overdue_actions: number;
  survey_count: number;
  system_count: number;
  policy_count: number;
  vendor_count: number;
  model_count: number;
};

// ---------------------------------------------------------------------------
// Module cards
// ---------------------------------------------------------------------------

function ModuleCard({
  icon,
  title,
  description,
  href,
  stat,
  statLabel,
  color,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  href: string;
  stat?: number | string | null;
  statLabel?: string;
  color: string;
}) {
  return (
    <Link
      href={href}
      className="group relative flex flex-col gap-3 rounded-xl border border-[var(--border,rgba(0,0,0,0.08))] bg-white p-5 hover:shadow-md transition-all duration-200 no-underline"
    >
      <div className="flex items-start justify-between">
        <div
          className="flex items-center justify-center w-9 h-9 rounded-lg"
          style={{ backgroundColor: `${color}15`, color }}
        >
          {icon}
        </div>
        {stat != null && (
          <div className="text-right">
            <div className="text-lg font-semibold font-mono tabular-nums text-[var(--foreground,#111)]">
              {stat}
            </div>
            {statLabel && (
              <div className="text-[10px] text-[var(--muted-foreground,#6B7280)] uppercase tracking-wider">
                {statLabel}
              </div>
            )}
          </div>
        )}
      </div>
      <div>
        <h3 className="text-sm font-semibold text-[var(--foreground,#111)] group-hover:text-[var(--brand,#0066FF)] transition-colors">
          {title}
        </h3>
        <p className="text-xs text-[var(--muted-foreground,#6B7280)] mt-1 leading-relaxed">
          {description}
        </p>
      </div>
      <div className="absolute bottom-0 left-4 right-4 h-[2px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity" style={{ backgroundColor: color }} />
    </Link>
  );
}

function StatBadge({ value, label, color }: { value: number | string; label: string; color?: string }) {
  return (
    <div className="flex flex-col items-center gap-1 px-4">
      <span className="text-2xl font-semibold font-mono tabular-nums" style={color ? { color } : undefined}>
        {value}
      </span>
      <span className="text-[11px] text-[var(--muted-foreground,#6B7280)] uppercase tracking-wider">
        {label}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function GovernDashboard() {
  return <GovernContent />;
}

function GovernContent() {
  const [data, setData] = useState<GovernData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard/control-centre")
      .then((r) => r.json())
      .then((d) => {
        if (!d.error) {
          setData({
            health_score: d.govern?.health_score ?? null,
            org_base: d.govern?.org_base ?? null,
            sys_base: d.govern?.sys_base ?? null,
            open_actions: d.govern?.open_actions ?? 0,
            overdue_actions: d.govern?.overdue_actions ?? 0,
            survey_count: d.govern?.survey_count ?? 0,
            system_count: d.govern?.system_count ?? 0,
            policy_count: d.govern?.policy_count ?? 0,
            vendor_count: d.govern?.vendor_count ?? 0,
            model_count: d.govern?.model_count ?? 0,
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
      <div className="flex flex-col gap-6">
        {/* Page header */}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Govern</h1>
          <p className="text-sm text-[var(--muted-foreground,#6B7280)] mt-1">
            Establish and maintain your AI governance framework
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-current border-t-transparent" />
          </div>
        ) : (
          <>
            {/* Health summary strip */}
            <div className="flex items-center justify-center gap-0 rounded-xl border border-[var(--border,rgba(0,0,0,0.08))] bg-white py-5 divide-x divide-[var(--border,rgba(0,0,0,0.08))]">
              <StatBadge
                value={data?.health_score ?? "--"}
                label="Health Score"
                color="var(--brand, #0066FF)"
              />
              <StatBadge value={data?.open_actions ?? 0} label="Open Actions" />
              <StatBadge
                value={data?.overdue_actions ?? 0}
                label="Overdue"
                color={data?.overdue_actions ? "var(--destructive, #dc2626)" : undefined}
              />
            </div>

            {/* Module grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <ModuleCard
                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>}
                title="TrustGraph"
                description="View your composite trust score. Assess organisational readiness and individual AI systems."
                href="/govern/trustgraph"
                stat={data?.health_score ?? "--"}
                statLabel="Score"
                color="#0066FF"
              />

              <ModuleCard
                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" /></svg>}
                title="Policies"
                description="Generate and manage AI governance policies. Use the copilot to create policies aligned to your context."
                href="/copilot/generate-policy"
                stat={data?.policy_count ?? 0}
                statLabel="Policies"
                color="#8B5CF6"
              />

              <ModuleCard
                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" /></svg>}
                title="AI Registry"
                description="Maintain a central register of all AI systems with risk classifications and compliance status."
                href="/govern/registry"
                stat={(data?.system_count ?? 0)}
                statLabel="Systems"
                color="#0891B2"
              />

              <ModuleCard
                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z" /><path d="M9 22V12h6v10" /></svg>}
                title="Vendors"
                description="Track and assess AI vendors. Evaluate third-party risk and maintain supplier records."
                href="/govern/vendors"
                stat={data?.vendor_count ?? 0}
                statLabel="Vendors"
                color="#D97706"
              />

              <ModuleCard
                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M9 9h6M9 12h6M9 15h4" /></svg>}
                title="Models"
                description="Register and monitor AI models deployed across your organisation."
                href="/govern/models"
                stat={data?.model_count ?? 0}
                statLabel="Models"
                color="#059669"
              />

              <ModuleCard
                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>}
                title="Actions"
                description="Track remediation actions arising from assessments and governance reviews."
                href="/actions"
                stat={data?.open_actions ?? 0}
                statLabel="Open"
                color={data?.overdue_actions ? "#DC2626" : "#6B7280"}
              />
            </div>
          </>
        )}
      </div>
  );
}
