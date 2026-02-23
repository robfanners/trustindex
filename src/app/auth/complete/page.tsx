"use client";

import { Suspense, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { safeRedirectPath } from "@/lib/url";

// ---------------------------------------------------------------------------
// /auth/complete — Client-side post-auth page
//
// Two purposes:
// 1. Explorer claim flow: after PKCE exchange in /auth/callback (route.ts),
//    this page reads localStorage for pending Explorer data, calls the claim
//    API, then redirects to the dashboard.
// 2. Hash-fragment fallback: if Supabase ever sends tokens in the URL hash
//    (legacy flow), this page polls for a session and redirects.
// ---------------------------------------------------------------------------

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex items-center gap-3 text-sm text-gray-500">
        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        Signing you in&hellip;
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Claim any pending Explorer survey data from localStorage
// ---------------------------------------------------------------------------

async function claimPendingExplorer(): Promise<void> {
  try {
    const explorerRaw = localStorage.getItem("ti_explorer_pending");
    if (!explorerRaw) return;

    const { runId } = JSON.parse(explorerRaw);
    if (!runId) return;

    // Read optional onboarding profile data
    let profileData: Record<string, string> = {};
    try {
      const onboardingRaw = localStorage.getItem("ti_onboarding_pending");
      if (onboardingRaw) profileData = JSON.parse(onboardingRaw);
    } catch {
      // ignore
    }

    await fetch("/api/claim-explorer-run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        runId,
        fullName: profileData.fullName,
        companyName: profileData.companyName,
        companySize: profileData.companySize,
        role: profileData.role,
      }),
    });

    // Clear localStorage regardless of success (avoid repeated attempts)
    localStorage.removeItem("ti_explorer_pending");
    localStorage.removeItem("ti_onboarding_pending");
  } catch {
    // Non-fatal — user can still access dashboard
  }
}

// ---------------------------------------------------------------------------
// Redirect helper — claim then navigate
// ---------------------------------------------------------------------------

async function claimAndRedirect(next: string) {
  await claimPendingExplorer();
  window.location.href = next;
}

// ---------------------------------------------------------------------------
// CompleteHandler
// ---------------------------------------------------------------------------

function CompleteHandler() {
  const searchParams = useSearchParams();
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const next = safeRedirectPath(searchParams.get("next"));
    const claim = searchParams.get("claim");

    if (claim === "1") {
      // Explorer claim flow — claim localStorage data then redirect
      claimAndRedirect(next);
      return;
    }

    // Fallback: if somehow we land here without claim, just redirect
    window.location.href = next;
  }, [searchParams]);

  return <Spinner />;
}

export default function AuthCompletePage() {
  return (
    <Suspense fallback={<Spinner />}>
      <CompleteHandler />
    </Suspense>
  );
}
