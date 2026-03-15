"use client";

import { useCallback, useEffect, useState } from "react";
import TierGate from "@/components/TierGate";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import DetailPanel from "@/components/ui/DetailPanel";
import LinkedChain from "@/components/ui/LinkedChain";
import OnboardingTour from "@/components/ui/OnboardingTour";
import { showActionToast } from "@/components/ui/Toast";

type Escalation = {
  id: string;
  organisation_id: string;
  reason: string;
  severity: string;
  status: string;
  resolved: boolean;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  assigned_to: string | null;
  assignee_name: string | null;
  resolution_note: string | null;
  trigger_type: string | null;
  trigger_detail: string | null;
  source_signal: {
    id: string;
    system_name: string;
    metric_name: string;
    signal_type: string;
    severity: string;
  } | null;
};

type EscalationNote = {
  id: string;
  escalation_id: string;
  author_id: string;
  content: string;
  note_type: string;
  created_at: string;
};

const severityBadge: Record<string, string> = {
  low: "bg-blue-100 text-blue-800",
  medium: "bg-amber-100 text-amber-800",
  high: "bg-red-100 text-red-800",
  critical: "bg-red-200 text-red-900",
};

const statusBadge: Record<string, string> = {
  open: "bg-amber-100 text-amber-800",
  investigating: "bg-blue-100 text-blue-800",
  resolved: "bg-green-100 text-green-800",
  closed: "bg-gray-100 text-gray-600",
};

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const NOTE_TYPE_ICONS: Record<string, string> = {
  comment: "💬",
  status_change: "🔄",
  assignment: "👤",
  severity_change: "⚠️",
};

export default function EscalationsPage() {
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [severity, setSeverity] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const perPage = 20;

  // Detail panel state
  const [selectedItem, setSelectedItem] = useState<Escalation | null>(null);
  const [notes, setNotes] = useState<EscalationNote[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Action states
  const [actionLoading, setActionLoading] = useState(false);
  const [showResolveForm, setShowResolveForm] = useState(false);
  const [resolveNote, setResolveNote] = useState("");
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [noteContent, setNoteContent] = useState("");
  const [showSeverityDropdown, setShowSeverityDropdown] = useState(false);

  // Raise escalation form state
  const [showRaiseForm, setShowRaiseForm] = useState(false);
  const [raiseReason, setRaiseReason] = useState("");
  const [raiseSeverity, setRaiseSeverity] = useState("medium");
  const [raiseLoading, setRaiseLoading] = useState(false);

  const fetchEscalations = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        per_page: String(perPage),
      });
      if (severity) params.set("severity", severity);
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/trustgraph/escalations?${params}`);
      if (res.ok) {
        const data = await res.json();
        setEscalations(data.escalations ?? []);
        setTotal(data.total ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, [severity, statusFilter, page]);

  useEffect(() => {
    fetchEscalations();
  }, [fetchEscalations]);

  const fetchDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/trustgraph/escalations?id=${id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedItem(data.escalation);
        setNotes(data.notes ?? []);
      }
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const performAction = async (action: string, extra: Record<string, unknown> = {}) => {
    if (!selectedItem) return;
    setActionLoading(true);
    try {
      const res = await fetch("/api/trustgraph/escalations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ escalation_id: selectedItem.id, action, ...extra }),
      });
      if (res.ok) {
        showActionToast(`Escalation ${action === "resolve" ? "resolved" : action === "add_note" ? "note added" : action === "update_severity" ? "severity updated" : action === "update_status" ? "status updated" : action === "create_incident" ? "escalated to incident" : "updated"}`);
        // Refresh detail and list
        await fetchDetail(selectedItem.id);
        await fetchEscalations();
        // Reset forms
        setShowResolveForm(false);
        setResolveNote("");
        setShowNoteForm(false);
        setNoteContent("");
        setShowSeverityDropdown(false);
      } else {
        const d = await res.json().catch(() => ({}));
        showActionToast(d.error || "Action failed");
      }
    } finally {
      setActionLoading(false);
    }
  };

  const raiseEscalation = async () => {
    if (!raiseReason.trim()) return;
    setRaiseLoading(true);
    try {
      const res = await fetch("/api/trustgraph/escalations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", reason: raiseReason, severity: raiseSeverity }),
      });
      if (res.ok) {
        showActionToast("Escalation raised");
        setShowRaiseForm(false);
        setRaiseReason("");
        setRaiseSeverity("medium");
        await fetchEscalations();
      } else {
        const d = await res.json().catch(() => ({}));
        showActionToast(d.error || "Failed to raise escalation");
      }
    } finally {
      setRaiseLoading(false);
    }
  };

  const totalPages = Math.ceil(total / perPage);

  return (
    <TierGate requiredTier="Assure" featureLabel="Escalations">
      <div className="space-y-6">
        {/* Header */}
        <div data-tour="page-header">
          <PageHeader
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4m0 4h.01" />
              </svg>
            }
            title="Escalations"
            description="Issues requiring attention — auto-triggered from critical signals or raised manually"
            workflowHint={[
              { label: "Signals", href: "/monitor/signals" },
              { label: "Escalations", href: "/monitor/escalations" },
              { label: "Incidents", href: "/monitor/incidents" },
            ]}
          />
        </div>

        {/* Filters + Raise button */}
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={severity}
            onChange={(e) => { setSeverity(e.target.value); setPage(1); }}
            className="px-3 py-1.5 rounded-lg border border-border bg-background text-sm"
          >
            <option value="">All severities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-3 py-1.5 rounded-lg border border-border bg-background text-sm"
          >
            <option value="">All statuses</option>
            <option value="open">Open</option>
            <option value="investigating">Investigating</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
          <div className="flex-1" />
          <button
            onClick={() => setShowRaiseForm(!showRaiseForm)}
            className="px-4 py-1.5 text-sm font-medium rounded-lg bg-brand text-white hover:bg-brand/90 transition-colors"
          >
            Raise Escalation
          </button>
        </div>

        {/* Raise Escalation Form */}
        {showRaiseForm && (
          <div className="border border-border rounded-lg p-4 bg-muted/30 space-y-3">
            <p className="text-sm font-medium">Raise a new escalation</p>
            <textarea
              value={raiseReason}
              onChange={(e) => setRaiseReason(e.target.value)}
              placeholder="Describe the issue requiring escalation..."
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm resize-none"
            />
            <div className="flex items-center gap-3">
              <label className="text-sm text-muted-foreground">Severity</label>
              <select
                value={raiseSeverity}
                onChange={(e) => setRaiseSeverity(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-border bg-background text-sm"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button
                onClick={raiseEscalation}
                disabled={raiseLoading || !raiseReason.trim()}
                className="px-4 py-1.5 text-sm font-medium rounded-lg bg-brand text-white hover:bg-brand/90 disabled:opacity-40 transition-colors"
              >
                {raiseLoading ? "Raising..." : "Submit"}
              </button>
              <button
                onClick={() => { setShowRaiseForm(false); setRaiseReason(""); setRaiseSeverity("medium"); }}
                className="px-4 py-1.5 text-sm font-medium rounded-lg border border-border hover:bg-muted/50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="text-sm text-muted-foreground py-8 text-center">Loading escalations...</div>
        ) : escalations.length === 0 ? (
          <EmptyState
            icon={
              <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4m0 4h.01" />
              </svg>
            }
            title="No escalations"
            description="Escalations are created automatically when runtime signals breach critical governance thresholds. They can also be raised manually."
            secondaryLabel="View signals →"
            secondaryHref="/monitor/signals"
          />
        ) : (
          <>
            <div data-tour="escalations-table" className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Date</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Reason</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Severity</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Status</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Source</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Assigned</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {escalations.map((esc) => (
                    <tr
                      key={esc.id}
                      onClick={() => { setSelectedItem(esc); fetchDetail(esc.id); }}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                    >
                      <td className="px-4 py-3">{new Date(esc.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3 max-w-xs truncate">
                        {esc.reason || esc.trigger_detail || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${severityBadge[esc.severity] ?? "bg-gray-100 text-gray-800"}`}>
                          {capitalize(esc.severity)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusBadge[esc.status] ?? "bg-gray-100 text-gray-800"}`}>
                          {capitalize(esc.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {esc.source_signal ? (
                          <span className="inline-flex items-center gap-1 text-blue-700">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            Signal
                          </span>
                        ) : esc.trigger_type === "manual" ? (
                          <span className="text-muted-foreground">Manual</span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {esc.assignee_name || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{total} escalations total</span>
                <div className="flex gap-2">
                  <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1 rounded border border-border disabled:opacity-40">Previous</button>
                  <span className="px-3 py-1 text-muted-foreground">Page {page} of {totalPages}</span>
                  <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1 rounded border border-border disabled:opacity-40">Next</button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Detail Panel */}
        <DetailPanel
          open={!!selectedItem}
          onClose={() => { setSelectedItem(null); setNotes([]); setShowResolveForm(false); setShowNoteForm(false); setShowSeverityDropdown(false); }}
          title={selectedItem?.reason ? (selectedItem.reason.length > 60 ? selectedItem.reason.slice(0, 60) + "..." : selectedItem.reason) : "Escalation"}
          badge={
            selectedItem ? (
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${severityBadge[selectedItem.severity] ?? "bg-gray-100 text-gray-800"}`}>
                {capitalize(selectedItem.severity)}
              </span>
            ) : undefined
          }
        >
          {selectedItem && (
            <div className="space-y-6">
              {/* Status & Info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <p className="font-medium mt-0.5">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusBadge[selectedItem.status] ?? statusBadge.open}`}>
                      {capitalize(selectedItem.status)}
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Assigned To</p>
                  <p className="font-medium mt-0.5">{selectedItem.assignee_name || "Unassigned"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Created</p>
                  <p className="font-medium mt-0.5">{new Date(selectedItem.created_at).toLocaleString()}</p>
                </div>
                {selectedItem.resolved_at && (
                  <div>
                    <p className="text-muted-foreground">Resolved</p>
                    <p className="font-medium mt-0.5">{new Date(selectedItem.resolved_at).toLocaleString()}</p>
                  </div>
                )}
              </div>

              {selectedItem.reason && (
                <div>
                  <p className="text-muted-foreground text-sm">Reason</p>
                  <p className="text-sm mt-1">{selectedItem.reason}</p>
                </div>
              )}

              {selectedItem.resolution_note && (
                <div>
                  <p className="text-muted-foreground text-sm">Resolution</p>
                  <p className="text-sm mt-1 p-3 bg-green-50 border border-green-200 rounded-lg">{selectedItem.resolution_note}</p>
                </div>
              )}

              {/* Source info */}
              <div>
                <p className="text-muted-foreground text-sm mb-2">Source</p>
                {selectedItem.source_signal ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                      <svg className="w-4 h-4 text-blue-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <span className="text-blue-800 font-medium">Auto-triggered from signal</span>
                    </div>
                    <LinkedChain
                      chain={[
                        { type: "signal", label: `${selectedItem.source_signal.system_name}: ${selectedItem.source_signal.metric_name}`, href: "/monitor/signals" },
                        { type: "escalation", label: "This escalation", active: true },
                      ]}
                    />
                  </div>
                ) : selectedItem.trigger_type === "manual" ? (
                  <div className="flex items-center gap-2 text-sm px-3 py-2 bg-muted/50 border border-border rounded-lg">
                    <svg className="w-4 h-4 text-muted-foreground shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span className="text-muted-foreground font-medium">Manually raised</span>
                  </div>
                ) : (
                  <LinkedChain
                    chain={[
                      { type: "escalation", label: "Escalation", active: true },
                    ]}
                  />
                )}
              </div>

              {/* Action Buttons */}
              {selectedItem.status !== "resolved" && selectedItem.status !== "closed" && (
                <div className="border-t border-border pt-4">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-3">Actions</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => performAction("update_status", { status: "investigating" })}
                      disabled={actionLoading || selectedItem.status === "investigating"}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg border border-border hover:bg-muted/50 transition-colors disabled:opacity-40"
                    >
                      Mark Investigating
                    </button>

                    <div className="relative">
                      <button
                        onClick={() => setShowSeverityDropdown(!showSeverityDropdown)}
                        disabled={actionLoading}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg border border-border hover:bg-muted/50 transition-colors disabled:opacity-40"
                      >
                        Change Severity
                      </button>
                      {showSeverityDropdown && (
                        <div className="absolute top-full left-0 mt-1 bg-background border border-border rounded-lg shadow-lg z-10 py-1 min-w-[120px]">
                          {["low", "medium", "high", "critical"].filter(s => s !== selectedItem.severity).map((s) => (
                            <button
                              key={s}
                              onClick={() => performAction("update_severity", { severity: s })}
                              className="block w-full text-left px-3 py-1.5 text-xs hover:bg-muted/50 transition-colors"
                            >
                              <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${severityBadge[s]}`}>{capitalize(s)}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => setShowNoteForm(!showNoteForm)}
                      disabled={actionLoading}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg border border-border hover:bg-muted/50 transition-colors disabled:opacity-40"
                    >
                      Add Note
                    </button>

                    <button
                      onClick={() => performAction("create_incident")}
                      disabled={actionLoading}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg border border-red-200 text-red-700 hover:bg-red-50 transition-colors disabled:opacity-40"
                    >
                      Escalate to Incident
                    </button>

                    <button
                      onClick={() => setShowResolveForm(!showResolveForm)}
                      disabled={actionLoading}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg bg-brand text-white hover:bg-brand/90 transition-colors disabled:opacity-40"
                    >
                      Resolve
                    </button>
                  </div>

                  {/* Add Note Form */}
                  {showNoteForm && (
                    <div className="mt-3 space-y-2">
                      <textarea
                        value={noteContent}
                        onChange={(e) => setNoteContent(e.target.value)}
                        placeholder="Add a note about this escalation..."
                        rows={3}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm resize-none"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => performAction("add_note", { content: noteContent })}
                          disabled={actionLoading || !noteContent.trim()}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-brand text-white hover:bg-brand/90 disabled:opacity-40"
                        >
                          {actionLoading ? "Saving..." : "Save Note"}
                        </button>
                        <button
                          onClick={() => { setShowNoteForm(false); setNoteContent(""); }}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-border hover:bg-muted/50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Resolve Form */}
                  {showResolveForm && (
                    <div className="mt-3 space-y-2">
                      <textarea
                        value={resolveNote}
                        onChange={(e) => setResolveNote(e.target.value)}
                        placeholder="Describe how this escalation was resolved (required)..."
                        rows={3}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm resize-none"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => performAction("resolve", { resolution_note: resolveNote })}
                          disabled={actionLoading || !resolveNote.trim()}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-40"
                        >
                          {actionLoading ? "Resolving..." : "Confirm Resolve"}
                        </button>
                        <button
                          onClick={() => { setShowResolveForm(false); setResolveNote(""); }}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-border hover:bg-muted/50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Timeline / Notes */}
              {(notes.length > 0 || detailLoading) && (
                <div className="border-t border-border pt-4">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-3">Activity</p>
                  {detailLoading ? (
                    <div className="text-sm text-muted-foreground">Loading activity...</div>
                  ) : (
                    <div className="space-y-3">
                      {notes.map((note) => (
                        <div key={note.id} className="flex gap-3 text-sm">
                          <span className="text-base leading-none mt-0.5">
                            {NOTE_TYPE_ICONS[note.note_type] || "📝"}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-foreground">{note.content}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {new Date(note.created_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </DetailPanel>

        {/* Onboarding Tour */}
        <OnboardingTour
          tourId="monitor-escalations"
          steps={[
            { target: "[data-tour='page-header']", title: "Escalations", content: "Issues requiring attention — auto-triggered from critical signals or raised manually." },
            { target: "[data-tour='escalations-table']", title: "Escalation List", content: "Click any row to see full details. Assign, add notes, change severity, or resolve escalations." },
          ]}
        />
      </div>
    </TierGate>
  );
}
