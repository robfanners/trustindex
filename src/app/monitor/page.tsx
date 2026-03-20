"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AuthenticatedShell from "@/components/AuthenticatedShell";
import RequireAuth from "@/components/RequireAuth";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MonitorData = {
  escalation_count: number;
  incident_count: number;
  drift_count: number;
  declaration_count: number;
  recent_escalations: Array<{
    id: string;
    reason: string;
    severity: string;
    status: string;
    created_at: string;
  }>;
  recent_incidents: Array<{
    id: string;
    title: string;
    status: string;
    impact_level: string;
    created_at: string;
  }>;
};

// ---------------------------------------------------------------------------
// Components
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
  stat?: number | string;
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
        <h3 className="text-sm font-semibold text-[var(--foreground,#111)] group-hover:text-[var(--coral,#e8614d)] transition-colors">
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

function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    critical: "bg-red-100 text-red-800",
    high: "bg-orange-100 text-orange-800",
    medium: "bg-amber-100 text-amber-800",
    low: "bg-green-100 text-green-800",
  };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${colors[severity?.toLowerCase()] ?? "bg-gray-100 text-gray-700"}`}>
      {severity}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function MonitorDashboard() {
  return (
    <RequireAuth>
      <MonitorContent />
    </RequireAuth>
  );
}

function MonitorContent() {
  const [data, setData] = useState<MonitorData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard/control-centre")
      .then((r) => r.json())
      .then((d) => {
        if (!d.error) {
          setData({
            escalation_count: d.monitor?.escalation_count ?? 0,
            incident_count: d.monitor?.incident_count ?? 0,
            drift_count: d.monitor?.drift_count ?? 0,
            declaration_count: d.monitor?.declaration_count ?? 0,
            recent_escalations: d.monitor?.escalations ?? [],
            recent_incidents: d.monitor?.incidents ?? [],
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <AuthenticatedShell>
      <div className="flex flex-col gap-6">
        {/* Page header */}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Monitor</h1>
          <p className="text-sm text-[var(--muted-foreground,#6B7280)] mt-1">
            Continuously watch your AI estate for drift, incidents, and compliance risks
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-current border-t-transparent" />
          </div>
        ) : (
          <>
            {/* Status strip */}
            <div className="flex items-center justify-center gap-0 rounded-xl border border-[var(--border,rgba(0,0,0,0.08))] bg-white py-5 divide-x divide-[var(--border,rgba(0,0,0,0.08))]">
              <StatBadge
                value={data?.escalation_count ?? 0}
                label="Escalations"
                color={data?.escalation_count ? "var(--coral, #e8614d)" : undefined}
              />
              <StatBadge
                value={data?.drift_count ?? 0}
                label="Drift Events"
                color={data?.drift_count ? "#D97706" : undefined}
              />
              <StatBadge
                value={data?.incident_count ?? 0}
                label="Incidents"
                color={data?.incident_count ? "#DC2626" : undefined}
              />
            </div>

            {/* Module grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <ModuleCard
                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>}
                title="Drift & Alerts"
                description="Track score drift over time. Get alerted when assessments shift beyond thresholds."
                href="/monitor/drift"
                stat={data?.drift_count ?? 0}
                statLabel="Events"
                color="#D97706"
              />

              <ModuleCard
                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>}
                title="Escalations"
                description="Manage governance escalations. Assign, track, and resolve issues that need attention."
                href="/monitor/escalations"
                stat={data?.escalation_count ?? 0}
                statLabel="Active"
                color="#E8614D"
              />

              <ModuleCard
                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>}
                title="Incidents"
                description="Log and investigate AI incidents. Record impact, root cause, and remediation steps."
                href="/monitor/incidents"
                stat={data?.incident_count ?? 0}
                statLabel="Open"
                color="#DC2626"
              />

              <ModuleCard
                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><polyline points="17 11 19 13 23 9" /></svg>}
                title="Declarations"
                description="Collect staff declarations about AI usage. Issue tokens and track compliance."
                href="/monitor/declarations"
                stat={data?.declaration_count ?? 0}
                statLabel="Submitted"
                color="#0891B2"
              />

              <ModuleCard
                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>}
                title="Signals"
                description="Monitor real-time governance signals. Surface emerging risks and patterns."
                href="/monitor/signals"
                stat="—"
                statLabel=""
                color="#6366F1"
              />
            </div>

            {/* Recent activity */}
            {(data?.recent_escalations?.length || data?.recent_incidents?.length) ? (
              <>
                <div className="flex items-center gap-2.5">
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--muted-foreground,#6B7280)]">
                    Recent Activity
                  </span>
                  <div className="flex-1 h-px bg-[var(--border,rgba(0,0,0,0.08))]" />
                </div>

                <div className="rounded-xl border border-[var(--border,rgba(0,0,0,0.08))] bg-white overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-[var(--border,rgba(0,0,0,0.08))] text-left">
                        <th className="px-4 py-2.5 text-xs font-medium text-[var(--muted-foreground,#6B7280)]">Type</th>
                        <th className="px-4 py-2.5 text-xs font-medium text-[var(--muted-foreground,#6B7280)]">Description</th>
                        <th className="px-4 py-2.5 text-xs font-medium text-[var(--muted-foreground,#6B7280)] hidden sm:table-cell">Severity</th>
                        <th className="px-4 py-2.5 text-xs font-medium text-[var(--muted-foreground,#6B7280)] hidden md:table-cell">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ...(data?.recent_escalations?.slice(0, 3).map((e) => ({
                          type: "Escalation",
                          desc: e.reason,
                          severity: e.severity,
                          date: e.created_at,
                          id: e.id,
                        })) ?? []),
                        ...(data?.recent_incidents?.slice(0, 3).map((i) => ({
                          type: "Incident",
                          desc: i.title,
                          severity: i.impact_level,
                          date: i.created_at,
                          id: i.id,
                        })) ?? []),
                      ]
                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                        .slice(0, 5)
                        .map((item) => (
                          <tr key={item.id} className="border-b border-[var(--border,rgba(0,0,0,0.06))] last:border-0">
                            <td className="px-4 py-2.5">
                              <span className={`text-xs font-medium ${item.type === "Incident" ? "text-red-700" : "text-orange-700"}`}>
                                {item.type}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-[var(--foreground,#111)]">{item.desc}</td>
                            <td className="px-4 py-2.5 hidden sm:table-cell">
                              <SeverityBadge severity={item.severity} />
                            </td>
                            <td className="px-4 py-2.5 text-[var(--muted-foreground,#6B7280)] hidden md:table-cell">
                              {new Date(item.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}
          </>
        )}
      </div>
    </AuthenticatedShell>
  );
}
