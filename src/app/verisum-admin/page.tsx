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
          {Array.from({ length: 8 }).map((_, i) => (
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Platform Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          Real-time overview of the TrustGraph platform
        </p>
      </div>

      {/* Primary metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Total Users"
          value={metrics.totalUsers}
          accent="blue"
        />
        <MetricCard
          label="Active Systems"
          value={metrics.activeSystems}
          accent="green"
        />
        <MetricCard
          label="Total Surveys"
          value={metrics.totalSurveys}
          accent="blue"
        />
        <MetricCard
          label="System Runs"
          value={metrics.totalSystemRuns}
          accent="green"
        />
      </div>

      {/* Plan breakdown + alerts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Explorer Plans"
          value={metrics.planCounts.explorer}
          accent="gray"
        />
        <MetricCard
          label="Pro Plans"
          value={metrics.planCounts.pro}
          accent="blue"
        />
        <MetricCard
          label="Enterprise Plans"
          value={metrics.planCounts.enterprise}
          accent="green"
        />
        <MetricCard
          label="Suspended"
          value={metrics.suspendedCount}
          accent={metrics.suspendedCount > 0 ? "red" : "gray"}
          sub={metrics.suspendedCount > 0 ? "Requires attention" : "None"}
        />
      </div>

      {/* Risk flags */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Risk Flags"
          value={metrics.riskFlagCount}
          accent={metrics.riskFlagCount > 0 ? "amber" : "gray"}
          sub="System runs with risk flags"
        />
      </div>
    </div>
  );
}
