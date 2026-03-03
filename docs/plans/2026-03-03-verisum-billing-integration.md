# Phase 4: Billing Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Connect the Verisum tier model to the billing system — rebrand the upgrade page with tier terminology, pass tier context from locked features to checkout, and enforce tiers at the API level (not just UI hiding).

**Architecture:** The upgrade page groups plans under their Verisum tier names (Core, Assure, Verify) instead of showing four flat cards. The UpgradeModal passes a `tier` query param so the upgrade page can highlight the relevant tier. A shared `requireTier()` helper enforces plan tiers in API routes, returning 403 for insufficient plans. Monitor-tier APIs (drift, escalations) use this helper.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind CSS, Stripe

---

## Task 1: Create API Tier Enforcement Helper

**Files:**
- Create: `src/lib/requireTier.ts`

A server-only helper that checks the authenticated user's plan against a required tier and returns a 403 if insufficient. Used by API routes to enforce tier access.

```typescript
// src/lib/requireTier.ts

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-auth-server";
import { supabaseServer } from "@/lib/supabaseServer";
import { hasTierAccess, type VersiumTier } from "@/lib/tiers";

type TierCheckResult =
  | { authorized: true; userId: string; plan: string; orgId: string | null }
  | { authorized: false; response: NextResponse };

/**
 * Check that the authenticated user's plan meets the required Verisum tier.
 * Returns user info if authorized, or a NextResponse to return if not.
 *
 * Usage in API routes:
 * ```ts
 * const check = await requireTier("Assure");
 * if (!check.authorized) return check.response;
 * // check.userId, check.plan, check.orgId available
 * ```
 */
export async function requireTier(requiredTier: VersiumTier): Promise<TierCheckResult> {
  const authClient = await createSupabaseServerClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    return {
      authorized: false,
      response: NextResponse.json({ error: "Not authenticated" }, { status: 401 }),
    };
  }

  const db = supabaseServer();
  const { data: profile } = await db
    .from("profiles")
    .select("plan, organisation_id")
    .eq("id", user.id)
    .single();

  const plan = profile?.plan ?? "explorer";

  if (!hasTierAccess(plan, requiredTier)) {
    return {
      authorized: false,
      response: NextResponse.json(
        {
          error: "Plan upgrade required",
          required_tier: requiredTier,
          current_plan: plan,
        },
        { status: 403 }
      ),
    };
  }

  return {
    authorized: true,
    userId: user.id,
    plan,
    orgId: profile?.organisation_id ?? null,
  };
}
```

Commit: `git add src/lib/requireTier.ts && git commit -m "feat: add requireTier() API enforcement helper"`

---

## Task 2: Add Tier Enforcement to Monitor APIs

**Files:**
- Modify: `src/app/api/trustgraph/drift/route.ts`
- Modify: `src/app/api/trustgraph/escalations/route.ts`

Add `requireTier("Assure")` check at the top of each route handler. These APIs serve data for the Monitor section which requires the Assure tier (Pro plan).

Changes for **drift/route.ts** — replace the manual auth + profile lookup at the top of GET with:

```typescript
import { requireTier } from "@/lib/requireTier";

// Inside GET handler, replace the auth block with:
const check = await requireTier("Assure");
if (!check.authorized) return check.response;

if (!check.orgId) {
  return NextResponse.json({ error: "No organisation linked" }, { status: 400 });
}
// Use check.orgId instead of profile.organisation_id from here
```

Changes for **escalations/route.ts** — same pattern. The existing `getAuthenticatedOrg()` helper stays for non-tier-gated routes, but the main GET/POST handlers for escalations should add the tier check before calling it, or replace it with `requireTier("Assure")`.

Commit: `git add src/app/api/trustgraph/drift/route.ts src/app/api/trustgraph/escalations/route.ts && git commit -m "feat: enforce Assure tier on drift and escalation API routes"`

---

## Task 3: Rebrand Upgrade Page with Tier Names

**Files:**
- Modify: `src/app/upgrade/page.tsx`

Restructure the upgrade page to group plans under Verisum tier names. Instead of 4 flat cards, show 3 tier groups:

**Changes:**

1. **Import tier data:**
```typescript
import { TIERS, type VersiumTier } from "@/lib/tiers";
```

2. **Add tier badges** — each pricing card gets a tier badge above the plan name showing "Verisum Core", "Verisum Assure", or "Verisum Verify".

3. **Add tier property to PlanTier type:**
```typescript
type PlanTier = {
  // ...existing fields...
  tier: VersiumTier;
  tierTagline: string;
};
```

4. **Update tiers array** — add `tier` and `tierTagline` to each entry:
- Explorer: `tier: "Core"`, `tierTagline: "Governance Intelligence Foundation"`
- Starter: `tier: "Core"`, `tierTagline: "Governance Intelligence Foundation"`
- Pro: `tier: "Assure"`, `tierTagline: "Continuous Alignment & Runtime Governance"`
- Enterprise: `tier: "Verify"`, `tierTagline: "Cryptographic Proof & Trust Portability"`

5. **Render tier badge** in each card above the plan name:
```tsx
<span className="text-xs font-medium px-2.5 py-1 rounded-full bg-brand/10 text-brand">
  Verisum {tier.tier}
</span>
```

6. **Update header text** from "Plans & pricing" to:
```
Plans & Pricing
Choose the Verisum tier that matches your governance maturity.
```

7. **Update feature matrix headers** — add tier names as subheadings:
```
Explorer → Core | Starter → Core | Pro → Assure | Enterprise → Verify
```

8. **Support `?tier=` query param** — if `tier=Assure` is in the URL, auto-scroll or highlight the relevant plan cards. Add after the searchParams logic:
```typescript
const highlightTier = searchParams.get("tier") as VersiumTier | null;
```
Add a highlight ring to cards whose tier matches:
```tsx
className={`... ${highlightTier === tier.tier ? "ring-2 ring-brand" : ""}`}
```

Commit: `git add src/app/upgrade/page.tsx && git commit -m "feat: rebrand upgrade page with Verisum tier names and tier highlighting"`

---

## Task 4: Pass Tier Context from UpgradeModal

**Files:**
- Modify: `src/components/UpgradeModal.tsx`

Update the "View Plans & Pricing" link to include the required tier as a query parameter, so the upgrade page highlights the relevant tier.

Change:
```tsx
<Link href="/upgrade" ...>
```
to:
```tsx
<Link href={`/upgrade?tier=${requiredTier}`} ...>
```

Commit: `git add src/components/UpgradeModal.tsx && git commit -m "feat: pass tier context from UpgradeModal to upgrade page"`

---

## Task 5: Build Verification

Run `npm run build` and `npx tsc --noEmit` to verify everything compiles.

Commit any fixes if needed.

---

## Summary

| Task | Description | New/Modified Files |
|------|-------------|-------------------|
| 1 | API tier enforcement helper | Create `src/lib/requireTier.ts` |
| 2 | Enforce tier on monitor APIs | Modify drift + escalations routes |
| 3 | Rebrand upgrade page with tiers | Modify `upgrade/page.tsx` |
| 4 | Pass tier context from modal | Modify `UpgradeModal.tsx` |
| 5 | Build verification | — |
