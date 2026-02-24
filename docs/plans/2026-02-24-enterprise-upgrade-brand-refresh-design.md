# Enterprise Upgrade + Full Brand Refresh — Design Document

**Date:** 2026-02-24
**Status:** Approved
**Scope:** Two workstreams — (A) Enterprise account upgrade for demo, (B) Full visual overhaul aligning TrustGraph to the Verisum Unified Design System v2.0

---

## Workstream A: Enterprise Account Upgrade

### A1 — Immediate SQL (manual)

```sql
UPDATE profiles SET plan = 'enterprise' WHERE email = 'rob.fanshawe@icloud.com';
```

Run in Supabase SQL editor. This gives immediate access to all enterprise features for demoing.

### A2 — VCC Change Plan Endpoint

**New file:** `src/app/api/verisum-admin/organisations/[orgId]/plan/route.ts`

- **Method:** `PATCH`
- **Body:** `{ plan: "explorer" | "pro" | "enterprise", reason: string }`
- **Permission:** `change_plans` (SUPER_ADMIN and BILLING_ADMIN already have this)
- **Behavior:**
  1. Validate caller has `change_plans` permission via `requirePermission()`
  2. Validate plan is one of the three valid values
  3. Fetch current plan from `profiles` table (before snapshot)
  4. Update `profiles.plan` for the target user
  5. Create audit log entry: `action: "org.plan_changed"`, with `before_snapshot` and `after_snapshot`
  6. Return updated profile

**Existing infrastructure to reuse:**
- `src/lib/vcc/permissions.ts` — `hasPermission()`, `change_plans` permission
- `src/lib/vcc/audit.ts` — audit logging helper
- Pattern from `src/app/api/verisum-admin/organisations/[orgId]/route.ts` (PATCH for suspend/reinstate)

### A3 — VCC UI Button

**File:** `src/app/verisum-admin/organisations/[orgId]/page.tsx`

- Add "Change Plan" button in the profile info section, next to the plan badge
- Only visible when admin has `change_plans` permission
- Opens ConfirmDialog with:
  - Plan selector (dropdown: explorer / pro / enterprise)
  - Reason text field (required)
  - Confirm/Cancel buttons
- On confirm, calls `PATCH /api/verisum-admin/organisations/{orgId}/plan`
- Refreshes page data on success

---

## Workstream B: Full Brand Refresh

### Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Brand color | Keep `#3496da` | Per Verisum Unified Design System v2.0 |
| Font | Switch to Inter (400, 500, 600, 700) | Unified design system body font |
| Logo | Verisum shield, blue-tinted for TrustGraph | Blue filter applied via CSS |
| Strategy | Token-first, then component sweep | Cascading benefits, lower risk |

### B1 — Foundation: Font Change

**File:** `src/app/layout.tsx`

- Remove: `Geist`, `Geist_Mono` imports
- Add: `Inter` from `next/font/google` with weights 400, 500, 600, 700
- Update CSS variable: `--font-geist-sans` → `--font-inter`
- Keep a mono font (can use `JetBrains_Mono` or system monospace)

### B2 — Foundation: globals.css Token Alignment

**File:** `src/app/globals.css`

Align tokens to Verisum Unified Design System v2.0 (`/Users/robfanshawe/verisum.org/css/globals.css`):

**Tokens to update:**
- `--border: rgba(0, 0, 0, 0.08)` (from 0.1)
- `--muted: #F3F4F6` (from #ececf0)
- `--muted-foreground: #6B7280` (from #717182)
- `--secondary: #f0eef5` (from oklch value)

**Tokens to add:**
- `--brand-light: #e8f4fc`
- `--brand-subtle: rgba(52, 150, 218, 0.08)`
- `--border-strong: rgba(0, 0, 0, 0.12)`
- `--teal: #0d9488` + hover/light/subtle
- `--coral: #e8614d` + hover/light/subtle
- Shadow tokens: `--shadow-sm`, `--shadow-md`, `--shadow-lg`, `--shadow-xl`, `--shadow-brand`
- Transition tokens: `--transition-fast`, `--transition-base`, `--transition-slow`

**Status tokens to align:**
- `--success: #00C851` (from #2e8b57)
- `--warning: #FF8C00` (from #ffd700)

**Dark mode:** Update corresponding dark mode values to match the unified system.

### B3 — Foundation: Logo Asset

- Copy `/Users/robfanshawe/verisum.org/images/logos/verisum-icon.png` to `/public/verisum-icon.png`
- Copy `verisum-icon-white.png` to `/public/verisum-icon-white.png`
- In components, apply CSS filter: `filter: hue-rotate(-30deg) saturate(0.8)` to approximate blue tint
- Future: Create proper blue SVG asset

### B4 — Shell: AppShell (Public Header/Footer)

**File:** `src/components/AppShell.tsx`

**Header:**
- Sticky, `backdrop-filter: blur(20px) saturate(180%)`, height 64px
- `bg-white/80` → `bg-white/95` on scroll (with border-bottom)
- Logo: Shield icon (28px) + "TrustGraph" text (bold, brand color)
- Nav links: 14px, font-medium, rounded-md hover with `bg-brand-subtle`
- CTA button: gradient primary button

**Footer:**
- Background: `linear-gradient(180deg, #0a2540 0%, #061b2e 100%)` (dark blue-navy, not purple)
- White text, 4-column grid (brand + 3 link columns)
- Footer links: `text-white/50 hover:text-white`
- Bottom bar: copyright + subtle top border

### B5 — Shell: AuthenticatedShell (Dashboard)

**File:** `src/components/AuthenticatedShell.tsx`

- Top nav: glass morphism header matching AppShell pattern
- Logo: Shield icon + "TrustGraph" in sidebar header
- Sidebar active state: `bg-brand/10 text-brand font-medium` (already close)
- Sidebar items: `hover:bg-muted rounded-lg` transition
- Keep collapsible behavior

### B6 — Shell: VCCShell (Admin)

**File:** `src/components/vcc/VCCShell.tsx`

- Keep dark theme identity
- Align token usage to unified system dark mode tokens
- Update accent from `amber-400` to `brand` blue for consistency

### B7 — Component Patterns: Buttons

All files with buttons. Pattern:

```
Primary:     bg-gradient-to-br from-brand to-brand-hover text-white shadow-sm
             hover:-translate-y-0.5 hover:shadow-md transition-all
Secondary:   border-1.5 border-brand text-brand bg-transparent
             hover:bg-brand-subtle transition-all
Ghost:       text-muted-foreground hover:bg-muted transition-all
Destructive: bg-gradient-to-br from-destructive to-[#b8132f] text-white
             hover:-translate-y-0.5 hover:shadow-md transition-all
```

### B8 — Component Patterns: Cards

```
Base:    rounded-xl border-border bg-card p-6
         hover:shadow-md hover:-translate-y-0.5 transition-all
Accent:  + border-t-3 border-t-brand (or tier color)
Static:  No hover effects (for dashboard metric cards, info displays)
```

### B9 — Component Patterns: Form Inputs

```
Input:   bg-input-background border-transparent rounded-lg px-4 py-2.5
         focus:ring-2 focus:ring-brand/30 focus:border-brand transition-all
Error:   focus:ring-destructive/30 focus:border-destructive
```

### B10 — Component Patterns: Tables

```
Header:  bg-muted text-muted-foreground font-medium text-sm
Row:     hover:bg-muted/50 transition-colors
Border:  border-border (rgba 0.08)
```

### B11 — Mechanical Color Migration (~40 files)

Replace legacy `verisum-*` classes with semantic tokens:

| Old class | New class |
|-----------|-----------|
| `bg-verisum-blue` | `bg-brand` (or gradient for buttons) |
| `text-verisum-blue` | `text-brand` |
| `border-verisum-grey` | `border-border` |
| `text-verisum-grey` | `text-muted-foreground` |
| `bg-verisum-white` | `bg-background` or `bg-card` |
| `text-verisum-black` | `text-foreground` |
| `bg-verisum-red` / `text-verisum-red` | `bg-destructive` / `text-destructive` |
| `bg-verisum-green` / `text-verisum-green` | `bg-success` / `text-success` |
| `bg-verisum-yellow` / `text-verisum-yellow` | `bg-warning` / `text-warning` |
| `hover:bg-[#2a7bb8]` | `hover:bg-brand-hover` |
| `focus:ring-verisum-blue` | `focus:ring-brand` |

After migration, remove the `verisum-*` alias mappings from globals.css.

---

## Files Affected

### Workstream A (3 files):
1. `src/app/api/verisum-admin/organisations/[orgId]/plan/route.ts` — NEW
2. `src/app/verisum-admin/organisations/[orgId]/page.tsx` — Add plan change UI
3. Supabase SQL editor — manual `UPDATE` query

### Workstream B (~42 files):
1. `src/app/layout.tsx` — Font change
2. `src/app/globals.css` — Token alignment
3. `public/verisum-icon.png` — NEW (copy from verisum.org)
4. `public/verisum-icon-white.png` — NEW (copy)
5. `src/components/AppShell.tsx` — Full header/footer redesign
6. `src/components/AuthenticatedShell.tsx` — Glass nav, sidebar
7. `src/components/vcc/VCCShell.tsx` — Accent update
8. `src/components/AccessGate.tsx` — Color migration
9. `src/components/RequireAuth.tsx` — Spinner update
10. `src/components/SurveyForm.tsx` — Card/button/input patterns
11. `src/components/TierBadge.tsx` — Minor tweaks
12. `src/components/ExecutiveSummary.tsx` — Card patterns
13. `src/components/MethodologyOverlay.tsx` — Modal styling
14. `src/components/OnboardingForm.tsx` — Form patterns
15. `src/components/vcc/MetricCard.tsx` — Card accent
16. `src/components/vcc/ConfirmDialog.tsx` — Dialog styling
17-42. All page files in `src/app/` with visual UI

---

## Verification

1. `npx next build` — clean compilation
2. Visual check: Every page in the app should use the new design tokens
3. No `verisum-*` color classes remaining in any component (grep check)
4. VCC plan change: Change a test account's plan → verify audit log entry created
5. Login flow: Magic link → auth → dashboard — no visual regressions
6. Survey flow: Create → share → respond → results — all styled consistently
7. Mobile responsive: Check all shells at 375px, 768px, 1024px widths
