"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import DetailPanel from "@/components/ui/DetailPanel";
import { showActionToast, showErrorToast } from "@/components/ui/Toast";
import { useAuth } from "@/context/AuthContext";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Policy = {
  id: string;
  title: string | null;
  policy_type: string;
  version: number;
  status: string;
  content: string | null;
  is_edited: boolean;
  approved_by: string | null;
  approved_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const POLICY_TYPES: Record<string, string> = {
  acceptable_use: "AI Acceptable Use Policy",
  data_handling: "AI Data Handling & Privacy",
  staff_guidelines: "Staff Guidelines & Training",
  risk_assessment: "AI Risk Assessment Policy",
  transparency: "Transparency & Explainability",
  bias_monitoring: "Bias Detection & Mitigation",
  vendor_management: "AI Vendor Management",
  incident_response: "AI Incident Response",
  human_oversight: "Human Oversight & Escalation",
  model_lifecycle: "Model Lifecycle Governance",
};

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  under_review: "bg-amber-100 text-amber-800",
  active: "bg-green-100 text-green-800",
  archived: "bg-red-100 text-red-700",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  under_review: "Under Review",
  active: "Active",
  archived: "Archived",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

export default function PoliciesPage() {
  return <PoliciesContent />;
}

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

function PoliciesContent() {
  const { profile: _profile } = useAuth();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");

  // Detail panel
  const [selected, setSelected] = useState<Policy | null>(null);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createType, setCreateType] = useState("acceptable_use");
  const [submitting, setSubmitting] = useState(false);

  // Edit state
  const [editingContent, setEditingContent] = useState(false);
  const [editContent, setEditContent] = useState("");

  const fetchPolicies = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/copilot/policies");
      const data = await res.json();
      if (res.ok) {
        setPolicies(data.policies ?? []);
      } else {
        setError(data.error ?? "Failed to load policies");
      }
    } catch {
      setError("Failed to connect");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPolicies();
  }, [fetchPolicies]);

  // Derived
  const filtered = useMemo(() => {
    let result = policies;
    if (statusFilter) result = result.filter((p) => p.status === statusFilter);
    if (typeFilter) result = result.filter((p) => p.policy_type === typeFilter);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          (p.title ?? "").toLowerCase().includes(q) ||
          p.policy_type.toLowerCase().includes(q)
      );
    }
    return result;
  }, [policies, statusFilter, typeFilter, search]);

  const activeCount = policies.filter((p) => p.status === "active").length;
  const draftCount = policies.filter((p) => p.status === "draft").length;
  const reviewCount = policies.filter((p) => p.status === "under_review").length;

  // Create handler
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!createTitle.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/copilot/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: createTitle.trim(),
          policy_type: createType,
          status: "draft",
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showActionToast("Policy created");
        setShowCreate(false);
        setCreateTitle("");
        setCreateType("acceptable_use");
        fetchPolicies();
      } else {
        showErrorToast(data.error ?? "Failed to create");
      }
    } catch {
      showErrorToast("Failed to create policy");
    } finally {
      setSubmitting(false);
    }
  }

  // Status update handler
  async function handleStatusChange(policy: Policy, newStatus: string) {
    try {
      const res = await fetch(`/api/copilot/policies/${policy.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const data = await res.json();
        showActionToast(`Policy ${STATUS_LABELS[newStatus]?.toLowerCase() ?? "updated"}`);
        setSelected(data.policy);
        fetchPolicies();
      } else {
        showErrorToast("Failed to update status");
      }
    } catch {
      showErrorToast("Failed to update status");
    }
  }

  // Save content handler
  async function handleSaveContent() {
    if (!selected) return;
    try {
      const res = await fetch(`/api/copilot/policies/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editContent }),
      });
      if (res.ok) {
        const data = await res.json();
        showActionToast("Policy content saved");
        setSelected(data.policy);
        setEditingContent(false);
        fetchPolicies();
      } else {
        showErrorToast("Failed to save");
      }
    } catch {
      showErrorToast("Failed to save");
    }
  }

  // Archive handler
  async function handleArchive(policy: Policy) {
    try {
      const res = await fetch(`/api/copilot/policies/${policy.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        showActionToast("Policy archived");
        setSelected(null);
        fetchPolicies();
      } else {
        showErrorToast("Failed to archive");
      }
    } catch {
      showErrorToast("Failed to archive");
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Policies</h1>
          <p className="text-sm text-muted-foreground">
            Create, manage, and approve AI governance policies
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/copilot/generate-policy"
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-accent transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v6m0 0v6m0-6h6m-6 0H6" /></svg>
            AI Generate
          </Link>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand,#0066FF)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--brand,#0066FF)]/90 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v6m0 0v6m0-6h6m-6 0H6" /></svg>
            New Policy
          </button>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total" value={policies.length} />
        <StatCard label="Active" value={activeCount} color="text-green-700" />
        <StatCard label="Draft" value={draftCount} color="text-gray-500" />
        <StatCard label="Under Review" value={reviewCount} color="text-amber-700" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          placeholder="Search policies..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 rounded-lg border border-border bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[var(--brand,#0066FF)]/20 w-56"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-8 rounded-lg border border-border bg-background px-2 text-sm"
        >
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="under_review">Under Review</option>
          <option value="active">Active</option>
          <option value="archived">Archived</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="h-8 rounded-lg border border-border bg-background px-2 text-sm"
        >
          <option value="">All types</option>
          {Object.entries(POLICY_TYPES).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-current border-t-transparent" />
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="rounded-xl border border-border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && policies.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-400">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h3 className="text-sm font-medium mb-1">No policies yet</h3>
          <p className="text-xs text-muted-foreground mb-4">
            Create your first AI governance policy or generate one with AI
          </p>
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand,#0066FF)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--brand,#0066FF)]/90 transition-colors"
            >
              New Policy
            </button>
            <Link
              href="/copilot/generate-policy"
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-accent transition-colors"
            >
              AI Generate
            </Link>
          </div>
        </div>
      )}

      {/* Policy list */}
      {!loading && !error && filtered.length > 0 && (
        <div className="rounded-xl border border-border bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-gray-50/50">
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Policy</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden md:table-cell">Type</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden sm:table-cell">Version</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden lg:table-cell">Updated</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => {
                    setSelected(p);
                    setEditingContent(false);
                  }}
                  className="border-b border-border last:border-0 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <span className="font-medium text-foreground">
                      {p.title || POLICY_TYPES[p.policy_type] || p.policy_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-xs text-muted-foreground">
                      {POLICY_TYPES[p.policy_type] ?? p.policy_type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[p.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {STATUS_LABELS[p.status] ?? p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className="text-xs text-muted-foreground font-mono">v{p.version}</span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="text-xs text-muted-foreground">{formatDate(p.updated_at || p.created_at)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Policy Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowCreate(false)} />
          <div className="relative bg-white rounded-xl border border-border shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-4">New Policy</h2>
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Title</label>
                <input
                  type="text"
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
                  placeholder="e.g. AI Acceptable Use Policy"
                  className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand,#0066FF)]/20"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Policy Type</label>
                <select
                  value={createType}
                  onChange={(e) => setCreateType(e.target.value)}
                  className="w-full h-9 rounded-lg border border-border bg-background px-2 text-sm"
                >
                  {Object.entries(POLICY_TYPES).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-accent transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!createTitle.trim() || submitting}
                  className="rounded-lg bg-[var(--brand,#0066FF)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--brand,#0066FF)]/90 transition-colors disabled:opacity-50"
                >
                  {submitting ? "Creating..." : "Create Policy"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Panel */}
      <DetailPanel
        open={!!selected}
        onClose={() => {
          setSelected(null);
          setEditingContent(false);
        }}
        title={selected?.title || POLICY_TYPES[selected?.policy_type ?? ""] || "Policy"}
        subtitle={selected ? POLICY_TYPES[selected.policy_type] ?? selected.policy_type : undefined}
        badge={
          selected ? (
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[selected.status] ?? "bg-gray-100 text-gray-600"}`}>
              {STATUS_LABELS[selected.status] ?? selected.status}
            </span>
          ) : undefined
        }
        actions={
          selected && selected.status !== "archived" ? (
            <>
              {selected.status === "draft" && (
                <button
                  onClick={() => handleStatusChange(selected, "under_review")}
                  className="rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-600 transition-colors"
                >
                  Submit for Review
                </button>
              )}
              {selected.status === "under_review" && (
                <button
                  onClick={() => handleStatusChange(selected, "active")}
                  className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 transition-colors"
                >
                  Approve & Activate
                </button>
              )}
              {selected.status === "active" && (
                <button
                  onClick={() => handleStatusChange(selected, "draft")}
                  className="rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-accent transition-colors"
                >
                  Revert to Draft
                </button>
              )}
              <button
                onClick={() => handleArchive(selected)}
                className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
              >
                Archive
              </button>
            </>
          ) : undefined
        }
      >
        {selected && (
          <div className="flex flex-col gap-5">
            {/* Metadata */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-xs text-muted-foreground">Version</span>
                <p className="font-mono">v{selected.version}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Created</span>
                <p>{formatDate(selected.created_at)}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Last Updated</span>
                <p>{formatDate(selected.updated_at || selected.created_at)}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Source</span>
                <p>{selected.is_edited ? "Edited" : "AI Generated"}</p>
              </div>
              {selected.approved_at && (
                <div className="col-span-2">
                  <span className="text-xs text-muted-foreground">Approved</span>
                  <p>{formatDate(selected.approved_at)}</p>
                </div>
              )}
            </div>

            {/* Status workflow */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Status Workflow
              </h4>
              <div className="flex items-center gap-1 text-xs">
                {["draft", "under_review", "active"].map((s, i) => (
                  <div key={s} className="flex items-center gap-1">
                    {i > 0 && (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-gray-300">
                        <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                    <span className={`rounded-full px-2 py-0.5 font-medium ${
                      selected.status === s
                        ? STATUS_STYLES[s]
                        : "bg-gray-50 text-gray-400"
                    }`}>
                      {STATUS_LABELS[s]}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Content */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Policy Content
                </h4>
                {!editingContent && selected.status !== "archived" && (
                  <button
                    onClick={() => {
                      setEditContent(selected.content ?? "");
                      setEditingContent(true);
                    }}
                    className="text-xs text-[var(--brand,#0066FF)] hover:text-[var(--brand,#0066FF)]/80 font-medium"
                  >
                    Edit
                  </button>
                )}
              </div>

              {editingContent ? (
                <div className="flex flex-col gap-2">
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={16}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-[var(--brand,#0066FF)]/20 resize-y"
                  />
                  <div className="flex items-center gap-2 justify-end">
                    <button
                      onClick={() => setEditingContent(false)}
                      className="rounded-lg border px-3 py-1 text-xs font-medium hover:bg-accent transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveContent}
                      className="rounded-lg bg-[var(--brand,#0066FF)] px-3 py-1 text-xs font-medium text-white hover:bg-[var(--brand,#0066FF)]/90 transition-colors"
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : selected.content ? (
                <div className="prose prose-sm max-w-none rounded-lg border border-border bg-gray-50/50 p-4 text-sm leading-relaxed whitespace-pre-wrap">
                  {selected.content}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border p-6 text-center">
                  <p className="text-xs text-muted-foreground mb-2">No content yet</p>
                  <button
                    onClick={() => {
                      setEditContent("");
                      setEditingContent(true);
                    }}
                    className="text-xs text-[var(--brand,#0066FF)] hover:text-[var(--brand,#0066FF)]/80 font-medium"
                  >
                    Add content
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </DetailPanel>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="rounded-xl border border-border bg-white p-4">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={`text-2xl font-semibold tabular-nums ${color ?? "text-foreground"}`}>{value}</p>
    </div>
  );
}
