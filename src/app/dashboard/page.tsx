"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
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

// Map internal plan key → customer-facing label
const PLAN_LABEL: Record<string, string> = {
  starter: "Core",
  pro: "Assure",
  enterprise: "Verify",
};

function DashboardContent() {
  const { profile, refreshProfile } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [data, setData] = useState<ControlCentreData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showUpgradeBanner, setShowUpgradeBanner] = useState(false);

  // Handle post-payment redirect: show success banner + force profile refresh
  // so the new plan state is visible immediately (Stripe checkout success_url
  // redirects here with ?upgraded=true).
  useEffect(() => {
    if (searchParams.get("upgraded") === "true") {
      setShowUpgradeBanner(true);
      // Force a profile refresh so plan limits / UI gating reflect the new plan
      refreshProfile();
      // Clean up the URL so a refresh doesn't re-show the banner
      router.replace("/dashboard");
    }
  }, [searchParams, refreshProfile, router]);

  useEffect(() => {
    fetch("/api/dashboard/control-centre")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          setError(d.error);
        } else {
          setData(d);
        }
      })
      .catch(() => setError("Failed to load dashboard"))
      .finally(() => setLoading(false));
  }, []);

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const planLabel = PLAN_LABEL[profile?.plan ?? ""] ?? null;

  return (
    <AuthenticatedShell>
      <div className="flex flex-col gap-[18px]">
        {/* Upgrade success banner — shown after returning from Stripe checkout */}
        {showUpgradeBanner && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-emerald-900">
                {planLabel ? `Welcome to Verisum ${planLabel}!` : "Subscription confirmed!"}
              </p>
              <p className="text-sm text-emerald-800 mt-1">
                Your plan is now active. New features are unlocked across the app.{" "}
                <Link href="/setup" className="underline font-medium">
                  Run the setup wizard
                </Link>{" "}
                to configure your governance bundle, or{" "}
                <Link href="/dashboard/settings" className="underline font-medium">
                  visit Settings
                </Link>{" "}
                to invite your team.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowUpgradeBanner(false)}
              className="flex-shrink-0 text-emerald-700 hover:text-emerald-900"
              aria-label="Dismiss"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

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

        {/* Error state */}
        {!loading && error && (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground mb-3">{error}</p>
            <Link
              href="/setup"
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover transition-colors"
            >
              Complete setup
            </Link>
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
                <ScoreRing
                  score={data.govern.health_score}
                  orgScore={data.govern.org_base}
                  sysScore={data.govern.sys_base}
                />
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
