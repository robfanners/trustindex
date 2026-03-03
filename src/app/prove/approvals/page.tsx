"use client";

import { useCallback, useEffect, useState } from "react";
import TierGate from "@/components/TierGate";

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

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
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

  const fetchApprovals = useCallback(async () => {
    setLoading(true);
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

  const submitDecision = async () => {
    if (!decidingId || !decidingAction) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/prove/approvals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approval_id: decidingId,
          decision: decidingAction,
          decision_note: decisionNote || undefined,
        }),
      });
      if (res.ok) {
        setDecidingId(null);
        setDecidingAction(null);
        setDecisionNote("");
        await fetchApprovals();
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-brand/10 text-brand">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-semibold">Approval Inbox</h1>
              <p className="text-sm text-muted-foreground">Review and cryptographically sign high-risk AI actions</p>
            </div>
          </div>
          <button
            onClick={() => setShowNewForm((v) => !v)}
            className="px-3 py-1.5 text-sm font-medium rounded-lg bg-brand text-white hover:bg-brand/90 transition-colors"
          >
            {showNewForm ? "Cancel" : "New Approval"}
          </button>
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

        {/* Content */}
        {loading ? (
          <div className="text-sm text-muted-foreground py-8 text-center">Loading approvals...</div>
        ) : approvals.length === 0 ? (
          <div className="border border-dashed border-border rounded-xl p-12 text-center">
            <p className="text-sm text-muted-foreground">No approvals found</p>
          </div>
        ) : (
          <>
            <div className="border border-border rounded-lg overflow-hidden">
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
                    <tr key={approval.id} className="hover:bg-muted/30 transition-colors">
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
                      <td className="px-4 py-3 align-top">
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
                                  onClick={submitDecision}
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
      </div>
    </TierGate>
  );
}
