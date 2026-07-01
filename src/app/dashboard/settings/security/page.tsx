"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import MFAEnroll from "@/components/security/MFAEnroll";

// ---------------------------------------------------------------------------
// /dashboard/settings/security — Security settings
// ---------------------------------------------------------------------------
// Sections:
//  1. Current session (sign out)
//  2. Two-factor authentication (Phase A — TOTP enroll/disable)
//  3. Active sessions (Phase B — sign out from all other devices)
//  4. Security tokens (Phase C — rotate survey admin codes + revoke API keys)
// ---------------------------------------------------------------------------

type MFAFactor = {
  id: string;
  status: "verified" | "unverified";
  factor_type: "totp" | "phone";
  created_at: string;
};

type SurveyRow = {
  id: string;
  title: string;
  created_at: string;
  respondent_count: number;
};

type ApiKeyRow = {
  id: string;
  name: string;
  key_prefix: string;
  status: "active" | "revoked" | "expired";
  last_used_at: string | null;
  created_at: string;
};

export default function SecuritySettingsPage() {
  const { user, signOut } = useAuth();
  const supabase = createSupabaseBrowserClient();

  // ─── 2FA state ────────────────────────────────────────────────
  const [factors, setFactors] = useState<MFAFactor[] | null>(null);
  const [factorsLoading, setFactorsLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [disableCode, setDisableCode] = useState("");
  const [disableFactorId, setDisableFactorId] = useState<string | null>(null);
  const [disableError, setDisableError] = useState<string | null>(null);
  const [disabling, setDisabling] = useState(false);
  const [factorsError, setFactorsError] = useState<string | null>(null);

  // ─── Sessions state ────────────────────────────────────────────
  const [signingOutOthers, setSigningOutOthers] = useState(false);
  const [othersSignedOutAt, setOthersSignedOutAt] = useState<Date | null>(null);
  const [sessionsError, setSessionsError] = useState<string | null>(null);

  // ─── Survey admin codes state ──────────────────────────────────
  const [surveys, setSurveys] = useState<SurveyRow[] | null>(null);
  const [surveysLoading, setSurveysLoading] = useState(false);
  const [selectedSurveyIds, setSelectedSurveyIds] = useState<Set<string>>(new Set());
  const [rotatingSurveys, setRotatingSurveys] = useState(false);
  const [surveyResult, setSurveyResult] = useState<string | null>(null);
  const [surveysError, setSurveysError] = useState<string | null>(null);

  // ─── API keys state ────────────────────────────────────────────
  const [apiKeys, setApiKeys] = useState<ApiKeyRow[] | null>(null);
  const [apiKeysLoading, setApiKeysLoading] = useState(false);
  const [revokingKeyId, setRevokingKeyId] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);
  const [apiKeysError, setApiKeysError] = useState<string | null>(null);

  // ─── 2FA loaders ──────────────────────────────────────────────
  const refreshFactors = useCallback(async () => {
    setFactorsLoading(true);
    setFactorsError(null);
    const { data, error: err } = await supabase.auth.mfa.listFactors();
    if (err) {
      setFactorsError("Could not load 2FA settings. Please try again.");
      setFactors([]);
    } else {
      setFactors((data?.totp ?? []).filter((f) => f.status === "verified"));
    }
    setFactorsLoading(false);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshFactors();
  }, [refreshFactors]);

  const activeFactor = factors && factors.length > 0 ? factors[0] : null;

  // ─── Surveys loader ────────────────────────────────────────────
  const refreshSurveys = useCallback(async () => {
    setSurveysLoading(true);
    setSurveysError(null);
    try {
      const res = await fetch("/api/security/survey-tokens");
      if (!res.ok) {
        setSurveysError("Could not load your surveys.");
        setSurveys([]);
        return;
      }
      const data = await res.json();
      setSurveys(data.surveys ?? []);
    } catch {
      setSurveysError("Network error loading surveys.");
      setSurveys([]);
    } finally {
      setSurveysLoading(false);
    }
  }, []);

  // ─── API keys loader ────────────────────────────────────────────
  const refreshApiKeys = useCallback(async () => {
    setApiKeysLoading(true);
    setApiKeysError(null);
    try {
      const res = await fetch("/api/happ/api-keys");
      if (res.status === 403) {
        // Core users have no API keys — that's expected, not an error.
        setApiKeys([]);
        return;
      }
      if (!res.ok) {
        setApiKeysError("Could not load API keys.");
        setApiKeys([]);
        return;
      }
      const data = await res.json();
      setApiKeys(data.keys ?? []);
    } catch {
      setApiKeysError("Network error loading API keys.");
      setApiKeys([]);
    } finally {
      setApiKeysLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshSurveys();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshApiKeys();
  }, [refreshSurveys, refreshApiKeys]);

  // ─── 2FA actions ──────────────────────────────────────────────
  async function handleDisable() {
    if (!disableFactorId) return;
    setDisabling(true);
    setDisableError(null);

    const { data: challengeData, error: challengeErr } = await supabase.auth.mfa.challenge({
      factorId: disableFactorId,
    });
    if (challengeErr || !challengeData) {
      setDisableError("Could not verify your code. Try again.");
      setDisabling(false);
      return;
    }
    const { error: verifyErr } = await supabase.auth.mfa.verify({
      factorId: disableFactorId,
      challengeId: challengeData.id,
      code: disableCode,
    });
    if (verifyErr) {
      setDisableError("Incorrect code. Check your authenticator app.");
      setDisabling(false);
      return;
    }

    const { error: unenrollErr } = await supabase.auth.mfa.unenroll({
      factorId: disableFactorId,
    });
    if (unenrollErr) {
      setDisableError("Could not disable 2FA. Try again.");
      setDisabling(false);
      return;
    }

    setDisableFactorId(null);
    setDisableCode("");
    setDisabling(false);
    await refreshFactors();
  }

  // ─── Sessions actions ─────────────────────────────────────────
  async function handleSignOutOthers() {
    setSigningOutOthers(true);
    setSessionsError(null);
    const { error } = await supabase.auth.signOut({ scope: "others" });
    setSigningOutOthers(false);
    if (error) {
      setSessionsError("Could not sign out other sessions. Try again.");
      return;
    }
    setOthersSignedOutAt(new Date());
  }

  // ─── Survey token actions ─────────────────────────────────────
  function toggleSurveySelected(id: string) {
    setSelectedSurveyIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleRotateSurveys() {
    if (selectedSurveyIds.size === 0) return;
    setRotatingSurveys(true);
    setSurveysError(null);
    try {
      const res = await fetch("/api/security/survey-tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ surveyIds: Array.from(selectedSurveyIds) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSurveysError(data.error || "Could not rotate survey admin codes.");
        return;
      }
      setSurveyResult(
        `${data.rotated} survey admin code${data.rotated === 1 ? "" : "s"} rotated. Any previously shared admin URLs will no longer work.`
      );
      setSelectedSurveyIds(new Set());
    } catch {
      setSurveysError("Network error rotating tokens.");
    } finally {
      setRotatingSurveys(false);
    }
  }

  // ─── API key actions ──────────────────────────────────────────
  async function revokeKey(keyId: string) {
    setRevokingKeyId(keyId);
    setApiKeysError(null);
    try {
      const res = await fetch(`/api/happ/api-keys/${keyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "revoked" }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setApiKeysError(d.error || "Could not revoke key.");
        return;
      }
      await refreshApiKeys();
    } catch {
      setApiKeysError("Network error revoking key.");
    } finally {
      setRevokingKeyId(null);
    }
  }

  async function revokeAllKeys() {
    if (!apiKeys) return;
    const activeKeys = apiKeys.filter((k) => k.status === "active");
    if (activeKeys.length === 0) return;
    setRevokingAll(true);
    setApiKeysError(null);
    try {
      for (const key of activeKeys) {
        const res = await fetch(`/api/happ/api-keys/${key.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "revoked" }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          setApiKeysError(d.error || `Failed to revoke key ${key.name}.`);
          break;
        }
      }
      await refreshApiKeys();
    } finally {
      setRevokingAll(false);
    }
  }

  const activeApiKeys = (apiKeys ?? []).filter((k) => k.status === "active");

  return (
    <div className="space-y-6">
      {/* ─── Current session ────────────────────────────────── */}
      <div className="border border-border rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Current session</h2>

        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <div>
            <dt className="text-muted-foreground">Signed in as</dt>
            <dd className="font-medium">{user?.email ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Last sign-in</dt>
            <dd className="font-medium">
              {user?.last_sign_in_at
                ? new Date(user.last_sign_in_at).toLocaleString()
                : "—"}
            </dd>
          </div>
        </dl>

        <button
          onClick={signOut}
          className="px-4 py-2 rounded border border-border text-sm hover:bg-gray-50 transition-colors"
        >
          Sign out
        </button>
      </div>

      {/* ─── 2FA ───────────────────────────────────────────── */}
      <div className="border border-border rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            Two-factor authentication
          </h2>
          {activeFactor && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800 font-medium">
              Enabled
            </span>
          )}
        </div>

        {factorsLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : factorsError ? (
          <p className="text-sm text-destructive">{factorsError}</p>
        ) : activeFactor ? (
          <>
            <p className="text-sm text-muted-foreground">
              Two-factor authentication is protecting your account. You&apos;ll be asked
              for a 6-digit code from your authenticator app every time you sign in.
            </p>
            <p className="text-xs text-muted-foreground">
              Enabled {new Date(activeFactor.created_at).toLocaleDateString()}
            </p>

            {disableFactorId === activeFactor.id ? (
              <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/30">
                <p className="text-sm font-medium">Disable 2FA</p>
                <p className="text-xs text-muted-foreground">
                  Enter your current 6-digit code to confirm.
                </p>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={disableCode}
                  onChange={(e) => {
                    setDisableCode(e.target.value.replace(/\D/g, ""));
                    setDisableError(null);
                  }}
                  placeholder="000000"
                  className="w-full max-w-[240px] px-3 py-2 border border-border rounded-lg text-sm text-center tracking-[0.3em] font-mono focus:outline-none focus:ring-2 focus:ring-brand"
                />
                {disableError && <p className="text-xs text-destructive">{disableError}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={handleDisable}
                    disabled={disableCode.length !== 6 || disabling}
                    className="px-4 py-2 rounded-lg bg-destructive text-white text-sm font-medium hover:bg-destructive/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {disabling ? "Disabling..." : "Confirm disable"}
                  </button>
                  <button
                    onClick={() => {
                      setDisableFactorId(null);
                      setDisableCode("");
                      setDisableError(null);
                    }}
                    className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setDisableFactorId(activeFactor.id)}
                className="px-4 py-2 rounded border border-border text-sm hover:bg-muted transition-colors"
              >
                Disable 2FA
              </button>
            )}
          </>
        ) : enrolling ? (
          <MFAEnroll
            onComplete={() => {
              setEnrolling(false);
              refreshFactors();
            }}
            onCancel={() => setEnrolling(false)}
          />
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Add an extra layer of security to your account. Every sign-in will require a 6-digit code from your authenticator app.
            </p>
            <button
              onClick={() => setEnrolling(true)}
              className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand/90 transition-colors"
            >
              Enable 2FA
            </button>
          </>
        )}
      </div>

      {/* ─── Active sessions ──────────────────────────────── */}
      <div className="border border-border rounded-lg p-6 space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Active sessions</h2>
        <p className="text-sm text-muted-foreground">
          If you&apos;re signed in on other devices you no longer trust, sign them all out here. Your current session stays active.
        </p>
        {sessionsError && <p className="text-xs text-destructive">{sessionsError}</p>}
        {othersSignedOutAt && (
          <p className="text-xs text-green-700">
            All other sessions signed out at {othersSignedOutAt.toLocaleTimeString()}.
          </p>
        )}
        <button
          onClick={handleSignOutOthers}
          disabled={signingOutOthers}
          className="px-4 py-2 rounded border border-border text-sm hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {signingOutOthers ? "Signing out..." : "Sign out from all other devices"}
        </button>
      </div>

      {/* ─── Survey admin codes ──────────────────────────── */}
      <div className="border border-border rounded-lg p-6 space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Survey admin codes</h2>
        <p className="text-sm text-muted-foreground">
          Each survey you own has an admin URL that lets anyone with the link view responses and manage settings. If you&apos;ve shared one you shouldn&apos;t have, rotate the code below — the old URL will stop working.
        </p>

        {surveysError && <p className="text-xs text-destructive">{surveysError}</p>}
        {surveyResult && <p className="text-xs text-green-700">{surveyResult}</p>}

        {surveysLoading ? (
          <p className="text-sm text-muted-foreground">Loading surveys...</p>
        ) : surveys && surveys.length === 0 ? (
          <p className="text-xs text-muted-foreground">You don&apos;t have any surveys yet.</p>
        ) : (
          <>
            <div className="border border-border rounded-lg divide-y divide-border max-h-72 overflow-y-auto">
              {(surveys ?? []).map((s) => (
                <label
                  key={s.id}
                  className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-muted/40 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedSurveyIds.has(s.id)}
                    onChange={() => toggleSurveySelected(s.id)}
                    className="shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-medium">{s.title}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {new Date(s.created_at).toLocaleDateString()} · {s.respondent_count}{" "}
                      {s.respondent_count === 1 ? "respondent" : "respondents"}
                    </div>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleRotateSurveys}
                disabled={selectedSurveyIds.size === 0 || rotatingSurveys}
                className="px-4 py-2 rounded border border-border text-sm hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {rotatingSurveys
                  ? "Rotating..."
                  : `Rotate ${selectedSurveyIds.size} selected`}
              </button>
              {selectedSurveyIds.size > 0 && (
                <button
                  onClick={() => setSelectedSurveyIds(new Set())}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear selection
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* ─── System access tokens (HAPP API keys) ────────── */}
      <div className="border border-border rounded-lg p-6 space-y-3">
        <h2 className="text-lg font-semibold text-foreground">System access tokens</h2>
        <p className="text-sm text-muted-foreground">
          API keys used to access Verisum programmatically (HAPP protocol). Revoke any key you no longer trust — revoked keys stop working immediately.
        </p>

        {apiKeysError && <p className="text-xs text-destructive">{apiKeysError}</p>}

        {apiKeysLoading ? (
          <p className="text-sm text-muted-foreground">Loading keys...</p>
        ) : activeApiKeys.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            You don&apos;t have any active API keys.
          </p>
        ) : (
          <>
            <div className="border border-border rounded-lg divide-y divide-border">
              {activeApiKeys.map((k) => (
                <div
                  key={k.id}
                  className="flex items-center gap-3 px-3 py-2 text-sm"
                >
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-medium">{k.name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      <code className="font-mono">{k.key_prefix}...</code>
                      {" · "}
                      Created {new Date(k.created_at).toLocaleDateString()}
                      {k.last_used_at
                        ? ` · Last used ${new Date(k.last_used_at).toLocaleDateString()}`
                        : " · Never used"}
                    </div>
                  </div>
                  <button
                    onClick={() => revokeKey(k.id)}
                    disabled={revokingKeyId === k.id || revokingAll}
                    className="shrink-0 px-3 py-1 rounded border border-border text-xs hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {revokingKeyId === k.id ? "Revoking..." : "Revoke"}
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={revokeAllKeys}
              disabled={revokingAll || activeApiKeys.length === 0}
              className="px-4 py-2 rounded border border-destructive/40 text-destructive text-sm hover:bg-destructive/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {revokingAll ? "Revoking all..." : `Revoke all ${activeApiKeys.length} keys`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
