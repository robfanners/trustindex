"use client";

import { useEffect, useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TokenSummary = {
  id: string;
  token: string;
  label: string | null;
  is_active: boolean;
  created_at: string;
};

type DeclarationStats = {
  totalDeclarations: number;
  tokenCount: number;
};

type InviteStatsMap = Record<string, { sent: number; submitted: number }>;

// ---------------------------------------------------------------------------
// DeclarationManager
// ---------------------------------------------------------------------------

export default function DeclarationManager() {
  const [tokens, setTokens] = useState<TokenSummary[]>([]);
  const [stats, setStats] = useState<DeclarationStats | null>(null);
  const [inviteStats, setInviteStats] = useState<InviteStatsMap>({});
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);

  // Email sharing state
  const [sharingTokenId, setSharingTokenId] = useState<string | null>(null);
  const [emailInput, setEmailInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);

  // -----------------------------------------------------------------------
  // Data fetching
  // -----------------------------------------------------------------------

  async function loadDeclarations() {
    try {
      const res = await fetch("/api/declarations");
      if (res.ok) {
        const data = await res.json();
        setTokens(data.tokens ?? []);
        setStats({
          totalDeclarations: data.totalDeclarations ?? 0,
          tokenCount: data.tokenCount ?? 0,
        });
        setInviteStats(data.inviteStats ?? {});
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDeclarations();
  }, []);

  // -----------------------------------------------------------------------
  // Create token
  // -----------------------------------------------------------------------

  async function createToken() {
    setCreating(true);
    try {
      const res = await fetch("/api/declarations/create-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: newLabel.trim() || null }),
      });
      if (res.ok) {
        const data = await res.json();
        setTokens((prev) => [data.token, ...prev]);
        setNewLabel("");
        setShowCreate(false);
        // Copy URL to clipboard
        if (data.shareableUrl) {
          navigator.clipboard.writeText(data.shareableUrl).then(() => {
            setCopyMsg("Link copied to clipboard!");
            setTimeout(() => setCopyMsg(null), 3000);
          });
        }
      } else {
        const data = await res.json();
        alert(data.error || "Failed to create token");
      }
    } catch {
      alert("Failed to create token");
    } finally {
      setCreating(false);
    }
  }

  // -----------------------------------------------------------------------
  // Copy link
  // -----------------------------------------------------------------------

  function copyLink(token: string) {
    const url = `${window.location.origin}/declare/${token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopyMsg("Link copied!");
      setTimeout(() => setCopyMsg(null), 3000);
    });
  }

  // -----------------------------------------------------------------------
  // Send email invites
  // -----------------------------------------------------------------------

  async function sendInvites(tokenId: string) {
    const emails = emailInput
      .split(",")
      .map((e) => e.trim())
      .filter((e) => e.includes("@"));
    if (emails.length === 0) return;

    setSending(true);
    setSendResult(null);
    try {
      const res = await fetch("/api/declarations/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokenId, emails }),
      });
      if (res.ok) {
        const data = await res.json();
        setSendResult(`Sent to ${data.sent} recipient${data.sent !== 1 ? "s" : ""}`);
        setEmailInput("");
        // Refresh invite stats
        loadDeclarations();
        setTimeout(() => {
          setSendResult(null);
          setSharingTokenId(null);
        }, 3000);
      } else {
        const data = await res.json();
        setSendResult(data.error || "Failed to send invites");
      }
    } catch {
      setSendResult("Failed to send invites");
    } finally {
      setSending(false);
    }
  }

  // -----------------------------------------------------------------------
  // Loading state
  // -----------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
        <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        Loading declarations...
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Stats row */}
      {stats && (
        <div className="flex gap-4">
          <div className="text-center px-5 py-3 bg-muted/50 rounded-lg border border-border">
            <div className="text-2xl font-bold text-foreground">{stats.totalDeclarations}</div>
            <div className="text-xs text-muted-foreground">Declarations</div>
          </div>
          <div className="text-center px-5 py-3 bg-muted/50 rounded-lg border border-border">
            <div className="text-2xl font-bold text-foreground">{stats.tokenCount}</div>
            <div className="text-xs text-muted-foreground">Active links</div>
          </div>
        </div>
      )}

      {/* Token list */}
      {tokens.length > 0 ? (
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="bg-muted/50 px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Campaign links
          </div>
          <div className="divide-y divide-border">
            {tokens.map((t) => (
              <div key={t.id} className="px-4 py-3 space-y-2">
                {/* Token header row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-sm font-medium truncate">
                      {t.label || "Declaration link"}
                    </span>
                    {t.is_active ? (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-800 shrink-0">
                        Active
                      </span>
                    ) : (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 shrink-0">
                        Inactive
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Invite stats badges */}
                    {inviteStats[t.id] && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mr-2">
                        <span title="Invites sent" className="px-1.5 py-0.5 rounded bg-muted">
                          {inviteStats[t.id].sent} sent
                        </span>
                        <span title="Declarations submitted" className="px-1.5 py-0.5 rounded bg-muted">
                          {inviteStats[t.id].submitted} submitted
                        </span>
                      </div>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {new Date(t.created_at).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                    {t.is_active && (
                      <>
                        <button
                          onClick={() => copyLink(t.token)}
                          className="text-xs px-2.5 py-1 rounded border border-border hover:bg-muted transition-colors"
                        >
                          Copy link
                        </button>
                        <button
                          onClick={() =>
                            setSharingTokenId(sharingTokenId === t.id ? null : t.id)
                          }
                          className="text-xs px-2.5 py-1 rounded border border-brand/30 text-brand hover:bg-brand/5 transition-colors"
                        >
                          Send invite
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Email sharing form (expanded) */}
                {sharingTokenId === t.id && (
                  <div className="space-y-2 border-t border-border pt-3">
                    <textarea
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      placeholder="Enter email addresses, separated by commas"
                      rows={2}
                      className="w-full border border-border rounded px-3 py-1.5 text-sm bg-background resize-none focus:outline-none focus:ring-1 focus:ring-brand"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => sendInvites(t.id)}
                        disabled={sending || !emailInput.trim()}
                        className="text-xs px-3 py-1.5 rounded bg-brand text-white hover:bg-brand-hover disabled:opacity-50 transition-colors"
                      >
                        {sending ? "Sending..." : "Send invitations"}
                      </button>
                      <button
                        onClick={() => {
                          setSharingTokenId(null);
                          setEmailInput("");
                          setSendResult(null);
                        }}
                        className="text-xs px-3 py-1.5 rounded border border-border hover:bg-muted transition-colors"
                      >
                        Cancel
                      </button>
                      {sendResult && (
                        <span
                          className={`text-xs ${
                            sendResult.startsWith("Sent")
                              ? "text-green-600"
                              : "text-red-600"
                          }`}
                        >
                          {sendResult}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="border border-dashed border-border rounded-xl p-12 text-center">
          <p className="text-sm text-muted-foreground">
            No declaration campaigns yet. Create your first link below to start collecting staff AI usage declarations.
          </p>
        </div>
      )}

      {/* Copy confirmation */}
      {copyMsg && <p className="text-xs text-green-600">{copyMsg}</p>}

      {/* Create new token */}
      {showCreate ? (
        <div className="border border-border rounded-lg p-4 space-y-3">
          <p className="text-sm font-medium text-foreground">New declaration campaign</p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="e.g. Q1 2026 AI Usage Declaration"
              className="flex-1 border border-border rounded px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-brand"
            />
            <button
              onClick={createToken}
              disabled={creating}
              className="text-sm px-4 py-1.5 rounded bg-brand text-white hover:bg-brand-hover disabled:opacity-50 transition-colors"
            >
              {creating ? "Creating..." : "Create"}
            </button>
            <button
              onClick={() => {
                setShowCreate(false);
                setNewLabel("");
              }}
              className="text-sm px-3 py-1.5 rounded border border-border hover:bg-muted transition-colors"
            >
              Cancel
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Give this campaign a clear name so you can identify it later.
            A shareable link will be copied to your clipboard automatically.
          </p>
        </div>
      ) : (
        <button
          onClick={() => setShowCreate(true)}
          className="text-sm px-4 py-2 rounded bg-brand text-white hover:bg-brand-hover transition-colors"
        >
          Create declaration link
        </button>
      )}
    </div>
  );
}
