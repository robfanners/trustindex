"use client";

import { useCallback, useEffect, useState } from "react";
import TierGate from "@/components/TierGate";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import DetailPanel from "@/components/ui/DetailPanel";
import { showActionToast } from "@/components/ui/Toast";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ApiKey = {
  id: string;
  organisation_id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  status: string;
  expires_at: string | null;
  last_used_at: string | null;
  created_at: string;
  created_by: string | null;
  profiles: { full_name: string; email: string } | null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_COLOURS: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  revoked: "bg-red-100 text-red-800",
  expired: "bg-amber-100 text-amber-800",
};

const ALL_SCOPES = [
  "outputs:write",
  "decisions:write",
  "decisions:read",
  "keys:read",
];

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? "s" : ""} ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr !== 1 ? "s" : ""} ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay} day${diffDay !== 1 ? "s" : ""} ago`;
  return formatDate(dateStr);
}

const headerIcon = (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
  </svg>
);

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ApiKeysPage() {
  // List state
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Detail panel
  const [selected, setSelected] = useState<ApiKey | null>(null);

  // Create form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formName, setFormName] = useState("");
  const [formScopes, setFormScopes] = useState<string[]>([]);
  const [formExpiry, setFormExpiry] = useState("");

  // One-time key display
  const [newKeyPlaintext, setNewKeyPlaintext] = useState<string | null>(null);

  // Detail panel actions
  const [editingName, setEditingName] = useState(false);
  const [editName, setEditName] = useState("");
  const [revoking, setRevoking] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Fetch keys
  const fetchKeys = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/happ/api-keys");
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to load API keys");
      }
      const d = await res.json();
      setKeys(d.records ?? d.data ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load API keys");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  // Toggle scope
  const toggleScope = (scope: string) => {
    setFormScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
  };

  // Create key
  const handleCreate = async () => {
    if (!formName.trim() || formScopes.length === 0) return;
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        name: formName.trim(),
        scopes: formScopes,
      };
      if (formExpiry) body.expires_at = formExpiry;

      const res = await fetch("/api/happ/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to generate API key");
      }
      const d = await res.json();
      setNewKeyPlaintext(d.key ?? null);
      showActionToast("API key generated");
      setFormName("");
      setFormScopes([]);
      setFormExpiry("");
      setShowCreateForm(false);
      fetchKeys();
    } catch (e: unknown) {
      showActionToast(e instanceof Error ? e.message : "Failed to generate API key");
    } finally {
      setSubmitting(false);
    }
  };

  // Copy key to clipboard
  const copyKey = async () => {
    if (!newKeyPlaintext) return;
    try {
      await navigator.clipboard.writeText(newKeyPlaintext);
      showActionToast("API key copied to clipboard");
    } catch {
      showActionToast("Failed to copy key");
    }
  };

  // Revoke key
  const handleRevoke = async () => {
    if (!selected) return;
    setRevoking(true);
    try {
      const res = await fetch(`/api/happ/api-keys/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "revoked" }),
      });
      if (res.ok) {
        showActionToast("API key revoked");
        setSelected(null);
        setConfirmRevoke(false);
        fetchKeys();
      } else {
        const d = await res.json().catch(() => ({}));
        showActionToast(d.error || "Failed to revoke key");
      }
    } finally {
      setRevoking(false);
    }
  };

  // Delete key
  const handleDelete = async () => {
    if (!selected) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/happ/api-keys/${selected.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        showActionToast("API key deleted");
        setSelected(null);
        setConfirmDelete(false);
        fetchKeys();
      } else {
        const d = await res.json().catch(() => ({}));
        showActionToast(d.error || "Failed to delete key");
      }
    } finally {
      setDeleting(false);
    }
  };

  // Update key name
  const handleUpdateName = async () => {
    if (!selected || !editName.trim()) return;
    try {
      const res = await fetch(`/api/happ/api-keys/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim() }),
      });
      if (res.ok) {
        showActionToast("Key name updated");
        setSelected({ ...selected, name: editName.trim() });
        setEditingName(false);
        fetchKeys();
      } else {
        const d = await res.json().catch(() => ({}));
        showActionToast(d.error || "Failed to update name");
      }
    } catch {
      showActionToast("Failed to update name");
    }
  };

  // Open detail
  const openDetail = (key: ApiKey) => {
    setSelected(key);
    setEditingName(false);
    setEditName(key.name);
    setConfirmRevoke(false);
    setConfirmDelete(false);
  };

  const inputClass = "w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-brand/30";

  return (
    <TierGate requiredTier="Assure" featureLabel="API Keys">
      <div className="space-y-6">
        <PageHeader
          icon={headerIcon}
          title="API Keys"
          description="Manage API keys for external system integration"
          actions={
            <button
              onClick={() => { setShowCreateForm(!showCreateForm); setNewKeyPlaintext(null); }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand/90 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Generate New Key
            </button>
          }
        />

        {/* One-time key display */}
        {newKeyPlaintext && (
          <div className="border-2 border-amber-400 bg-amber-50 rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <span className="text-sm font-semibold text-amber-800">Copy this key now. It won&apos;t be shown again.</span>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 bg-white border border-amber-300 rounded-lg text-sm font-mono break-all select-all">
                {newKeyPlaintext}
              </code>
              <button
                onClick={copyKey}
                className="shrink-0 px-3 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 transition-colors"
              >
                Copy
              </button>
            </div>
            <button
              onClick={() => setNewKeyPlaintext(null)}
              className="text-xs text-amber-700 hover:text-amber-900 underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Create form */}
        {showCreateForm && (
          <div className="border border-border rounded-xl p-6 space-y-4 bg-muted/30">
            <h3 className="text-sm font-semibold">Generate a New API Key</h3>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Name *</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className={inputClass}
                placeholder="e.g. Production Integration"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Scopes *</label>
              <div className="flex flex-wrap gap-3 mt-1">
                {ALL_SCOPES.map((scope) => (
                  <label key={scope} className="inline-flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formScopes.includes(scope)}
                      onChange={() => toggleScope(scope)}
                      className="rounded border-border"
                    />
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{scope}</code>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Expiry Date (optional)</label>
              <input
                type="date"
                value={formExpiry}
                onChange={(e) => setFormExpiry(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleCreate}
                disabled={submitting || !formName.trim() || formScopes.length === 0}
                className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand/90 transition-colors disabled:opacity-50"
              >
                {submitting ? "Generating..." : "Generate Key"}
              </button>
              <button
                onClick={() => { setShowCreateForm(false); setFormName(""); setFormScopes([]); setFormExpiry(""); }}
                className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
            <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
            Loading API keys...
          </div>
        )}

        {error && <div className="text-sm text-destructive py-4">{error}</div>}

        {!loading && !error && keys.length === 0 && (
          <EmptyState
            icon={headerIcon}
            title="No API keys yet"
            description="Generate your first key to start integrating external systems."
            ctaLabel="Generate New Key"
            ctaAction={() => setShowCreateForm(true)}
          />
        )}

        {!loading && !error && keys.length > 0 && (
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Name</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Prefix</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Scopes</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Last Used</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {keys.map((k) => (
                  <tr
                    key={k.id}
                    className={`hover:bg-muted/30 transition-colors cursor-pointer ${k.status === "revoked" ? "opacity-50" : ""}`}
                    onClick={() => openDetail(k)}
                  >
                    <td className="px-4 py-3 font-medium">{k.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{k.key_prefix}...</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {k.scopes?.length ?? 0}/{ALL_SCOPES.length}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLOURS[k.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {k.status.charAt(0).toUpperCase() + k.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {k.last_used_at ? relativeTime(k.last_used_at) : "Never"}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {formatDate(k.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Detail Panel */}
        <DetailPanel
          open={!!selected}
          onClose={() => setSelected(null)}
          title={selected?.name ?? "API Key Detail"}
          subtitle="API Key"
          badge={
            selected ? (
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLOURS[selected.status] ?? "bg-gray-100 text-gray-600"}`}>
                {selected.status.charAt(0).toUpperCase() + selected.status.slice(1)}
              </span>
            ) : undefined
          }
        >
          {selected ? (
            <div className="space-y-5">
              {/* Name (editable) */}
              <div>
                <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Name</dt>
                {editingName ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-1 px-3 py-1.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
                    />
                    <button onClick={handleUpdateName} className="text-xs text-brand hover:underline">Save</button>
                    <button onClick={() => { setEditingName(false); setEditName(selected.name); }} className="text-xs text-muted-foreground hover:underline">Cancel</button>
                  </div>
                ) : (
                  <dd className="text-sm flex items-center gap-2">
                    {selected.name}
                    {selected.status === "active" && (
                      <button onClick={() => { setEditingName(true); setEditName(selected.name); }} className="text-xs text-brand hover:underline">Edit</button>
                    )}
                  </dd>
                )}
              </div>

              {/* Key prefix */}
              <div>
                <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Key Prefix</dt>
                <dd className="text-sm font-mono bg-muted/50 px-2 py-1 rounded inline-block">{selected.key_prefix}...</dd>
              </div>

              {/* Scopes */}
              <div>
                <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Scopes</dt>
                <dd className="flex flex-wrap gap-1 mt-1">
                  {selected.scopes?.map((scope) => (
                    <span key={scope} className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-mono">{scope}</span>
                  ))}
                  {(!selected.scopes || selected.scopes.length === 0) && (
                    <span className="text-sm text-muted-foreground">{"\u2014"}</span>
                  )}
                </dd>
              </div>

              {/* Status */}
              <div>
                <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Status</dt>
                <dd>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLOURS[selected.status] ?? "bg-gray-100 text-gray-600"}`}>
                    {selected.status.charAt(0).toUpperCase() + selected.status.slice(1)}
                  </span>
                </dd>
              </div>

              {/* Created by */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Created By</dt>
                  <dd className="text-sm">{selected.profiles?.full_name ?? "\u2014"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Created At</dt>
                  <dd className="text-sm">{formatDate(selected.created_at)}</dd>
                </div>
              </div>

              {/* Last used / Expiry */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Last Used</dt>
                  <dd className="text-sm">{selected.last_used_at ? relativeTime(selected.last_used_at) : "Never"}</dd>
                </div>
                {selected.expires_at && (
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Expires</dt>
                    <dd className="text-sm">{formatDate(selected.expires_at)}</dd>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="border-t border-border pt-4 space-y-3">
                {selected.status === "active" && (
                  <>
                    {!confirmRevoke ? (
                      <button
                        onClick={() => setConfirmRevoke(true)}
                        className="w-full px-4 py-2 rounded-lg border border-red-300 text-red-700 text-sm font-medium hover:bg-red-50 transition-colors"
                      >
                        Revoke Key
                      </button>
                    ) : (
                      <div className="border border-red-200 bg-red-50 rounded-lg p-3 space-y-2">
                        <p className="text-sm text-red-800">Are you sure you want to revoke this key? This cannot be undone. Any integrations using this key will stop working.</p>
                        <div className="flex gap-2">
                          <button
                            onClick={handleRevoke}
                            disabled={revoking}
                            className="px-4 py-1.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                          >
                            {revoking ? "Revoking..." : "Confirm Revoke"}
                          </button>
                          <button
                            onClick={() => setConfirmRevoke(false)}
                            className="px-4 py-1.5 rounded-lg border border-border text-sm hover:bg-muted transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {selected.status === "revoked" && (
                  <>
                    {!confirmDelete ? (
                      <button
                        onClick={() => setConfirmDelete(true)}
                        className="w-full px-4 py-2 rounded-lg border border-red-300 text-red-700 text-sm font-medium hover:bg-red-50 transition-colors"
                      >
                        Delete Key
                      </button>
                    ) : (
                      <div className="border border-red-200 bg-red-50 rounded-lg p-3 space-y-2">
                        <p className="text-sm text-red-800">Permanently delete this key? This action cannot be undone.</p>
                        <div className="flex gap-2">
                          <button
                            onClick={handleDelete}
                            disabled={deleting}
                            className="px-4 py-1.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                          >
                            {deleting ? "Deleting..." : "Confirm Delete"}
                          </button>
                          <button
                            onClick={() => setConfirmDelete(false)}
                            className="px-4 py-1.5 rounded-lg border border-border text-sm hover:bg-muted transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ) : null}
        </DetailPanel>
      </div>
    </TierGate>
  );
}
