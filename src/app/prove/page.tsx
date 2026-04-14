"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getCapabilityIcon } from "@/lib/capabilityIcons";

// TG-52 — module card icons sourced from the single capability registry.
const ApprovalsIcon = getCapabilityIcon("approvals");
const AttestationsIcon = getCapabilityIcon("attestations");
const ProvenanceIcon = getCapabilityIcon("provenance");
const DecisionsIcon = getCapabilityIcon("decisions");
const IncidentLockIcon = getCapabilityIcon("incident-lock");
const TrustExchangeIcon = getCapabilityIcon("trust-exchange");
const VerificationIcon = getCapabilityIcon("verification");

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
  return <ProveContent />;
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
                icon={<ApprovalsIcon className="w-4 h-4" strokeWidth={1.75} />}
                title="Approvals"
                description="Manage governance approval workflows. Route decisions through the right stakeholders."
                href="/prove/approvals"
                stat={data?.approval_count ?? 0}
                statLabel="Pending"
                color="#0891B2"
              />

              <ModuleCard
                icon={<AttestationsIcon className="w-4 h-4" strokeWidth={1.75} />}
                title="Attestations"
                description="Issue cryptographically signed governance attestations. Prove compliance at a point in time."
                href="/prove/attestations"
                stat={data?.attestation_count ?? 0}
                statLabel="Active"
                color="#0D9488"
              />

              <ModuleCard
                icon={<ProvenanceIcon className="w-4 h-4" strokeWidth={1.75} />}
                title="Provenance"
                description="Track the origin and lineage of AI decisions. Maintain an immutable audit trail."
                href="/prove/provenance"
                stat={data?.provenance_count ?? 0}
                statLabel="Records"
                color="#7C3AED"
              />

              <ModuleCard
                icon={<DecisionsIcon className="w-4 h-4" strokeWidth={1.75} />}
                title="Decisions"
                description="Record and justify governance decisions. Create a decision ledger for audit and accountability."
                href="/prove/decisions"
                stat={data?.decision_count ?? 0}
                statLabel="Logged"
                color="#2563EB"
              />

              <ModuleCard
                icon={<IncidentLockIcon className="w-4 h-4" strokeWidth={1.75} />}
                title="Incident Lock"
                description="Freeze incident evidence for investigation. Prevent tampering with critical records."
                href="/prove/incident-locks"
                color="#DC2626"
              />

              <ModuleCard
                icon={<TrustExchangeIcon className="w-4 h-4" strokeWidth={1.75} />}
                title="Trust Exchange"
                description="Share governance credentials with partners. Exchange verified trust signals between organisations."
                href="/prove/exchanges"
                color="#059669"
              />

              <ModuleCard
                icon={<VerificationIcon className="w-4 h-4" strokeWidth={1.75} />}
                title="Verification"
                description="Verify governance claims and attestations. Confirm the validity of trust credentials."
                href="/prove/verification"
                color="#6366F1"
              />
            </div>
          </>
        )}
      </div>
  );
}
