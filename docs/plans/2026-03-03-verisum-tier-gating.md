# Phase 2: Tier Gating System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the feature gating infrastructure — a `TierGate` wrapper component, an `UpgradeModal` for contextual upsell, and wire the sidebar's locked items to trigger the modal instead of doing nothing.

**Architecture:** A `TierGate` component wraps any feature content and checks the user's plan against a required tier. If the user meets the tier, children render normally. If not, a locked preview or the `UpgradeModal` is shown. The `UpgradeModal` is a shared dialog triggered from locked nav items and locked inline features, linking to `/upgrade`. Tier definitions consolidate into `lib/tiers.ts` as the single source of truth for feature-to-tier mapping.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind CSS, inline SVGs

---

## Task 1: Create Tier Definitions

**Files:**
- Create: `src/lib/tiers.ts`

This file is the single source of truth for Verisum tier names, descriptions, feature highlights, and which plan maps to which tier. It complements `navigation.ts` (nav structure) and `entitlements.ts` (plan limits).

```typescript
// src/lib/tiers.ts

import type { PlanName } from "@/lib/entitlements";

export type VersiumTier = "Core" | "Assure" | "Verify";

export type TierInfo = {
  name: VersiumTier;
  tagline: string;
  highlights: string[];
  /** Plans that map to this tier */
  plans: PlanName[];
};

export const TIERS: Record<VersiumTier, TierInfo> = {
  Core: {
    name: "Core",
    tagline: "Governance Intelligence Foundation",
    highlights: [
      "TrustOrg & TrustSys assessments",
      "Governance health scoring",
      "AI system registry & vendor register",
      "Gap prioritisation & actions",
      "Board-ready reports",
      "AI Copilot (policy generation)",
    ],
    plans: ["explorer", "starter"],
  },
  Assure: {
    name: "Assure",
    tagline: "Continuous Alignment & Runtime Governance",
    highlights: [
      "Everything in Core, plus:",
      "Drift detection & alerts",
      "Escalation workflows",
      "Runtime monitoring",
      "Incident capture & declarations",
      "Advanced reporting & audit timeline",
    ],
    plans: ["pro"],
  },
  Verify: {
    name: "Verify",
    tagline: "Cryptographic Proof & Trust Portability",
    highlights: [
      "Everything in Assure, plus:",
      "Human-verified approvals",
      "Governance attestations",
      "Provenance certificates",
      "Incident lock & forensic freeze",
      "Cross-org trust exchange",
      "On-chain anchoring",
    ],
    plans: ["enterprise"],
  },
};

/** Get the VersiumTier for a given plan */
export function planToTier(plan: string | null | undefined): VersiumTier {
  const p = (plan ?? "explorer") as PlanName;
  if (TIERS.Verify.plans.includes(p)) return "Verify";
  if (TIERS.Assure.plans.includes(p)) return "Assure";
  return "Core";
}

/** Get the TierInfo for a given plan */
export function getTierInfo(plan: string | null | undefined): TierInfo {
  return TIERS[planToTier(plan)];
}

/** Check if user's plan is at or above a required tier */
export function hasTierAccess(userPlan: string | null | undefined, requiredTier: VersiumTier): boolean {
  const tierOrder: VersiumTier[] = ["Core", "Assure", "Verify"];
  const userIdx = tierOrder.indexOf(planToTier(userPlan));
  const reqIdx = tierOrder.indexOf(requiredTier);
  return userIdx >= reqIdx;
}
```

Commit: `git add src/lib/tiers.ts && git commit -m "feat: add Verisum tier definitions and feature-to-tier mapping"`

---

## Task 2: Create UpgradeModal Component

**Files:**
- Create: `src/components/UpgradeModal.tsx`

A modal dialog that appears when users interact with tier-locked features. Shows the required tier name, tagline, feature highlights, and a CTA to the upgrade page. Follows the existing ConfirmDialog pattern (fixed overlay, z-[100], backdrop click to close, ESC to close).

```typescript
// src/components/UpgradeModal.tsx
"use client";

import { useEffect } from "react";
import Link from "next/link";
import { TIERS, type VersiumTier } from "@/lib/tiers";

type UpgradeModalProps = {
  open: boolean;
  requiredTier: VersiumTier;
  featureLabel?: string;
  onClose: () => void;
};

export default function UpgradeModal({ open, requiredTier, featureLabel, onClose }: UpgradeModalProps) {
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  const tier = TIERS[requiredTier];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        className="relative bg-background rounded-xl shadow-xl w-full max-w-md mx-4 p-6 border border-border"
        role="dialog"
        aria-modal="true"
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Lock icon */}
        <div className="flex justify-center mb-4">
          <div className="p-3 rounded-full bg-brand/10">
            <svg className="w-8 h-8 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <rect strokeWidth={1.5} x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
          </div>
        </div>

        {/* Tier badge */}
        <div className="text-center mb-4">
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-brand/10 text-brand">
            Verisum {tier.name}
          </span>
        </div>

        {/* Title */}
        <h3 className="text-lg font-semibold text-center mb-1">
          {featureLabel
            ? `${featureLabel} requires ${tier.name}`
            : `Upgrade to ${tier.name}`}
        </h3>
        <p className="text-sm text-muted-foreground text-center mb-5">
          {tier.tagline}
        </p>

        {/* Feature highlights */}
        <ul className="space-y-2 mb-6">
          {tier.highlights.map((h) => (
            <li key={h} className="flex items-start gap-2 text-sm">
              {h.endsWith(":") ? (
                <span className="text-muted-foreground font-medium">{h}</span>
              ) : (
                <>
                  <svg className="w-4 h-4 text-brand shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-foreground">{h}</span>
                </>
              )}
            </li>
          ))}
        </ul>

        {/* CTA */}
        <div className="flex flex-col gap-2">
          <Link
            href="/upgrade"
            onClick={onClose}
            className="w-full text-center px-4 py-2.5 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand/90 transition-colors"
          >
            View Plans & Pricing
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="w-full text-center px-4 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}
```

Commit: `git add src/components/UpgradeModal.tsx && git commit -m "feat: add UpgradeModal component for tier-gated features"`

---

## Task 3: Create TierGate Wrapper Component

**Files:**
- Create: `src/components/TierGate.tsx`

A wrapper component that renders children if the user meets the tier, or shows a locked state with upgrade CTA if not.

```typescript
// src/components/TierGate.tsx
"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { hasTierAccess, type VersiumTier } from "@/lib/tiers";
import UpgradeModal from "@/components/UpgradeModal";

type TierGateProps = {
  requiredTier: VersiumTier;
  featureLabel: string;
  children: React.ReactNode;
  /** Optional: render a custom locked preview instead of the default */
  lockedPreview?: React.ReactNode;
};

export default function TierGate({ requiredTier, featureLabel, children, lockedPreview }: TierGateProps) {
  const { profile } = useAuth();
  const [showModal, setShowModal] = useState(false);

  if (hasTierAccess(profile?.plan, requiredTier)) {
    return <>{children}</>;
  }

  return (
    <>
      {lockedPreview ?? (
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="w-full border border-dashed border-border rounded-xl p-8 text-center space-y-3 hover:border-brand/30 hover:bg-brand/5 transition-colors cursor-pointer"
        >
          <div className="text-muted-foreground/60">
            <svg className="w-10 h-10 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <rect strokeWidth={1.5} x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
            <p className="text-sm font-medium">{featureLabel}</p>
            <p className="text-xs mt-1">
              Available on Verisum {requiredTier} —{" "}
              <span className="text-brand underline">learn more</span>
            </p>
          </div>
        </button>
      )}
      <UpgradeModal
        open={showModal}
        requiredTier={requiredTier}
        featureLabel={featureLabel}
        onClose={() => setShowModal(false)}
      />
    </>
  );
}
```

Commit: `git add src/components/TierGate.tsx && git commit -m "feat: add TierGate wrapper component for inline feature gating"`

---

## Task 4: Wire Sidebar Locked Items to UpgradeModal

**Files:**
- Modify: `src/components/AuthenticatedShell.tsx`

Currently clicking a locked nav item calls `e.preventDefault()` and does nothing. Wire it to open the `UpgradeModal` instead.

Changes needed:
1. Import `UpgradeModal` and `VersiumTier`
2. Add state for upgrade modal: `upgradeModalOpen`, `upgradeModalTier`, `upgradeModalFeature`
3. In the locked item click handler, set modal state instead of just preventing default
4. Render `UpgradeModal` once at the end of the sidebar (not per item)

Specific edits:

**Add import** (after the navigation import):
```typescript
import UpgradeModal from "@/components/UpgradeModal";
import type { VersiumTier } from "@/lib/tiers";
```

**Add state** (after sidebarCollapsed state):
```typescript
const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
const [upgradeModalTier, setUpgradeModalTier] = useState<VersiumTier>("Assure");
const [upgradeModalFeature, setUpgradeModalFeature] = useState<string>("");
```

**Replace the locked click handler** — change the onClick in the nav item Link from:
```typescript
onClick={(e) => {
  if (isLocked) {
    e.preventDefault();
    return;
  }
  setSidebarOpen(false);
}}
```
to:
```typescript
onClick={(e) => {
  if (isLocked) {
    e.preventDefault();
    setUpgradeModalTier((section.tierBadge as VersiumTier) ?? "Assure");
    setUpgradeModalFeature(item.label);
    setUpgradeModalOpen(true);
    return;
  }
  setSidebarOpen(false);
}}
```

**Add UpgradeModal render** — after the closing `</div>` of the flex container (before the final closing `</div>` of the root), add:
```tsx
<UpgradeModal
  open={upgradeModalOpen}
  requiredTier={upgradeModalTier}
  featureLabel={upgradeModalFeature}
  onClose={() => setUpgradeModalOpen(false)}
/>
```

Commit: `git add src/components/AuthenticatedShell.tsx && git commit -m "feat: wire sidebar locked items to UpgradeModal"`

---

## Task 5: Build Verification

Run `npm run build` and `npx tsc --noEmit` to verify everything compiles.

Commit any fixes if needed.

---

## Summary

| Task | Description | New/Modified Files |
|------|-------------|-------------------|
| 1 | Tier definitions | Create `src/lib/tiers.ts` |
| 2 | UpgradeModal | Create `src/components/UpgradeModal.tsx` |
| 3 | TierGate wrapper | Create `src/components/TierGate.tsx` |
| 4 | Wire sidebar to modal | Modify `AuthenticatedShell.tsx` |
| 5 | Build verification | — |
