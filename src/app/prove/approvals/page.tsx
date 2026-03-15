"use client";

import { useCallback, useEffect, useState } from "react";
import TierGate from "@/components/TierGate";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import DetailPanel from "@/components/ui/DetailPanel";
import OnboardingTour from "@/components/ui/OnboardingTour";
import { showActionToast } from "@/components/ui/Toast";

type Approval = {
  id: string;
  organisation_id: string;
  title: string;
  description: string | null;
  risk_level: string;
  status: string;
  requested_by: string | null;
  assigned_to: string | null;
  decided_at: string | null;
  decided_by: string | null;
  decision_note: string | null;
  event_hash: string | null;
  chain_tx_hash: string | null;
  chain_status: string | null;
  created_at: string;
};

const riskBadge: Record<string, string> = {
  low: "bg-blue-100 text-blue-800",
  medium: "bg-amber-100 text-amber-800",
  high: "bg-red-100 text-red-800",
  critical: "bg-red-200 text-red-900",
};

const statusBadge: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  expired: "bg-gray-100 text-gray-800",
};

const chainBadge: Record<string, string> = {
  anchored: "bg-green-100 text-green-800",
  skipped: "bg-gray-100 text-gray-600",
  failed: "bg-red-100 text-red-800",
  pending: "bg-amber-100 text-amber-800",
};

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const headerIcon = (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4" />
  </svg>
);

const tourSteps = [
  { target: "[data-tour='page-header']", title: "Governance Approvals", content: "Create and manage sign-off gates for governance decisions with cryptographic proof." },
  { target: "[data-tour='new-approval']", title: "Create an Approval", content: "Request governance sign-off on AI deployments, policy changes, or risk decisions." },
  { target: "[data-tour='approvals-table']", title: "Approval History", content: "Click any row to see the full approval details and take action on pending requests." },
];

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");
  const [riskLevel, setRiskLevel] = useState<string>("");
  const [page, setPage] = useState(1);
  const perPage = 20;

  // Decision state
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [decidingAction, setDecidingAction] = useState<"approved" | "rejected" | null>(null);
  const [decisionNote, setDecisionNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // New approval form state
  const [showNewForm, setShowNewForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newRiskLevel, setNewRiskLevel] = useState("medium");
  const [creating, setCreating] = useState(false);

  // Detail panel state
  const [selectedItem, setSelectedItem] = useState<Approval | null>(null);

  const fetchApprovals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        per_page: String(perPage),
      });
      if (status) params.set("status", status);
      if (riskLevel) params.set("risk_level", riskLevel);
      const res = await fetch(`/api/prove/approvals?${params}`);
      if (res.ok) {
        const data = await res.json();
        setApprovals(data.approvals ?? []);
        setTotal(data.total ?? 0);
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "Failed to load approvals");
      }
    } finally {
      setLoading(false);
    }
  }, [status, riskLevel, page]);

  useEffect(() => {
    fetchApprovals();
  }, [fetchApprovals]);

  const handleDecisionClick = (id: string, action: "approved" | "rejected") => {
    if (decidingId === id && decidingAction === action) {
      // Toggle off
      setDecidingId(null);
      setDecidingAction(null);
      setDecisionNote("");
    } else {
      setDecidingId(id);
      setDecidingAction(action);
      setDecisionNote("");
    }
  };

  const submitDecision = async (fromPanel?: boolean) => {
    const targetId = fromPanel && selectedItem ? selectedItem.id : decidingId;
    const targetAction = fromPanel ? decidingAction : decidingAction;
    if (!targetId || !targetAction) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/prove/approvals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approval_id: targetId,
          decision: targetAction,
          decision_note: decisionNote || undefined,
        }),
      });
      if (res.ok) {
        showActionToast("Approval " + targetAction);
        setDecidingId(null);
        setDecidingAction(null);
        setDecisionNote("");
        setSelectedItem(null);
        await fetchApprovals();
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.error || `Failed to submit decision (${res.status})`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const createApproval = async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/prove/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          description: newDescription.trim() || undefined,
          risk_level: newRiskLevel,
        }),
      });
      if (res.ok) {
        setNewTitle("");
        setNewDescription("");
        setNewRiskLevel("medium");
        setShowNewForm(false);
        await fetchApprovals();
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.error || `Failed to create approval (${res.status})`);
      }
    } finally {
      setCreating(false);
    }
  };

  const totalPages = Math.ceil(total / perPage);

  return (
    <TierGate requiredTier="Verify" featureLabel="Approval Inbox">
      <div className="space-y-6">
        {/* Header */}
        <div data-tour="page-header">
          <PageHeader
            icon={headerIcon}
            title="Approvals"
            description="Sign-off gates for governance decisions — human-verified approvals with cryptographic proof"
            workflowHint={[{ label: "Approvals", href: "/prove/approvals" }]}
            actions={
              <button
                data-tour="new-approval"
                onClick={() => setShowNewForm((v) => !v)}
                className="px-3 py-1.5 text-sm font-medium rounded-lg bg-brand text-white hover:bg-brand/90 transition-colors"
              >
                {showNewForm ? "Cancel" : "New Approval"}
              </button>
            }
          />
        </div>

        {/* New Approval Form */}
        {showNewForm && (
          <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/50">
            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Title</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Approval title"
                className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Description</label>
              <textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Optional description"
                rows={2}
                className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-sm resize-none"
              />
            </div>
            <div className="flex items-end gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground">Risk Level</label>
                <select
                  value={newRiskLevel}
                  onChange={(e) => setNewRiskLevel(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-border bg-background text-sm"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <button
                onClick={createApproval}
                disabled={creating || !newTitle.trim()}
                className="px-3 py-1.5 text-sm font-medium rounded-lg bg-brand text-white hover:bg-brand/90 transition-colors disabled:opacity-40"
              >
                {creating ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="px-3 py-1.5 rounded-lg border border-border bg-background text-sm"
          >
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="expired">Expired</option>
          </select>
          <select
            value={riskLevel}
            onChange={(e) => {
              setRiskLevel(e.target.value);
              setPage(1);
            }}
            className="px-3 py-1.5 rounded-lg border border-border bg-background text-sm"
          >
            <option value="">All risk levels</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
            {error}
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="text-sm text-muted-foreground py-8 text-center">Loading approvals...</div>
        ) : approvals.length === 0 ? (
          <EmptyState
            icon={headerIcon}
            title="No approval requests yet"
            description="Create an approval request to get governance sign-off on AI deployments, policy changes, or risk decisions."
            ctaLabel="Create an approval request"
            ctaAction={() => setShowNewForm(true)}
          />
        ) : (
          <>
            <div className="border border-border rounded-lg overflow-hidden" data-tour="approvals-table">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Date</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Title</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Risk Level</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Status</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Chain</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {approvals.map((approval) => (
                    <tr key={approval.id} className="hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => setSelectedItem(approval)}>
                      <td className="px-4 py-3 align-top">
                        {new Date(approval.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="font-medium">{approval.title}</div>
                        {approval.description && (
                          <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{approval.description}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            riskBadge[approval.risk_level] ?? "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {capitalize(approval.risk_level)}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            statusBadge[approval.status] ?? "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {capitalize(approval.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top">
                        {approval.event_hash ? (
                          <span
                            className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                              chainBadge[approval.chain_status ?? "pending"] ?? "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {capitalize(approval.chain_status ?? "pending")}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">{"\u2014"}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top" onClick={(e) => e.stopPropagation()}>
                        {approval.status === "pending" ? (
                          <div className="space-y-2">
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => handleDecisionClick(approval.id, "approved")}
                                className={`px-2.5 py-1 text-xs font-medium rounded border transition-colors ${
                                  decidingId === approval.id && decidingAction === "approved"
                                    ? "border-green-400 bg-green-50 text-green-800"
                                    : "border-border hover:bg-muted/50"
                                }`}
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleDecisionClick(approval.id, "rejected")}
                                className={`px-2.5 py-1 text-xs font-medium rounded border transition-colors ${
                                  decidingId === approval.id && decidingAction === "rejected"
                                    ? "border-red-400 bg-red-50 text-red-800"
                                    : "border-border hover:bg-muted/50"
                                }`}
                              >
                                Reject
                              </button>
                            </div>
                            {decidingId === approval.id && decidingAction && (
                              <div className="flex gap-1.5">
                                <input
                                  type="text"
                                  value={decisionNote}
                                  onChange={(e) => setDecisionNote(e.target.value)}
                                  placeholder="Note (optional)"
                                  className="flex-1 px-2 py-1 text-xs rounded border border-border bg-background"
                                />
                                <button
                                  onClick={() => submitDecision()}
                                  disabled={submitting}
                                  className="px-2.5 py-1 text-xs font-medium rounded bg-brand text-white hover:bg-brand/90 transition-colors disabled:opacity-40"
                                >
                                  {submitting ? "..." : "Confirm"}
                                </button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {approval.decision_note || "\u2014"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{total} approvals total</span>
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

        {/* Detail Panel */}
        <DetailPanel
          open={!!selectedItem}
          onClose={() => setSelectedItem(null)}
          title={selectedItem?.title ?? ""}
          subtitle="Approval Request"
          badge={
            selectedItem ? (
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${riskBadge[selectedItem.risk_level] ?? "bg-gray-100 text-gray-800"}`}>
                {capitalize(selectedItem.risk_level)}
              </span>
            ) : undefined
          }
          actions={
            selectedItem?.status === "pending" ? (
              <div className="flex items-center gap-2 w-full">
                <input
                  type="text"
                  value={decisionNote}
                  onChange={(e) => setDecisionNote(e.target.value)}
                  placeholder="Decision note (optional)"
                  className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-border bg-background"
                />
                <button
                  onClick={() => { setDecidingAction("approved"); setDecidingId(selectedItem.id); setTimeout(() => submitDecision(true), 0); }}
                  disabled={submitting}
                  className="px-3 py-1.5 text-sm font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-40"
                >
                  Approve
                </button>
                <button
                  onClick={() => { setDecidingAction("rejected"); setDecidingId(selectedItem.id); setTimeout(() => submitDecision(true), 0); }}
                  disabled={submitting}
                  className="px-3 py-1.5 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-40"
                >
                  Reject
                </button>
              </div>
            ) : undefined
          }
        >
          {selectedItem && (
            <div className="space-y-4">
              {selectedItem.description && (
                <div>
                  <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Description</dt>
                  <dd className="text-sm">{selectedItem.description}</dd>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Risk Level</dt>
                  <dd>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${riskBadge[selectedItem.risk_level] ?? "bg-gray-100 text-gray-800"}`}>
                      {capitalize(selectedItem.risk_level)}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Status</dt>
                  <dd>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusBadge[selectedItem.status] ?? "bg-gray-100 text-gray-800"}`}>
                      {capitalize(selectedItem.status)}
                    </span>
                  </dd>
                </div>
                {selectedItem.requested_by && (
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Requested By</dt>
                    <dd className="text-sm font-mono text-xs">{selectedItem.requested_by}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Created At</dt>
                  <dd className="text-sm">{new Date(selectedItem.created_at).toLocaleString()}</dd>
                </div>
              </div>

              {selectedItem.decided_at && (
                <div className="border-t border-border pt-4 space-y-3">
                  <h4 className="text-sm font-medium">Decision</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Decision</dt>
                      <dd>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusBadge[selectedItem.status] ?? "bg-gray-100 text-gray-800"}`}>
                          {capitalize(selectedItem.status)}
                        </span>
                      </dd>
                    </div>
                    {selectedItem.decision_note && (
                      <div>
                        <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Decision Note</dt>
                        <dd className="text-sm">{selectedItem.decision_note}</dd>
                      </div>
                    )}
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Decided At</dt>
                      <dd className="text-sm">{new Date(selectedItem.decided_at).toLocaleString()}</dd>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </DetailPanel>

        <OnboardingTour tourId="approvals" steps={tourSteps} />
      </div>
    </TierGate>
  );
}
