"use client";

import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { safeRedirectPath } from "@/lib/url";
import AppShell from "@/components/AppShell";
import MFAEnroll from "@/components/security/MFAEnroll";

// ---------------------------------------------------------------------------
// /auth/setup-mfa — mandatory 2FA enrollment
//
// Reached by middleware redirect when a user signed up after
// MFA_ENFORCE_NEW_SIGNUPS_FROM but has no verified TOTP factor. Once they
// finish enrollment, they're redirected back to their intended destination
// (or /dashboard if none was provided).
//
// Existing users signing up before the enforcement date bypass this page —
// they see the opt-in "Enable 2FA" CTA in Settings → Security instead.
// ---------------------------------------------------------------------------

export default function SetupMfaPage() {
  const { user, loading } = useAuth();

  const next =
    typeof window !== "undefined"
      ? safeRedirectPath(
          new URLSearchParams(window.location.search).get("next")
        )
      : "/dashboard";

  // Guard: unauthenticated users get bounced to login.
  useEffect(() => {
    if (!loading && !user) {
      window.location.href = "/auth/login";
    }
  }, [loading, user]);

  if (loading || !user) {
    return (
      <AppShell>
        <div className="max-w-md mx-auto py-16 text-center text-sm text-muted-foreground">
          Loading...
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-md mx-auto py-12 px-4">
        <div className="text-center mb-8 space-y-2">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-brand/10 text-brand mb-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold">Set up two-factor authentication</h1>
          <p className="text-sm text-muted-foreground">
            Verisum is a security platform — we require 2FA on every new account. It takes about a minute.
          </p>
        </div>

        <div className="border border-border rounded-xl p-6 bg-background">
          <MFAEnroll
            intro={
              <div className="space-y-3">
                <p className="text-sm">
                  <span className="font-medium">Step 1.</span> Install an authenticator app on your phone if you don&apos;t have one. We recommend <span className="font-medium">1Password</span>, <span className="font-medium">Google Authenticator</span>, or <span className="font-medium">Authy</span>.
                </p>
                <p className="text-sm">
                  <span className="font-medium">Step 2.</span> Scan the QR code below in your app, then enter the 6-digit code to confirm.
                </p>
              </div>
            }
            onComplete={() => {
              window.location.href = next;
            }}
          />
        </div>

        <p className="text-xs text-muted-foreground text-center mt-6">
          Signed in as <span className="font-medium text-foreground">{user.email}</span>
        </p>
      </div>
    </AppShell>
  );
}
