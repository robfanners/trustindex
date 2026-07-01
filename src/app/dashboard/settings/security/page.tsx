"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import MFAEnroll from "@/components/security/MFAEnroll";

// ---------------------------------------------------------------------------
// /dashboard/settings/security — Security settings
// ---------------------------------------------------------------------------
// 2FA (TOTP) — opt-in for all tiers. Enrollment, disable, and status all
// live here. Login challenge lives on /auth/login.
//
// Active sessions + security tokens are still "Coming soon" — those ship
// in follow-up PRs (Phase B + C of task #36).
// ---------------------------------------------------------------------------

type MFAFactor = {
  id: string;
  status: "verified" | "unverified";
  friendly_name?: string;
  factor_type: "totp" | "phone";
  created_at: string;
};

export default function SecuritySettingsPage() {
  const { user, signOut } = useAuth();
  const supabase = createSupabaseBrowserClient();

  const [factors, setFactors] = useState<MFAFactor[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [disableCode, setDisableCode] = useState("");
  const [disableFactorId, setDisableFactorId] = useState<string | null>(null);
  const [disableError, setDisableError] = useState<string | null>(null);
  const [disabling, setDisabling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase.auth.mfa.listFactors();
    if (err) {
      setError("Could not load 2FA settings. Please try again.");
      setFactors([]);
    } else {
      // Only show verified TOTP factors — pending/unverified factors are
      // enrollment orphans (user closed the modal mid-flow) and shouldn't
      // be treated as "2FA is on".
      setFactors((data?.totp ?? []).filter((f) => f.status === "verified"));
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    // refresh() calls setState (setLoading/setError/setFactors) during its
    // async body — that's the point, we're syncing React state with the
    // Supabase MFA factor list on mount. The lint rule flags this as a
    // potential cascading-render pattern; safe to disable here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  const activeFactor = factors && factors.length > 0 ? factors[0] : null;

  async function handleDisable() {
    if (!disableFactorId) return;
    setDisabling(true);
    setDisableError(null);

    // Challenge + verify with the current code first — prevents disable
    // by someone who has a session but not the TOTP device.
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
    await refresh();
  }

  return (
    <div className="space-y-6">
      {/* Current session */}
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

      {/* Two-factor authentication */}
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

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : activeFactor ? (
          // Enrolled state
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
          // Enrollment flow
          <MFAEnroll
            onComplete={() => {
              setEnrolling(false);
              refresh();
            }}
            onCancel={() => setEnrolling(false)}
          />
        ) : (
          // Not enrolled — show CTA
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

      {/* Active sessions */}
      <div className="border border-border rounded-lg p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Active sessions</h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-muted-foreground font-medium">
            Coming soon
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          View and manage your active sessions across devices. This feature is
          coming in a future update.
        </p>
        <button
          disabled
          className="px-4 py-2 rounded border border-border text-sm text-muted-foreground cursor-not-allowed opacity-50"
        >
          View active sessions
        </button>
      </div>

      {/* Reset tokens */}
      <div className="border border-border rounded-lg p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Security tokens</h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-muted-foreground font-medium">
            Coming soon
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          Reset survey admin codes and system access tokens. This feature is
          coming in a future update.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            disabled
            className="px-4 py-2 rounded border border-border text-sm text-muted-foreground cursor-not-allowed opacity-50"
          >
            Reset survey admin codes
          </button>
          <button
            disabled
            className="px-4 py-2 rounded border border-border text-sm text-muted-foreground cursor-not-allowed opacity-50"
          >
            Reset system access tokens
          </button>
        </div>
      </div>
    </div>
  );
}
