"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import AuthenticatedShell from "@/components/AuthenticatedShell";
import RequireAuth from "@/components/RequireAuth";

import PostureStrip from "@/components/control-centre/PostureStrip";
import IncidentsList from "@/components/control-centre/IncidentsList";
import ScoreRing from "@/components/control-centre/ScoreRing";
import QuickActions from "@/components/control-centre/QuickActions";
import ComplianceGrid from "@/components/control-centre/ComplianceGrid";
import DriftList from "@/components/control-centre/DriftList";
import RegFeedCard from "@/components/control-centre/RegFeedCard";
import ActivityFeed from "@/components/control-centre/ActivityFeed";
import HAPPStrip from "@/components/control-centre/HAPPStrip";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ControlCentreData = {
  plan: string;
  govern: {
    health_score: number | null;
    org_base: number | null;
    sys_base: number | null;
    open_actions: number;
    overdue_actions: number;
  };
  monitor: {
    escalations: Array<{
      id: string;
      reason: string;
      severity: string;
      status: string;
      created_at: string;
      assigned_to?: string;
    }>;
    escalation_count: number;
    incidents: Array<{
      id: string;
      title: string;
      status: string;
      impact_level: string;
      created_at: string;
    }>;
    incident_count: number;
    drift_events: Array<{
      id: string;
      run_type: string;
      delta_score: number;
      created_at: string;
    }>;
    drift_count: number;
  };
  prove: { attestation_count: number; provenance_count: number };
  frameworks: Array<{
    id: string;
    name: string;
    coverage_pct: number;
    status: string;
    due_date: string | null;
  }>;
  regulatory: Array<{
    id: string;
    title: string;
    jurisdictions: string[];
    published_at: string;
  }>;
  activity: Array<{
    id: string;
    entity_type: string;
    action_type: string;
    performed_by: string;
    metadata?: Record<string, unknown>;
    created_at: string;
  }>;
};

// ---------------------------------------------------------------------------
// Root page
// ---------------------------------------------------------------------------

export default function DashboardHome() {
  return (
    <RequireAuth>
      <DashboardContent />
    </RequireAuth>
  );
}

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

function DashboardContent() {
  useAuth();
  const [data, setData] = useState<ControlCentreData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard/control-centre")
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <AuthenticatedShell>
      <div className="flex flex-col gap-[18px]">
        {/* Page header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Control Centre
            </h1>
            <p className="text-sm text-muted-foreground">
              AI Governance Command Surface &middot; {today}
            </p>
          </div>
          <Link
            href="/reports"
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-accent transition-colors"
          >
            Export Briefing
          </Link>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-24">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-current border-t-transparent" />
          </div>
        )}

        {/* Dashboard content */}
        {!loading && data && (
          <>
            {/* Posture Strip */}
            <PostureStrip
              data={{
                govern: {
                  health_score: data.govern.health_score,
                  open_actions: data.govern.open_actions,
                  overdue_actions: data.govern.overdue_actions,
                },
                monitor: {
                  escalation_count: data.monitor.escalation_count,
                  drift_count: data.monitor.drift_count,
                  incident_count: data.monitor.incident_count,
                },
                prove: data.prove,
              }}
            />

            {/* Row 1: Incidents + Score/Actions (65/35) */}
            <div className="grid grid-cols-1 lg:grid-cols-[1.85fr_1fr] gap-4">
              <IncidentsList
                escalations={data.monitor.escalations}
                incidents={data.monitor.incidents}
              />
              <div className="flex flex-col gap-4">
                <ScoreRing score={data.govern.health_score} />
                <QuickActions />
              </div>
            </div>

            {/* Section divider */}
            <div className="flex items-center gap-2.5">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Governance Detail
              </span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Row 2: Compliance + Drift + Reg/Activity (2fr 1fr 1fr) */}
            <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr_1fr] gap-4">
              <ComplianceGrid frameworks={data.frameworks} />
              <div className="flex flex-col gap-4">
                <DriftList events={data.monitor.drift_events} />
              </div>
              <div className="flex flex-col gap-4">
                <RegFeedCard updates={data.regulatory} />
                <ActivityFeed items={data.activity} />
              </div>
            </div>

            {/* HAPP Strip */}
            <HAPPStrip
              proofCount={data.prove.provenance_count}
              attestationCount={data.prove.attestation_count}
              plan={data.plan}
            />
          </>
        )}
      </div>
    </AuthenticatedShell>
  );
}
