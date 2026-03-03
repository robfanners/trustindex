"use client";

import { useCallback, useEffect, useState } from "react";
import TierGate from "@/components/TierGate";

type Signal = {
  id: string;
  system_name: string;
  signal_type: string;
  metric_name: string;
  metric_value: number;
  source: string;
  severity: string;
  context: Record<string, unknown>;
  created_at: string;
};

const severityBadge: Record<string, string> = {
  info: "bg-blue-100 text-blue-800",
  warning: "bg-amber-100 text-amber-800",
  critical: "bg-red-100 text-red-800",
};

const signalTypeBadge: Record<string, string> = {
  performance: "bg-purple-100 text-purple-800",
  accuracy: "bg-blue-100 text-blue-800",
  fairness: "bg-teal-100 text-teal-800",
  safety: "bg-red-100 text-red-800",
  availability: "bg-green-100 text-green-800",
  compliance: "bg-amber-100 text-amber-800",
  custom: "bg-gray-100 text-gray-600",
};

const sourceBadge: Record<string, string> = {
  manual: "bg-blue-100 text-blue-800",
  webhook: "bg-purple-100 text-purple-800",
  integration: "bg-teal-100 text-teal-800",
};

const signalTypeOptions = ["performance", "accuracy", "fairness", "safety", "availability", "compliance", "custom"];
const severityOptions = ["info", "warning", "critical"];

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function SignalsPage() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [signalType, setSignalType] = useState("");
  const [severity, setSeverity] = useState("");
  const [systemName, setSystemName] = useState("");
  const [days, setDays] = useState(30);
  const [page, setPage] = useState(1);
  const perPage = 20;

  // Distinct system names for filter
  const [systemNames, setSystemNames] = useState<string[]>([]);

  // Add-signal form state
  const [showForm, setShowForm] = useState(false);
  const [formSystem, setFormSystem] = useState("");
  const [formType, setFormType] = useState("performance");
  const [formMetric, setFormMetric] = useState("");
  const [formValue, setFormValue] = useState("");
  const [formSeverity, setFormSeverity] = useState("info");
  const [submitting, setSubmitting] = useState(false);

  const fetchSignals = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        days: String(days),
        page: String(page),
        per_page: String(perPage),
      });
      if (signalType) params.set("signal_type", signalType);
      if (severity) params.set("severity", severity);
      if (systemName) params.set("system_name", systemName);
      const res = await fetch(`/api/monitor/signals?${params}`);
      if (res.ok) {
        const data = await res.json();
        const fetched: Signal[] = data.signals ?? [];
        setSignals(fetched);
        setTotal(data.total ?? 0);
        // Collect distinct system names
        const names = Array.from(new Set(fetched.map((s) => s.system_name))).sort();
        setSystemNames((prev) => {
          const merged = Array.from(new Set([...prev, ...names])).sort();
          return merged;
        });
      }
    } finally {
      setLoading(false);
    }
  }, [signalType, severity, systemName, days, page]);

  useEffect(() => {
    fetchSignals();
  }, [fetchSignals]);

  const totalPages = Math.ceil(total / perPage);
  const warningCount = signals.filter((s) => s.severity === "warning").length;
  const criticalCount = signals.filter((s) => s.severity === "critical").length;

  const startItem = total === 0 ? 0 : (page - 1) * perPage + 1;
  const endItem = Math.min(page * perPage, total);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/monitor/signals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_name: formSystem,
          signal_type: formType,
          metric_name: formMetric,
          metric_value: parseFloat(formValue),
          severity: formSeverity,
        }),
      });
      if (res.ok) {
        setFormSystem("");
        setFormType("performance");
        setFormMetric("");
        setFormValue("");
        setFormSeverity("info");
        setShowForm(false);
        fetchSignals();
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <TierGate requiredTier="Assure" featureLabel="Runtime Signals">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-brand/10 text-brand">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="2" strokeWidth={1.5} />
              <path strokeLinecap="round" strokeWidth={1.5} d="M16.24 7.76a6 6 0 0 1 0 8.49" />
              <path strokeLinecap="round" strokeWidth={1.5} d="M7.76 16.24a6 6 0 0 1 0-8.49" />
              <path strokeLinecap="round" strokeWidth={1.5} d="M19.07 4.93a10 10 0 0 1 0 14.14" />
              <path strokeLinecap="round" strokeWidth={1.5} d="M4.93 19.07a10 10 0 0 1 0-14.14" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Runtime Signals</h1>
            <p className="text-sm text-muted-foreground">Monitor AI system performance and compliance telemetry</p>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="border border-border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">Total Signals</p>
            <p className="text-2xl font-semibold mt-1">{total}</p>
          </div>
          <div className="border border-border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">Warnings</p>
            <p className="text-2xl font-semibold mt-1 text-amber-600">{warningCount}</p>
          </div>
          <div className="border border-border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">Critical</p>
            <p className="text-2xl font-semibold mt-1 text-red-600">{criticalCount}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <select
            value={signalType}
            onChange={(e) => {
              setSignalType(e.target.value);
              setPage(1);
            }}
            className="px-3 py-1.5 rounded-lg border border-border bg-background text-sm"
          >
            <option value="">All signal types</option>
            {signalTypeOptions.map((t) => (
              <option key={t} value={t}>
                {capitalize(t)}
              </option>
            ))}
          </select>
          <select
            value={severity}
            onChange={(e) => {
              setSeverity(e.target.value);
              setPage(1);
            }}
            className="px-3 py-1.5 rounded-lg border border-border bg-background text-sm"
          >
            <option value="">All severities</option>
            {severityOptions.map((s) => (
              <option key={s} value={s}>
                {capitalize(s)}
              </option>
            ))}
          </select>
          <select
            value={systemName}
            onChange={(e) => {
              setSystemName(e.target.value);
              setPage(1);
            }}
            className="px-3 py-1.5 rounded-lg border border-border bg-background text-sm"
          >
            <option value="">All systems</option>
            {systemNames.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <select
            value={days}
            onChange={(e) => {
              setDays(Number(e.target.value));
              setPage(1);
            }}
            className="px-3 py-1.5 rounded-lg border border-border bg-background text-sm"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={180}>Last 180 days</option>
          </select>
        </div>

        {/* Add Signal */}
        <div>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand/90 transition-colors"
          >
            {showForm ? "Cancel" : "Log Signal"}
          </button>
          {showForm && (
            <form onSubmit={handleSubmit} className="mt-4 border border-border rounded-lg p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">System Name</label>
                  <input
                    type="text"
                    required
                    value={formSystem}
                    onChange={(e) => setFormSystem(e.target.value)}
                    placeholder="e.g. fraud-detection-v2"
                    className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Signal Type</label>
                  <select
                    required
                    value={formType}
                    onChange={(e) => setFormType(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-sm"
                  >
                    {signalTypeOptions.map((t) => (
                      <option key={t} value={t}>
                        {capitalize(t)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Metric Name</label>
                  <input
                    type="text"
                    required
                    value={formMetric}
                    onChange={(e) => setFormMetric(e.target.value)}
                    placeholder="e.g. error_rate"
                    className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Metric Value</label>
                  <input
                    type="number"
                    required
                    step="any"
                    value={formValue}
                    onChange={(e) => setFormValue(e.target.value)}
                    placeholder="e.g. 5.2"
                    className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Severity</label>
                  <select
                    value={formSeverity}
                    onChange={(e) => setFormSeverity(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-sm"
                  >
                    {severityOptions.map((s) => (
                      <option key={s} value={s}>
                        {capitalize(s)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand/90 transition-colors disabled:opacity-50"
              >
                {submitting ? "Submitting..." : "Submit Signal"}
              </button>
            </form>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <div className="text-sm text-muted-foreground py-8 text-center">Loading signals...</div>
        ) : signals.length === 0 ? (
          <div className="border border-dashed border-border rounded-xl p-12 text-center space-y-3">
            <div className="flex justify-center text-muted-foreground">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="2" strokeWidth={1.5} />
                <path strokeLinecap="round" strokeWidth={1.5} d="M16.24 7.76a6 6 0 0 1 0 8.49" />
                <path strokeLinecap="round" strokeWidth={1.5} d="M7.76 16.24a6 6 0 0 1 0-8.49" />
                <path strokeLinecap="round" strokeWidth={1.5} d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                <path strokeLinecap="round" strokeWidth={1.5} d="M4.93 19.07a10 10 0 0 1 0-14.14" />
              </svg>
            </div>
            <p className="text-sm text-muted-foreground">
              No signals recorded yet. Log a signal manually or connect an integration to start monitoring.
            </p>
          </div>
        ) : (
          <>
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Date</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">System</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Signal Type</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Metric</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Value</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Severity</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {signals.map((s) => (
                    <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        {new Date(s.created_at).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}{" "}
                        <span className="text-muted-foreground">
                          {new Date(s.created_at).toLocaleTimeString("en-GB", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </td>
                      <td className="px-4 py-3">{s.system_name}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            signalTypeBadge[s.signal_type] ?? "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {capitalize(s.signal_type)}
                        </span>
                      </td>
                      <td className="px-4 py-3">{s.metric_name}</td>
                      <td className="px-4 py-3">{s.metric_value}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            severityBadge[s.severity] ?? "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {capitalize(s.severity)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            sourceBadge[s.source] ?? "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {capitalize(s.source)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Showing {startItem}-{endItem} of {total}
                </span>
                <div className="flex gap-2">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="px-3 py-1 rounded border border-border disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <span className="px-3 py-1 text-muted-foreground">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="px-3 py-1 rounded border border-border disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </TierGate>
  );
}
