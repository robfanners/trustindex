# Phase 3: Role-Based UI Behaviour Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement role-specific navigation visibility so different team roles see only the sidebar sections relevant to them, layered on top of the existing tier-gating system.

**Architecture:** A `roles.ts` module defines the mapping of each role to which navigation sections it can see. The `navigation.ts` types gain a `visibleTo` field per section. The sidebar and module switcher apply role filtering before tier filtering — if a role can't see a section, it's hidden entirely (not shown locked). Tier gating still applies to visible sections. Role is read from `profile.role` (already in AuthContext). New roles (board_viewer, signatory, auditor) are added as valid options.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind CSS, inline SVGs

---

## Task 1: Create Role Definitions

**Files:**
- Create: `src/lib/roles.ts`

This file defines all valid Verisum roles, their labels/descriptions, and which navigation section IDs each role can access. It complements `navigation.ts` (nav structure), `tiers.ts` (tier gating), and `entitlements.ts` (plan limits).

Role-to-section mapping from the design doc:

| Role | Visible Sections |
|------|-----------------|
| owner | All |
| admin | All |
| risk | overview, govern, monitor, report, settings |
| operator | overview, govern, report |
| exec | overview, govern, monitor, report |
| board_viewer | overview, report, prove |
| signatory | overview, prove |
| auditor | All (read-only) |

```typescript
// src/lib/roles.ts

/**
 * Verisum role definitions and role-to-navigation mapping.
 *
 * Extends the original TrustGraphRole set with three new roles:
 * board_viewer, signatory, auditor. Each role maps to a set of
 * visible nav section IDs (from navigation.ts).
 */

export type VersiumRole =
  | "owner"
  | "admin"
  | "risk"
  | "operator"
  | "exec"
  | "board_viewer"
  | "signatory"
  | "auditor";

export type RoleInfo = {
  label: string;
  description: string;
  /** Nav section IDs this role can see (from navSections in navigation.ts) */
  visibleSections: string[];
  /** If true, the user can view but not create/edit/delete */
  readOnly: boolean;
};

const ALL_SECTIONS = ["overview", "govern", "monitor", "prove", "report", "settings"];

export const ROLES: Record<VersiumRole, RoleInfo> = {
  owner: {
    label: "Owner",
    description: "Full access to all settings and data",
    visibleSections: ALL_SECTIONS,
    readOnly: false,
  },
  admin: {
    label: "Admin",
    description: "Full access to all features and settings",
    visibleSections: ALL_SECTIONS,
    readOnly: false,
  },
  risk: {
    label: "Risk Officer",
    description: "Governance, monitoring, and reporting",
    visibleSections: ["overview", "govern", "monitor", "report", "settings"],
    readOnly: false,
  },
  operator: {
    label: "Engineer / Assessor",
    description: "Assessments, actions, and reporting",
    visibleSections: ["overview", "govern", "report"],
    readOnly: false,
  },
  exec: {
    label: "Executive",
    description: "Governance, monitoring, and reporting",
    visibleSections: ["overview", "govern", "monitor", "report"],
    readOnly: false,
  },
  board_viewer: {
    label: "Board Viewer",
    description: "Overview, reports, and proof verification (read-only)",
    visibleSections: ["overview", "report", "prove"],
    readOnly: true,
  },
  signatory: {
    label: "Signatory",
    description: "Approval inbox and proof verification only",
    visibleSections: ["overview", "prove"],
    readOnly: false,
  },
  auditor: {
    label: "Auditor",
    description: "Full visibility across all sections (read-only)",
    visibleSections: ALL_SECTIONS,
    readOnly: true,
  },
};

/** Get the role info for a given role string. Defaults to "operator" for unknown roles. */
export function getRoleInfo(role: string | null | undefined): RoleInfo {
  const r = (role ?? "owner") as VersiumRole;
  return ROLES[r] ?? ROLES.operator;
}

/** Check if a role can see a given nav section ID */
export function canSeeSection(role: string | null | undefined, sectionId: string): boolean {
  return getRoleInfo(role).visibleSections.includes(sectionId);
}

/** Get ordered list of role options for dropdowns */
export function getRoleOptions(): { value: VersiumRole; label: string; description: string }[] {
  return (Object.entries(ROLES) as [VersiumRole, RoleInfo][]).map(([value, info]) => ({
    value,
    label: info.label,
    description: info.description,
  }));
}
```

Commit: `git add src/lib/roles.ts && git commit -m "feat: add Verisum role definitions and role-to-section mapping"`

---

## Task 2: Update AuthenticatedShell to Filter by Role

**Files:**
- Modify: `src/components/AuthenticatedShell.tsx`

Add role-based section filtering to the sidebar. Sections not visible to the user's role are hidden entirely (not shown locked). This runs before the existing tier-gating display logic.

Changes needed:

1. **Add import** (after the existing UpgradeModal import):
```typescript
import { canSeeSection } from "@/lib/roles";
```

2. **Filter navSections by role** — change the `navSections.map` in the nav to filter first:
```typescript
// Replace:
{navSections.map((section) => {

// With:
{navSections.filter((section) => canSeeSection(profile?.role, section.id)).map((section) => {
```

That's the only change needed. The existing tier-gating logic continues to handle locked sections within the visible set.

Commit: `git add src/components/AuthenticatedShell.tsx && git commit -m "feat: filter sidebar sections by user role"`

---

## Task 3: Update ModuleSwitcher to Filter by Role

**Files:**
- Modify: `src/components/header/ModuleSwitcher.tsx`

Add the same role-based filtering to the module switcher dropdown.

Changes needed:

1. **Add import:**
```typescript
import { canSeeSection } from "@/lib/roles";
```

2. **Add role filter** to the navSections processing. In the existing code that filters sections, add a role filter before the tier filter:
```typescript
// The current code likely does:
const accessibleItems = navSections
  .filter((s) => meetsMinTier(profile?.plan, s.minTier))
  .flatMap((s) => s.items)
  ...

// Change to:
const accessibleItems = navSections
  .filter((s) => canSeeSection(profile?.role, s.id))
  .filter((s) => meetsMinTier(profile?.plan, s.minTier))
  .flatMap((s) => s.items)
  ...
```

Commit: `git add src/components/header/ModuleSwitcher.tsx && git commit -m "feat: filter module switcher by user role"`

---

## Task 4: Update Settings Role Dropdown

**Files:**
- Modify: `src/app/dashboard/settings/page.tsx`

Replace the hardcoded `ROLE_OPTIONS` array with the canonical list from `roles.ts`.

Changes needed:

1. **Add import:**
```typescript
import { getRoleOptions } from "@/lib/roles";
```

2. **Remove the hardcoded ROLE_OPTIONS constant** (lines 23-29):
```typescript
// DELETE:
const ROLE_OPTIONS = [
  { value: "owner", label: "Owner" },
  { value: "admin", label: "Admin" },
  { value: "exec", label: "Executive" },
  { value: "operator", label: "Operator" },
  { value: "risk", label: "Risk" },
];
```

3. **Use getRoleOptions() in the select element** — change the role select dropdown from:
```tsx
{ROLE_OPTIONS.map((opt) => (
  <option key={opt.value} value={opt.value}>{opt.label}</option>
))}
```
to:
```tsx
{getRoleOptions().map((opt) => (
  <option key={opt.value} value={opt.value}>{opt.label}</option>
))}
```

Commit: `git add src/app/dashboard/settings/page.tsx && git commit -m "feat: use canonical role options from roles.ts in settings"`

---

## Task 5: Update Team Settings Role Descriptions

**Files:**
- Modify: `src/app/dashboard/settings/team/page.tsx`

Replace the hardcoded role descriptions with the full set from `roles.ts`.

Changes needed:

1. **Add import:**
```typescript
import { getRoleOptions } from "@/lib/roles";
```

2. **Replace the hardcoded Roles section** — change the roles info block from:
```tsx
<div className="text-sm text-muted-foreground space-y-2">
  <div className="flex items-center gap-2">
    <span className="font-medium text-foreground">Owner</span>
    <span>— Full access to all settings and data</span>
  </div>
  <div className="flex items-center gap-2">
    <span className="font-medium text-foreground">Admin</span>
    <span>— Can manage surveys and systems</span>
  </div>
  <div className="flex items-center gap-2">
    <span className="font-medium text-foreground">Viewer</span>
    <span className="italic">— Coming soon</span>
  </div>
</div>
```
to:
```tsx
<div className="text-sm text-muted-foreground space-y-2">
  {getRoleOptions().map((opt) => (
    <div key={opt.value} className="flex items-center gap-2">
      <span className="font-medium text-foreground">{opt.label}</span>
      <span>— {opt.description}</span>
    </div>
  ))}
</div>
```

Commit: `git add src/app/dashboard/settings/team/page.tsx && git commit -m "feat: display all Verisum roles in team settings"`

---

## Task 6: Build Verification

Run `npm run build` and `npx tsc --noEmit` to verify everything compiles.

Commit any fixes if needed.

---

## Summary

| Task | Description | New/Modified Files |
|------|-------------|-------------------|
| 1 | Role definitions | Create `src/lib/roles.ts` |
| 2 | Sidebar role filtering | Modify `AuthenticatedShell.tsx` |
| 3 | Module switcher role filtering | Modify `ModuleSwitcher.tsx` |
| 4 | Settings role dropdown | Modify `settings/page.tsx` |
| 5 | Team settings roles | Modify `settings/team/page.tsx` |
| 6 | Build verification | — |
