"use client";

import { useCallback, useEffect, useState } from "react";
import TierGate from "@/components/TierGate";

type IncidentLock = {
  id: string;
  incident_id: string;
  lock_reason: string | null;
  snapshot: {
    title: string;
    description: string | null;
    impact_level: string;
    status: string;
    resolution: string | null;
  };
  locked_by: string | null;
  locked_at: string;
  verification_id: string;
  event_hash: string;
  chain_tx_hash: string | null;
  chain_status: string;
  created_at: string;
};

type Incident = {
  id: string;
  title: string;
  impact_level: string;
  status: string;
  created_at: string;
};

const chainBadge: Record<string, string> = {
  anchored: "bg-green-100 text-green-800",
  pending: "bg-amber-100 text-amber-800",
  failed: "bg-red-100 text-red-800",
  skipped: "bg-gray-100 text-gray-600",
};

const impactBadge: Record<string, string> = {
  low: "bg-green-100 text-green-800",
  medium: "bg-amber-100 text-amber-800",
  high: "bg-red-100 text-red-800",
  critical: "bg-red-200 text-red-900",
};

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function IncidentLocksPage() {
  const [locks, setLocks] = useState<IncidentLock[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const perPage = 20;

  // Lock form state
  const [showForm, setShowForm] = useState(false);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selectedIncidentId, setSelectedIncidentId] = useState("");
  const [lockReason, setLockReason] = useState("");
  const [creating, setCreating] = useState(false);

  // Copy state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchLocks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/prove/incident-locks");
      if (res.ok) {
        const data = await res.json();
        setLocks(data.locks ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchIncidents = useCallback(async () => {
    try {
      const res = await fetch("/api/incidents");
      if (res.ok) {
        const data = await res.json();
        setIncidents(data.incidents ?? []);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchLocks();
    fetchIncidents();
  }, [fetchLocks, fetchIncidents]);

  const selectedIncident = incidents.find((i) => i.id === selectedIncidentId);

  const createLock = async () => {
    if (!selectedIncidentId || !lockReason.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/prove/incident-locks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          incident_id: selectedIncidentId,
          lock_reason: lockReason.trim(),
        }),
      });
      if (res.ok) {
        setSelectedIncidentId("");
        setLockReason("");
        setShowForm(false);
        await fetchLocks();
      }
    } finally {
      setCreating(false);
    }
  };

  const copyVerificationId = (lockId: string, verificationId: string) => {
    navigator.clipboard.writeText(verificationId);
    setCopiedId(lockId);
    setTimeout(() => setCopiedId(null), 1500);
  };

  // Client-side pagination
  const totalPages = Math.max(1, Math.ceil(locks.length / perPage));
  const paginatedLocks = locks.slice((page - 1) * perPage, page * perPage);

  return (
    <TierGate requiredTier="Verify" featureLabel="Incident Lock">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-brand/10 text-brand">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <rect strokeWidth={1.5} x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-semibold">Incident Lock</h1>
              <p className="text-sm text-muted-foreground">
                Freeze incident evidence with cryptographic proof
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="px-3 py-1.5 text-sm font-medium rounded-lg bg-brand text-white hover:bg-brand/90 transition-colors"
          >
            {showForm ? "Cancel" : "Lock Incident"}
          </button>
        </div>

        {/* Lock Form */}
        {showForm && (
          <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/50">
            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Incident</label>
              <select
                value={selectedIncidentId}
                onChange={(e) => setSelectedIncidentId(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-sm"
              >
                <option value="">Select an incident...</option>
                {incidents.map((incident) => (
                  <option key={incident.id} value={incident.id}>
                    {incident.title}
                  </option>
                ))}
              </select>
            </div>

            {selectedIncident && (
              <div className="flex items-center gap-3 text-xs px-3 py-2 rounded-md bg-background border border-border">
                <span className="font-medium">{selectedIncident.title}</span>
                <span
                  className={`font-medium px-2 py-0.5 rounded-full ${
                    impactBadge[selectedIncident.impact_level] ?? "bg-gray-100 text-gray-800"
                  }`}
                >
                  {capitalize(selectedIncident.impact_level)}
                </span>
                <span className="text-muted-foreground">{capitalize(selectedIncident.status)}</span>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Lock Reason</label>
              <textarea
                value={lockReason}
                onChange={(e) => setLockReason(e.target.value)}
                placeholder="Why is this incident being locked?"
                rows={3}
                className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-sm resize-none"
              />
            </div>

            <div className="flex justify-end">
              <button
                onClick={createLock}
                disabled={creating || !selectedIncidentId || !lockReason.trim()}
                className="px-3 py-1.5 text-sm font-medium rounded-lg bg-brand text-white hover:bg-brand/90 transition-colors disabled:opacity-40"
              >
                {creating ? "Locking..." : "Create Lock"}
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="text-sm text-muted-foreground py-8 text-center">Loading incident locks...</div>
        ) : locks.length === 0 ? (
          <div className="border border-dashed border-border rounded-xl p-12 text-center space-y-3">
            <div className="text-muted-foreground/60">
              <svg className="w-10 h-10 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <rect strokeWidth={1.5} x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
            </div>
            <p className="text-sm text-muted-foreground">
              No incidents have been locked yet. Lock an incident to create a tamper-evident snapshot of its current state.
            </p>
          </div>
        ) : (
          <>
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Date</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Incident</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Impact</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Lock Reason</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Verification ID</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Chain Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {paginatedLocks.map((lock) => (
                    <tr key={lock.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 align-top">
                        {new Date(lock.locked_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 align-top font-medium">
                        {lock.snapshot.title}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            impactBadge[lock.snapshot.impact_level] ?? "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {capitalize(lock.snapshot.impact_level)}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top text-muted-foreground">
                        {lock.lock_reason
                          ? lock.lock_reason.length > 60
                            ? lock.lock_reason.slice(0, 60) + "..."
                            : lock.lock_reason
                          : "\u2014"}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs text-muted-foreground">
                            {lock.verification_id.slice(0, 12)}...
                          </span>
                          <button
                            onClick={() => copyVerificationId(lock.id, lock.verification_id)}
                            className="p-0.5 rounded hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
                            title="Copy verification ID"
                          >
                            {copiedId === lock.id ? (
                              <span className="text-xs text-green-600 font-medium px-1">Copied!</span>
                            ) : (
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <rect strokeWidth={1.5} x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            chainBadge[lock.chain_status] ?? "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {capitalize(lock.chain_status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{locks.length} locks total</span>
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
