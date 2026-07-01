"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

// ---------------------------------------------------------------------------
// MFAEnroll — reusable TOTP enrollment component
//
// Renders the full enrollment flow:
//   1. Loading — call supabase.auth.mfa.enroll({ factorType: "totp" })
//   2. Scan   — show QR code + secret text, wait for user to scan in their
//               authenticator app (Google Authenticator, 1Password, Authy, etc.)
//   3. Verify — user enters the 6-digit code; call verify() → upgrades to aal2
//   4. Done   — callback fires, parent decides where to redirect
//
// If any step errors, the factor is unenrolled to avoid leaving a stale
// pending factor on the user's account.
// ---------------------------------------------------------------------------

type MFAEnrollProps = {
  /** Called when enrollment completes successfully. */
  onComplete: () => void;
  /** Optional callback if user cancels enrollment. If undefined, no cancel button is shown. */
  onCancel?: () => void;
  /** Additional intro copy above the QR code (defaults to a standard prompt). */
  intro?: React.ReactNode;
};

type EnrollmentState =
  | { status: "loading" }
  | { status: "scan"; factorId: string; qrSvg: string; secret: string }
  | { status: "verify"; factorId: string; qrSvg: string; secret: string; code: string; verifying: boolean; error: string | null }
  | { status: "error"; message: string };

export default function MFAEnroll({ onComplete, onCancel, intro }: MFAEnrollProps) {
  const [state, setState] = useState<EnrollmentState>({ status: "loading" });
  const supabase = createSupabaseBrowserClient();

  // Start enrollment on mount
  useEffect(() => {
    let cancelled = false;
    async function enroll() {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
      if (cancelled) return;
      if (error || !data) {
        setState({ status: "error", message: error?.message ?? "Could not start 2FA enrollment." });
        return;
      }
      setState({
        status: "scan",
        factorId: data.id,
        qrSvg: data.totp.qr_code,
        secret: data.totp.secret,
      });
    }
    enroll();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Unenroll factor if user cancels — prevents stale pending factors.
  async function cancelEnrollment() {
    if (state.status === "scan" || state.status === "verify") {
      await supabase.auth.mfa.unenroll({ factorId: state.factorId });
    }
    onCancel?.();
  }

  async function verifyCode(factorId: string, code: string) {
    setState((prev) => {
      if (prev.status !== "verify") return prev;
      return { ...prev, verifying: true, error: null };
    });

    const { data: challengeData, error: challengeError } =
      await supabase.auth.mfa.challenge({ factorId });
    if (challengeError || !challengeData) {
      setState((prev) => {
        if (prev.status !== "verify") return prev;
        return { ...prev, verifying: false, error: "Could not initiate verification. Try again." };
      });
      return;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challengeData.id,
      code,
    });

    if (verifyError) {
      setState((prev) => {
        if (prev.status !== "verify") return prev;
        return {
          ...prev,
          verifying: false,
          error: "Incorrect code. Check your authenticator app and try again.",
        };
      });
      return;
    }

    onComplete();
  }

  if (state.status === "loading") {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        Generating your 2FA setup...
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="border border-destructive/30 bg-destructive/5 rounded-lg p-4 space-y-2">
        <p className="text-sm font-medium text-destructive">2FA setup failed</p>
        <p className="text-xs text-muted-foreground">{state.message}</p>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Close
          </button>
        )}
      </div>
    );
  }

  // scan and verify share the same UI layout
  const { factorId, qrSvg, secret } = state;
  const isVerifying = state.status === "verify";
  const code = isVerifying ? state.code : "";
  const codeError = isVerifying ? state.error : null;
  const verifying = isVerifying ? state.verifying : false;

  return (
    <div className="space-y-5">
      {intro ?? (
        <p className="text-sm text-muted-foreground">
          Scan this QR code with your authenticator app (Google Authenticator, 1Password, Authy, Microsoft Authenticator, etc.) then enter the 6-digit code to confirm.
        </p>
      )}

      {/* QR code — Supabase returns totp.qr_code as a data URL
          ("data:image/svg+xml;utf-8,<svg>..."), which needs an <img> tag,
          not dangerouslySetInnerHTML (that would render the prefix as text). */}
      <div className="flex flex-col items-center gap-3">
        <div className="w-48 h-48 border border-border rounded-lg p-2 bg-white flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrSvg}
            alt="Scan this QR code with your authenticator app"
            className="w-full h-full"
          />
        </div>
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer hover:text-foreground">Can&apos;t scan? Enter this key manually.</summary>
          <code className="block mt-2 px-3 py-2 bg-muted/50 rounded font-mono text-[11px] break-all select-all">
            {secret}
          </code>
        </details>
      </div>

      {/* Verify code */}
      <div className="space-y-2">
        <label htmlFor="totp-code" className="block text-xs font-medium text-muted-foreground">
          Enter the 6-digit code from your authenticator
        </label>
        <input
          id="totp-code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => {
            const val = e.target.value.replace(/\D/g, "");
            setState({
              status: "verify",
              factorId,
              qrSvg,
              secret,
              code: val,
              verifying: false,
              error: null,
            });
          }}
          placeholder="000000"
          className="w-full px-3 py-2 border border-border rounded-lg text-sm text-center tracking-[0.3em] font-mono focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
        />
        {codeError && <p className="text-xs text-destructive">{codeError}</p>}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          disabled={code.length !== 6 || verifying}
          onClick={() => verifyCode(factorId, code)}
          className="flex-1 px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {verifying ? "Verifying..." : "Enable 2FA"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={cancelEnrollment}
            className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
