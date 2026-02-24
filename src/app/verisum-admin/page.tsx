"use client";

import { useEffect, useState } from "react";
import MetricCard from "@/components/vcc/MetricCard";
import type { DashboardMetrics } from "@/lib/vcc/types";

export default function VCCDashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/verisum-admin/dashboard");
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body.error ?? `Error ${res.status}`);
          return;
        }
        const { data } = await res.json();
        setMetrics(data);
      } catch {
        setError("Failed to load dashboard metrics");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-gray-200 rounded w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-24 bg-gray-200 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-red-700">{error}</p>
      </div>
    );
  }

  if (!metrics) return null;

  // Score-based accent for avg system score
  const scoreAccent = (() => {
    if (metrics.avgSystemScore == null) return "gray" as const;
    if (metrics.avgSystemScore >= 80) return "green" as const;
    if (metrics.avgSystemScore >= 60) return "blue" as const;
    if (metrics.avgSystemScore >= 40) return "amber" as const;
    return "red" as const;
  })();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Platform Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          Real-time overview of the TrustGraph platform
        </p>
      </div>

      {/* ───────────────── Platform Overview ───────────────── */}
      <div>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
          Platform Overview
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Total Users"
            value={metrics.totalUsers}
            accent="blue"
            href="/verisum-admin/organisations"
          />
          <MetricCard
            label="Active Systems"
            value={metrics.activeSystems}
            accent="green"
            href="/verisum-admin/systems"
          />
          <MetricCard
            label="Total Surveys"
            value={metrics.totalSurveys}
            accent="blue"
            href="/verisum-admin/surveys"
          />
          <MetricCard
            label="System Runs"
            value={metrics.totalSystemRuns}
            accent="green"
            href="/verisum-admin/systems"
          />
        </div>
      </div>

      {/* ───────────────── Plans & Alerts ───────────────── */}
      <div>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
          Plans &amp; Alerts
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Explorer Plans"
            value={metrics.planCounts.explorer}
            accent="gray"
            href="/verisum-admin/organisations?plan=explorer"
          />
          <MetricCard
            label="Pro Plans"
            value={metrics.planCounts.pro}
            accent="blue"
            href="/verisum-admin/organisations?plan=pro"
          />
          <MetricCard
            label="Enterprise Plans"
            value={metrics.planCounts.enterprise}
            accent="green"
            href="/verisum-admin/organisations?plan=enterprise"
          />
          <MetricCard
            label="Suspended"
            value={metrics.suspendedCount}
            accent={metrics.suspendedCount > 0 ? "red" : "gray"}
            sub={metrics.suspendedCount > 0 ? "Requires attention" : "None"}
            href="/verisum-admin/organisations?status=suspended"
          />
        </div>
      </div>

      {/* ───────────────── Activity & Growth ───────────────── */}
      <div>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
          Activity &amp; Growth
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <MetricCard
            label="New Users (7d)"
            value={metrics.newUsersThisWeek}
            accent="green"
            href="/verisum-admin/organisations"
          />
          <MetricCard
            label="New Users (30d)"
            value={metrics.newUsersThisMonth}
            accent="blue"
            href="/verisum-admin/organisations"
          />
          <MetricCard
            label="Live Surveys"
            value={metrics.liveSurveys}
            accent="green"
            href="/verisum-admin/surveys?status=live"
          />
          <MetricCard
            label="Closed Surveys"
            value={metrics.closedSurveys}
            accent="gray"
            href="/verisum-admin/surveys?status=closed"
          />
          <MetricCard
            label="Total Respondents"
            value={metrics.totalRespondents}
            accent="blue"
          />
        </div>
      </div>

      {/* ───────────────── Assessment Quality ───────────────── */}
      <div>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
          Assessment Quality
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Submitted Runs"
            value={metrics.submittedRuns}
            accent="green"
            href="/verisum-admin/systems"
          />
          <MetricCard
            label="Draft Runs"
            value={metrics.draftRuns}
            accent="amber"
            href="/verisum-admin/systems"
          />
          <MetricCard
            label="Avg System Score"
            value={metrics.avgSystemScore != null ? metrics.avgSystemScore : "—"}
            accent={scoreAccent}
            sub={metrics.avgSystemScore != null ? "Across all submitted runs" : "No submitted runs yet"}
          />
          <MetricCard
            label="Low-Score Systems"
            value={metrics.lowScoreSystems}
            accent={metrics.lowScoreSystems > 0 ? "red" : "gray"}
            sub="Score below 60"
            href="/verisum-admin/systems"
          />
        </div>
      </div>

      {/* ───────────────── Engagement ───────────────── */}
      <div>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
          Engagement
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Avg Respondents / Survey"
            value={metrics.avgRespondentsPerSurvey}
            accent="blue"
          />
          <MetricCard
            label="Surveys with 0 Responses"
            value={metrics.surveysWithZeroResponses}
            accent={metrics.surveysWithZeroResponses > 0 ? "amber" : "gray"}
            href="/verisum-admin/surveys"
          />
          <MetricCard
            label="Risk Flags"
            value={metrics.riskFlagCount}
            accent={metrics.riskFlagCount > 0 ? "amber" : "gray"}
            sub="System runs with risk flags"
            href="/verisum-admin/risk-monitor"
          />
        </div>
      </div>
    </div>
  );
}
