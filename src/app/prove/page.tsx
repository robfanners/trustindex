"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AuthenticatedShell from "@/components/AuthenticatedShell";
import RequireAuth from "@/components/RequireAuth";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ProveData = {
  attestation_count: number;
  provenance_count: number;
  approval_count: number;
  decision_count: number;
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
        <h3 className="text-sm font-semibold text-[var(--foreground,#111)] group-hover:text-[var(--teal,#0d9488)] transition-colors">
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

export default function ProveDashboard() {
  return (
    <RequireAuth>
      <ProveContent />
    </RequireAuth>
  );
}

function ProveContent() {
  const [data, setData] = useState<ProveData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard/control-centre")
      .then((r) => r.json())
      .then((d) => {
        if (!d.error) {
          setData({
            attestation_count: d.prove?.attestation_count ?? 0,
            provenance_count: d.prove?.provenance_count ?? 0,
            approval_count: d.prove?.approval_count ?? 0,
            decision_count: d.prove?.decision_count ?? 0,
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
          <h1 className="text-2xl font-semibold tracking-tight">Prove</h1>
          <p className="text-sm text-[var(--muted-foreground,#6B7280)] mt-1">
            Demonstrate compliance, issue attestations, and build verifiable trust
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
                value={data?.attestation_count ?? 0}
                label="Attestations"
                color="var(--teal, #0d9488)"
              />
              <StatBadge
                value={data?.provenance_count ?? 0}
                label="Provenance Records"
              />
            </div>

            {/* Module grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <ModuleCard
                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0 1 12 2.944a11.955 11.955 0 0 1-8.618 3.04A12.02 12.02 0 0 0 3 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>}
                title="Approvals"
                description="Manage governance approval workflows. Route decisions through the right stakeholders."
                href="/prove/approvals"
                stat={data?.approval_count ?? 0}
                statLabel="Pending"
                color="#0891B2"
              />

              <ModuleCard
                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>}
                title="Attestations"
                description="Issue cryptographically signed governance attestations. Prove compliance at a point in time."
                href="/prove/attestations"
                stat={data?.attestation_count ?? 0}
                statLabel="Active"
                color="#0D9488"
              />

              <ModuleCard
                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>}
                title="Provenance"
                description="Track the origin and lineage of AI decisions. Maintain an immutable audit trail."
                href="/prove/provenance"
                stat={data?.provenance_count ?? 0}
                statLabel="Records"
                color="#7C3AED"
              />

              <ModuleCard
                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg>}
                title="Decisions"
                description="Record and justify governance decisions. Create a decision ledger for audit and accountability."
                href="/prove/decisions"
                stat={data?.decision_count ?? 0}
                statLabel="Logged"
                color="#2563EB"
              />

              <ModuleCard
                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>}
                title="Incident Lock"
                description="Freeze incident evidence for investigation. Prevent tampering with critical records."
                href="/prove/incident-locks"
                color="#DC2626"
              />

              <ModuleCard
                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></svg>}
                title="Trust Exchange"
                description="Share governance credentials with partners. Exchange verified trust signals between organisations."
                href="/prove/exchanges"
                color="#059669"
              />

              <ModuleCard
                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>}
                title="Verification"
                description="Verify governance claims and attestations. Confirm the validity of trust credentials."
                href="/prove/verification"
                color="#6366F1"
              />
            </div>
          </>
        )}
      </div>
    </AuthenticatedShell>
  );
}
