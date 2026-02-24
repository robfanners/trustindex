# Enterprise Upgrade + Full Brand Refresh — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade demo account to enterprise, build a reusable VCC plan-change endpoint, and perform a full visual overhaul of TrustGraph to align with the Verisum Unified Design System v2.0.

**Architecture:** Two independent workstreams. Workstream A (enterprise upgrade) creates a new VCC API route following the existing suspend/reinstate pattern, plus a UI button. Workstream B (brand refresh) uses a token-first approach: update globals.css design tokens and font first (cascading to all components), then sweep shell components, then inner components file by file.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS v4, Supabase, Inter font (Google Fonts)

**Design doc:** `docs/plans/2026-02-24-enterprise-upgrade-brand-refresh-design.md`

---

## Workstream A: Enterprise Account + VCC Plan Change

### Task 1: VCC Change Plan API Endpoint

**Files:**
- Create: `src/app/api/verisum-admin/organisations/[orgId]/plan/route.ts`

**Step 1: Create the endpoint**

Follow the exact pattern from `src/app/api/verisum-admin/organisations/[orgId]/route.ts` (PATCH handler, lines 120-201). The new endpoint:

```typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/vcc/adminAuth";
import { supabaseServer } from "@/lib/supabaseServer";
import { auditLog } from "@/lib/vcc/audit";
import type { PlanName } from "@/lib/entitlements";

const VALID_PLANS: PlanName[] = ["explorer", "pro", "enterprise"];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const auth = await requireAdmin("change_plans");
    if ("error" in auth) return auth.error;

    const { orgId } = await params;
    const body = await request.json();
    const plan = body.plan as string;
    const reason = String(body.reason ?? "").trim();

    if (!VALID_PLANS.includes(plan as PlanName)) {
      return NextResponse.json(
        { error: "plan must be 'explorer', 'pro', or 'enterprise'" },
        { status: 400 }
      );
    }

    if (!reason) {
      return NextResponse.json(
        { error: "reason is required" },
        { status: 400 }
      );
    }

    const db = supabaseServer();

    // Before snapshot
    const { data: before, error: fetchErr } = await db
      .from("profiles")
      .select("id, email, plan")
      .eq("id", orgId)
      .single();

    if (fetchErr || !before) {
      return NextResponse.json(
        { error: "Organisation not found" },
        { status: 404 }
      );
    }

    // Update plan
    const { data: after, error: updateErr } = await db
      .from("profiles")
      .update({ plan })
      .eq("id", orgId)
      .select("id, email, plan")
      .single();

    if (updateErr || !after) {
      return NextResponse.json(
        { error: updateErr?.message ?? "Failed to update plan" },
        { status: 500 }
      );
    }

    // Audit log
    await auditLog({
      adminUserId: auth.user.id,
      adminEmail: auth.user.email,
      adminRoles: auth.roles,
      action: "org.plan_changed",
      targetType: "organisation",
      targetId: orgId,
      reason,
      beforeSnapshot: before as unknown as Record<string, unknown>,
      afterSnapshot: after as unknown as Record<string, unknown>,
    });

    return NextResponse.json({ data: after });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

**Step 2: Verify build compiles**

Run: `npx next build`
Expected: Clean build, no TypeScript errors

**Step 3: Commit**

```bash
git add src/app/api/verisum-admin/organisations/\[orgId\]/plan/route.ts
git commit -m "feat(vcc): add change-plan API endpoint with audit logging"
```

### Task 2: VCC Plan Change UI

**Files:**
- Modify: `src/app/verisum-admin/organisations/[orgId]/page.tsx`

**Step 1: Add plan change UI**

In the org detail page, find the plan badge display. Add a "Change Plan" button next to it that:
- Is only visible when the admin's permissions include `change_plans` (check the admin data already fetched)
- When clicked, shows an inline form or modal with:
  - A `<select>` dropdown with options: explorer, pro, enterprise (pre-selected to current plan)
  - A required reason text input
  - Confirm / Cancel buttons
- On confirm, calls `PATCH /api/verisum-admin/organisations/${orgId}/plan` with `{ plan, reason }`
- On success, refreshes the page data (re-fetch org detail)
- On error, shows an error message

Look at the existing suspend/reinstate pattern in the same file for the interaction model. Can reuse the existing `ConfirmDialog` component from `src/components/vcc/ConfirmDialog.tsx` if it supports custom content, or add inline state management.

**Step 2: Verify build + visual check**

Run: `npx next build`
Expected: Clean build. Navigate to a VCC org detail page to verify the button appears.

**Step 3: Commit**

```bash
git add src/app/verisum-admin/organisations/\[orgId\]/page.tsx
git commit -m "feat(vcc): add plan change UI to org detail page"
```

### Task 3: Immediate Enterprise Upgrade (Manual)

**Step 1:** User runs this SQL in Supabase SQL editor:
```sql
UPDATE profiles SET plan = 'enterprise' WHERE email = 'rob.fanshawe@icloud.com';
```

No code change needed. Just document this was done.

---

## Workstream B: Full Brand Refresh

### Task 4: Foundation — Font Switch (Geist → Inter)

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css` (font-sans variable)

**Step 1: Update layout.tsx**

Replace the Geist imports with Inter:

```typescript
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AuthProvider } from "@/context/AuthContext";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "TrustGraph™ by Verisum",
  description: "Measure, map and strengthen organisational trust",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} antialiased`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
```

**Step 2: Update globals.css font-sans**

In the `@theme inline` block (line 222), update:
```css
--font-sans: var(--font-inter), 'Inter', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
```

Also grep for any references to `font-geist-sans` or `font-geist-mono` in the codebase and update them.

**Step 3: Verify build + visual check**

Run: `npx next build`
Expected: Clean build. Font changes across entire app.

**Step 4: Commit**

```bash
git add src/app/layout.tsx src/app/globals.css
git commit -m "feat(brand): switch font from Geist to Inter"
```

### Task 5: Foundation — globals.css Token Alignment

**Files:**
- Modify: `src/app/globals.css`

**Step 1: Update existing tokens in :root**

Reference: `/Users/robfanshawe/verisum.org/css/globals.css` (the unified design system source of truth).

Update these values:
- `--border: rgba(0, 0, 0, 0.08)` (was `rgba(0, 0, 0, 0.1)`)
- `--muted: #F3F4F6` (was `#ececf0`)
- `--muted-foreground: #6B7280` (was `#717182`)
- `--secondary: #f0eef5` (was oklch value)
- `--input-background: #F3F4F6` (was `#f3f3f5`)
- `--success: #00C851` (was `#2e8b57`)
- `--warning: #FF8C00` (was `#ffd700`)
- `--warning-foreground: #ffffff` (was `#000000`)
- `--font-weight-semibold: 600` (add — missing)
- `--font-weight-bold: 700` (add — missing)

**Step 2: Add new tokens in :root**

After the existing brand tokens, add:
```css
/* Extended brand tokens */
--brand-light: #e8f4fc;
--brand-subtle: rgba(52, 150, 218, 0.08);
--border-strong: rgba(0, 0, 0, 0.12);

/* Teal (governance, verification) */
--teal: #0d9488;
--teal-hover: #0a7c72;
--teal-light: #e0f5f3;

/* Coral (warm CTAs, urgency) */
--coral: #e8614d;
--coral-hover: #d14e3b;
--coral-light: #fdeae7;

/* Shadows */
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.04);
--shadow-md: 0 4px 16px rgba(0, 0, 0, 0.06);
--shadow-lg: 0 8px 32px rgba(0, 0, 0, 0.08);
--shadow-xl: 0 16px 48px rgba(0, 0, 0, 0.1);
--shadow-brand: 0 8px 32px rgba(52, 150, 218, 0.15);

/* Transitions */
--transition-fast: 0.15s cubic-bezier(0.4, 0, 0.2, 1);
--transition-base: 0.25s cubic-bezier(0.4, 0, 0.2, 1);
--transition-slow: 0.4s cubic-bezier(0.4, 0, 0.2, 1);
```

**Step 3: Add new tokens to @theme inline bridge**

Add these mappings so Tailwind can use them:
```css
--color-brand-light: var(--brand-light);
--color-brand-subtle: var(--brand-subtle);
--color-border-strong: var(--border-strong);
--color-teal: var(--teal);
--color-teal-hover: var(--teal-hover);
--color-teal-light: var(--teal-light);
--color-coral: var(--coral);
--color-coral-hover: var(--coral-hover);
--color-coral-light: var(--coral-light);
```

**Step 4: Update dark mode status tokens**

In the `.dark` block, update:
- `--success: #3dba73` (keep, already aligned)
- `--warning: #FF8C00` (keep for dark, same as light in unified system)
- `--warning-foreground: #000000` (dark text on bright orange)

**Step 5: Verify build**

Run: `npx next build`
Expected: Clean build. Token changes cascade to all components using semantic classes.

**Step 6: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(brand): align design tokens to Verisum Unified Design System v2.0"
```

### Task 6: Foundation — Logo Assets

**Files:**
- Create: `public/verisum-icon.png` (copy from verisum.org)
- Create: `public/verisum-icon-white.png` (copy from verisum.org)

**Step 1: Copy logo files**

```bash
cp /Users/robfanshawe/verisum.org/images/logos/verisum-icon.png /Users/robfanshawe/trustindex/public/verisum-icon.png
cp /Users/robfanshawe/verisum.org/images/logos/verisum-icon-white.png /Users/robfanshawe/trustindex/public/verisum-icon-white.png
```

**Step 2: Commit**

```bash
git add public/verisum-icon.png public/verisum-icon-white.png
git commit -m "feat(brand): add Verisum shield logo assets"
```

### Task 7: Shell — AppShell Redesign

**Files:**
- Modify: `src/components/AppShell.tsx`

**Step 1: Redesign the AppShell**

This is the public-facing layout. Use the `frontend-design` skill for this task.

Key changes:
- **Header**: Sticky, `backdrop-blur-lg saturate-[180%]`, height h-16 (64px), `bg-white/80`, border-b on scroll
- **Logo area**: `<Image src="/verisum-icon.png" width={28} height={28} />` with CSS filter `hue-rotate(-30deg) saturate(0.8) brightness(1.1)` to approximate blue tint, + "TrustGraph" text in `text-brand font-bold`
- **Nav links**: `text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-brand-subtle rounded-md px-3 py-2 transition-all`
- **CTA button**: `bg-gradient-to-br from-brand to-brand-hover text-white rounded-lg px-5 py-2 text-sm font-medium shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all`
- **Footer**: Dark blue gradient `bg-gradient-to-b from-[#0a2540] to-[#061b2e]`, white text/50 links, grid layout
- **Mobile menu**: Keep hamburger pattern, update colors to semantic tokens

Replace all `verisum-*` color classes with semantic tokens per the migration table in the design doc.

**Step 2: Verify build + visual check**

Run: `npx next build`
Expected: Clean build. Check public pages visually.

**Step 3: Commit**

```bash
git add src/components/AppShell.tsx
git commit -m "feat(brand): redesign AppShell header and footer to match unified design system"
```

### Task 8: Shell — AuthenticatedShell Redesign

**Files:**
- Modify: `src/components/AuthenticatedShell.tsx`

**Step 1: Redesign the AuthenticatedShell**

Use the `frontend-design` skill for this task.

Key changes:
- **Top bar**: Glass morphism header — `sticky top-0 z-40 backdrop-blur-lg saturate-[180%] bg-white/80 border-b border-border`
- **Sidebar header**: Add shield icon (20px) with blue filter + "TrustGraph" text
- **Sidebar nav items**: `rounded-lg px-3 py-2 text-sm hover:bg-muted transition-all`
- **Active nav**: `bg-brand/10 text-brand font-medium`
- **Sidebar footer**: Update copyright text styling
- Replace all `verisum-*` and `gray-*` classes with semantic tokens

**Step 2: Verify build + visual check**

Run: `npx next build`

**Step 3: Commit**

```bash
git add src/components/AuthenticatedShell.tsx
git commit -m "feat(brand): redesign AuthenticatedShell with glass morphism nav"
```

### Task 9: Shell — VCCShell Accent Update

**Files:**
- Modify: `src/components/vcc/VCCShell.tsx`

**Step 1: Update accent color**

Replace `amber-400`, `amber-500` etc. with `brand` color references.
- Active nav: `text-brand` instead of `text-amber-400`
- Active indicator: `bg-brand` instead of `bg-amber-400`
- Keep the dark sidebar background (it's correct for admin console)

**Step 2: Verify build + commit**

```bash
git add src/components/vcc/VCCShell.tsx
git commit -m "feat(brand): align VCC shell accent to brand blue"
```

### Task 10: Component Sweep — Forms & Auth

**Files:**
- Modify: `src/components/AccessGate.tsx`
- Modify: `src/components/RequireAuth.tsx`
- Modify: `src/components/OnboardingForm.tsx`
- Modify: `src/components/SurveyForm.tsx`
- Modify: `src/app/auth/login/page.tsx`

**Step 1: Migrate all verisum-* classes**

For each file, apply the color migration table from the design doc. Additionally:

**Buttons** — change from flat to gradient:
- `bg-verisum-blue text-verisum-white` → `bg-gradient-to-br from-brand to-brand-hover text-white shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all`
- `hover:bg-[#2a7bb8]` → remove (handled by gradient)
- `hover:bg-verisum-blue/90` → remove (handled by gradient)

**Inputs** — align focus rings:
- `focus:ring-2 focus:ring-verisum-blue focus:border-transparent` → `focus:ring-2 focus:ring-brand/30 focus:border-brand transition-all`
- `border-verisum-grey` on inputs → `border-transparent bg-input-background`

**Cards** — add hover effects where interactive:
- `border border-verisum-grey rounded-lg p-6` → `rounded-xl border border-border bg-card p-6 hover:shadow-md hover:-translate-y-0.5 transition-all`

**Spinners** — update border color:
- `border-verisum-blue` → `border-brand`

**Step 2: Verify build**

Run: `npx next build`

**Step 3: Commit**

```bash
git add src/components/AccessGate.tsx src/components/RequireAuth.tsx src/components/OnboardingForm.tsx src/components/SurveyForm.tsx src/app/auth/login/page.tsx
git commit -m "feat(brand): migrate form and auth components to unified design tokens"
```

### Task 11: Component Sweep — Results & Display Components

**Files:**
- Modify: `src/components/ExecutiveSummary.tsx`
- Modify: `src/components/MethodologyOverlay.tsx`
- Modify: `src/components/TierBadge.tsx`

**Step 1: Update display components**

These components already use mostly semantic tokens. Fine-tune:

**ExecutiveSummary.tsx:**
- Driver cards: add `hover:shadow-md hover:-translate-y-0.5 transition-all`
- Priority cards: same hover treatment

**MethodologyOverlay.tsx:**
- Modal backdrop: ensure `backdrop-blur-sm`
- Modal card: `bg-card rounded-2xl shadow-xl border border-border`
- Close button: `hover:bg-muted rounded-full transition-all`

**TierBadge.tsx:**
- No changes needed (already uses semantic tier tokens)

**Step 2: Verify build + commit**

```bash
git add src/components/ExecutiveSummary.tsx src/components/MethodologyOverlay.tsx src/components/TierBadge.tsx
git commit -m "feat(brand): refine display components with hover effects and aligned styling"
```

### Task 12: Component Sweep — VCC Admin Components

**Files:**
- Modify: `src/components/vcc/MetricCard.tsx`
- Modify: `src/components/vcc/ConfirmDialog.tsx`
- Modify: `src/components/vcc/RequireAdminRole.tsx` (minor)

**Step 1: Update VCC components**

**MetricCard.tsx:**
- Keep the left-border accent pattern
- Update `bg-blue-50` etc to semantic equivalents: `bg-brand-light`, `bg-teal-light`, etc.
- Text colors: `text-blue-700` → `text-brand`, etc.

**ConfirmDialog.tsx:**
- Modal backdrop: `bg-black/50 backdrop-blur-sm`
- Dialog card: `bg-card rounded-2xl shadow-xl border border-border`
- Primary button: gradient pattern
- Input focus: `focus:ring-2 focus:ring-brand/30`
- Destructive button: gradient destructive pattern

**Step 2: Verify build + commit**

```bash
git add src/components/vcc/MetricCard.tsx src/components/vcc/ConfirmDialog.tsx src/components/vcc/RequireAdminRole.tsx
git commit -m "feat(brand): align VCC admin components to unified design tokens"
```

### Task 13: Page Sweep — Dashboard Pages

**Files:**
- Modify: `src/app/dashboard/page.tsx`
- Modify: `src/app/dashboard/surveys/new/page.tsx`
- Modify: `src/app/dashboard/[runId]/page.tsx`
- Modify: `src/app/dashboard/surveys/[runId]/results/page.tsx`

**Step 1: Migrate all dashboard pages**

Apply the color migration table across all dashboard pages. Key patterns:

**Tab bars:**
- Active tab: `text-brand border-b-2 border-brand`
- Inactive: `text-muted-foreground hover:text-foreground`

**Tables:**
- Header: `bg-muted text-muted-foreground font-medium text-sm`
- Row hover: `hover:bg-muted/50 transition-colors`

**Plan badges:**
- `bg-verisum-blue/10 text-verisum-blue` → `bg-brand/10 text-brand`

**Action buttons:**
- Primary: gradient pattern
- Secondary: `border border-border text-foreground hover:bg-muted`
- Disabled: `bg-muted text-muted-foreground cursor-not-allowed`

**Result cards:**
- `border border-verisum-grey rounded-lg p-6` → `rounded-xl border border-border bg-card p-6 shadow-sm`

**Step 2: Verify build + commit**

```bash
git add src/app/dashboard/
git commit -m "feat(brand): migrate dashboard pages to unified design tokens"
```

### Task 14: Page Sweep — Settings Pages

**Files:**
- Modify: `src/app/dashboard/settings/page.tsx`
- Modify: `src/app/dashboard/settings/billing/page.tsx`
- Modify: `src/app/dashboard/settings/team/page.tsx`
- Modify: `src/app/dashboard/settings/security/page.tsx`
- Modify: `src/app/dashboard/settings/integrations/page.tsx`
- Modify: `src/app/dashboard/settings/data/page.tsx`

**Step 1: Migrate settings pages**

Same color migration table. Settings pages tend to have profile cards, form fields, and action buttons.

**Step 2: Verify build + commit**

```bash
git add src/app/dashboard/settings/
git commit -m "feat(brand): migrate settings pages to unified design tokens"
```

### Task 15: Page Sweep — Public & Survey Pages

**Files:**
- Modify: `src/app/try/page.tsx`
- Modify: `src/app/survey/[token]/page.tsx`
- Modify: `src/app/upgrade/page.tsx`
- Modify: `src/app/home.client.tsx` or `src/app/_homeClientImpl.tsx`

**Step 1: Migrate public pages**

These are the pages users see before logging in. Apply the color migration table and update:
- Hero sections: larger typography, gradient CTAs
- Survey completion screens: aligned card styling
- Explorer results: consistent with dashboard results

**Step 2: Verify build + commit**

```bash
git add src/app/try/ src/app/survey/ src/app/upgrade/ src/app/home.client.tsx src/app/_homeClientImpl.tsx
git commit -m "feat(brand): migrate public and survey pages to unified design tokens"
```

### Task 16: Page Sweep — Admin & VCC Pages

**Files:**
- Modify: `src/app/admin/run/[runId]/page.tsx`
- Modify: `src/app/admin/new-run/page.tsx`
- Modify: all files under `src/app/verisum-admin/`

**Step 1: Migrate admin pages**

For VCC pages (verisum-admin/*): keep the dark sidebar theme, update accent colors from amber to brand blue. Update card borders from `border-gray-200` → `border-border`. Update backgrounds from `bg-gray-50` → `bg-muted`.

For admin pages (admin/*): standard color migration.

**Step 2: Verify build + commit**

```bash
git add src/app/admin/ src/app/verisum-admin/
git commit -m "feat(brand): migrate admin and VCC pages to unified design tokens"
```

### Task 17: Cleanup — Remove verisum-* Aliases

**Files:**
- Modify: `src/app/globals.css`

**Step 1: Verify no verisum-* usage remains**

Run grep to confirm:
```bash
grep -r "verisum-" src/ --include="*.tsx" --include="*.ts" -l
```

Expected: No files found (all migrated in Tasks 10-16).

**Step 2: Remove aliases from globals.css**

Remove the backward-compatible alias block (lines 225-237 in current globals.css):
```css
/* Remove this entire block: */
--color-verisum-blue: var(--brand);
--color-verisum-blue-dark: var(--brand-hover);
--color-verisum-red: var(--destructive);
--color-verisum-black: var(--foreground);
--color-verisum-white: var(--background);
--color-verisum-grey: var(--muted-foreground);
--color-verisum-green: var(--success);
--color-verisum-yellow: var(--warning);
```

**Step 3: Verify build**

Run: `npx next build`
Expected: Clean build. No broken references.

**Step 4: Commit**

```bash
git add src/app/globals.css
git commit -m "chore(brand): remove deprecated verisum-* color aliases"
```

### Task 18: Final Verification

**Step 1: Full build**

Run: `npx next build`
Expected: Clean build, zero errors.

**Step 2: Grep verification**

```bash
grep -r "verisum-blue\|verisum-grey\|verisum-black\|verisum-white\|verisum-red\|verisum-green\|verisum-yellow" src/ --include="*.tsx" --include="*.ts" -l
```

Expected: No matches.

**Step 3: Final commit (if any remaining fixes)**

```bash
git add -A && git commit -m "feat: enterprise upgrade + full brand refresh — complete"
```

---

## Execution Notes

- **Tasks 1-3** (Workstream A) and **Tasks 4-6** (Workstream B foundation) can run in parallel
- **Tasks 7-9** (shells) should run sequentially — each affects layout
- **Tasks 10-16** (component + page sweep) can run in parallel using subagents
- **Task 17** (cleanup) must run after all sweeps are complete
- **Task 18** (verification) is always last

## Verification Checklist

- [ ] `npx next build` — clean
- [ ] No `verisum-*` color classes in any `.tsx`/`.ts` file
- [ ] VCC plan change endpoint works (change → audit log entry created)
- [ ] Font is Inter across all pages
- [ ] Verisum shield logo appears in headers
- [ ] All buttons use gradient pattern
- [ ] All interactive cards have hover-lift effect
- [ ] Glass morphism headers on public and dashboard shells
- [ ] Dark footer on public shell
- [ ] Mobile responsive at 375px, 768px, 1024px
