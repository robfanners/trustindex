# Phase 5: Rebrand to Verisum — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace all user-visible "TrustGraph" references with "Verisum" across the product — UI text, metadata, email templates, export filenames, and TypeScript types.

**Architecture:** This is a systematic find-and-replace across the codebase. Database objects (`trustgraph_health_mv`, `tg_*` functions) and API route paths (`/api/trustgraph/`) stay unchanged — they're internal and renaming them risks breaking things for zero user benefit. The metric "TrustGraph Health" becomes "Trust Health". Executive summary headlines like "TrustGraph is strong" become "Trust posture is strong". The TypeScript type `TrustGraphRole` is replaced by the existing `VersiumRole` from `roles.ts`.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind CSS

**Scope exclusions (do NOT change):**
- Database table/view names (`trustgraph_health_mv`)
- PostgreSQL function names (`tg_compute_health`, `tg_check_and_expire`, etc.)
- API route paths (`/api/trustgraph/*`)
- SQL migration files (historical records)
- Planning docs in `docs/plans/` (historical)

---

## Task 1: Core Branding — Metadata, Shells, Homepage

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/components/AppShell.tsx`
- Modify: `src/components/AuthenticatedShell.tsx`
- Modify: `src/app/_homeClientImpl.tsx`

**Changes:**

**layout.tsx** — Update page metadata:
```typescript
export const metadata: Metadata = {
  title: "Verisum",
  description: "AI governance you can measure, monitor, and prove",
};
```

**AppShell.tsx** — Update logo alt text and brand name (around lines 64-72):
```tsx
<Image
  src="/verisum-icon.png"
  alt="Verisum"
  width={28}
  height={28}
  className="rounded-sm"
  style={{  }}
/>
<span className="text-base font-bold text-brand">
  Verisum
</span>
```

**AuthenticatedShell.tsx** — Same pattern (around lines 209-219):
```tsx
<Image
  src="/verisum-icon.png"
  alt="Verisum"
  width={24}
  height={24}
  className="rounded-sm"
  style={{  }}
/>
<span className="text-base font-bold text-brand">
  Verisum
</span>
```

**_homeClientImpl.tsx** — Replace all TrustGraph references:
- Line 9: `TrustGraph&trade;` → `Verisum`
- Line 13: `TrustGraph&trade; helps organisations quantify how trust...` → `Verisum helps organisations quantify how trust...`
- Line 22: `TrustGraph measures five dimensions...` → `Verisum measures five dimensions...`

Commit: `git add src/app/layout.tsx src/components/AppShell.tsx src/components/AuthenticatedShell.tsx src/app/_homeClientImpl.tsx && git commit -m "feat: rebrand core UI — TrustGraph → Verisum in metadata, shells, homepage"`

---

## Task 2: Dashboard and Reports — "TrustGraph Health" → "Trust Health"

**Files:**
- Modify: `src/app/dashboard/page.tsx`
- Modify: `src/app/reports/page.tsx`
- Modify: `src/lib/emailTemplates.ts`

**Changes:**

**dashboard/page.tsx:**
- Find `title="TrustGraph Health"` → change to `title="Trust Health"`

**reports/page.tsx:**
- Find `"TrustGraph Health": "Composite relational score..."` → change key to `"Trust Health"`
- Find `<StatCard label="TrustGraph Health"` → change to `label="Trust Health"`

**emailTemplates.ts** (around line 111):
- Find `TrustGraph Health` in the monthly report HTML table → change to `Trust Health`

Commit: `git add src/app/dashboard/page.tsx src/app/reports/page.tsx src/lib/emailTemplates.ts && git commit -m "feat: rebrand TrustGraph Health → Trust Health in dashboard, reports, emails"`

---

## Task 3: Executive Summary Headlines

**Files:**
- Modify: `src/lib/executiveSummary.ts`

**Changes:**

Update the comment on line 1:
```typescript
// Executive Summary Logic Engine for Verisum.
```

Rename the type on line 17:
```typescript
export type TrustPostureInputs = {
```

Update all usages of `TrustGraphInputs` in this file to `TrustPostureInputs`.

Update headline strings (around lines 278-288):
```typescript
case "trusted":
  headline = `Trust posture is strong and resilient — your main advantage is ${strongLabel}, with attention needed on ${weakLabel}.`;
  break;
case "stable":
  headline = `Trust posture is broadly stable — performance is supported by ${strongLabel}, but ${weakLabel} is the main constraint.`;
  break;
case "elevated_risk":
  headline = `Trust posture is under strain — ${weakLabel} is pulling overall trust down and will limit performance unless addressed.`;
  break;
case "critical":
  headline = `Trust posture is fragile — multiple trust drivers are failing, with ${weakLabel} the most urgent exposure.`;
  break;
```

Then search for any files importing `TrustGraphInputs` and update those imports too.

Commit: `git add src/lib/executiveSummary.ts && git commit -m "feat: rebrand executive summary — TrustGraph → Trust posture"`

---

## Task 4: Export Filenames

**Files:**
- Modify: `src/app/admin/run/[runId]/page.tsx`
- Modify: `src/app/dashboard/[runId]/page.tsx`
- Modify: `src/app/dashboard/surveys/[runId]/results/page.tsx`
- Modify: `src/app/dashboard/surveys/[runId]/page.tsx`
- Modify: `src/app/reports/page.tsx`
- Modify: `src/app/dashboard/settings/data/page.tsx`
- Modify: `src/app/api/settings/export/surveys/route.ts`
- Modify: `src/app/api/settings/export/systems/route.ts`

**Changes:** In each file, replace `trustgraph` in download filenames with `verisum`:

- `trustgraph-links-${runId}.txt` → `verisum-links-${runId}.txt`
- `trustgraph_${runId}_responses.csv` → `verisum_${runId}_responses.csv`
- `trustgraph_${runId}_summary` → `verisum_${runId}_summary`
- `trustgraph-audit-${dateFrom}-to-${dateTo}.pdf` → `verisum-audit-${dateFrom}-to-${dateTo}.pdf`
- `trustgraph_${type}_export_${...}` → `verisum_${type}_export_${...}`
- `trustgraph_surveys_export.csv` → `verisum_surveys_export.csv`
- `trustgraph_systems_export.csv` → `verisum_systems_export.csv`

Commit: `git add src/app/admin/ src/app/dashboard/ src/app/reports/ src/app/api/settings/export/ && git commit -m "feat: rebrand export filenames — trustgraph → verisum"`

---

## Task 5: TypeScript Types — TrustGraphRole → VersiumRole

**Files:**
- Modify: `src/lib/reportAuth.ts`
- Modify: `src/lib/reportAuth.server.ts`
- Modify: `src/app/api/reports/action-analytics/route.ts`
- Modify: `src/app/api/reports/assessment-history/route.ts`

**Changes:**

**reportAuth.ts:**
- Remove `export type TrustGraphRole = ...` definition
- Add `import type { VersiumRole } from "@/lib/roles";`
- Replace all `TrustGraphRole` usages with `VersiumRole`:
  - `Record<ReportType, TrustGraphRole[]>` → `Record<ReportType, VersiumRole[]>`
  - `role as TrustGraphRole` → `role as VersiumRole`
  - Function signatures: `TrustGraphRole | string | null` → `VersiumRole | string | null`
- Update the comment on line 2: `// Verisum role types & report permission matrix`

**reportAuth.server.ts:**
- Change `import type { TrustGraphRole } from "@/lib/reportAuth"` → `import type { VersiumRole } from "@/lib/roles"`
- Change `role: (profile.role as TrustGraphRole) ?? null` → `role: (profile.role as VersiumRole) ?? null`

**action-analytics/route.ts:**
- Change `import type { TrustGraphRole } from "@/lib/reportAuth"` → `import type { VersiumRole } from "@/lib/roles"`
- Change `role as TrustGraphRole` → `role as VersiumRole`

**assessment-history/route.ts:**
- Same pattern as action-analytics.

Commit: `git add src/lib/reportAuth.ts src/lib/reportAuth.server.ts src/app/api/reports/ && git commit -m "feat: replace TrustGraphRole with VersiumRole from roles.ts"`

---

## Task 6: Settings, Admin, and Misc Pages

**Files:**
- Modify: `src/app/dashboard/settings/integrations/page.tsx`
- Modify: `src/app/admin/new-run/page.tsx`
- Modify: `src/lib/roles.ts`

**Changes:**

**integrations/page.tsx:**
- Find `Connect TrustGraph with your existing tools and workflows.` → change to `Connect Verisum with your existing tools and workflows.`

**admin/new-run/page.tsx:**
- Find `encodeURIComponent('TrustGraph links – ${runTitle}')` → change to `encodeURIComponent('Verisum links – ${runTitle}')`

**roles.ts:**
- Update comment on line 6: `Extends the original TrustGraphRole set` → `Extends the original role set`

Commit: `git add src/app/dashboard/settings/integrations/page.tsx src/app/admin/new-run/page.tsx src/lib/roles.ts && git commit -m "feat: rebrand remaining TrustGraph references in settings and admin"`

---

## Task 7: Config and Documentation

**Files:**
- Modify: `src/.env.example`
- Modify: `CLAUDE.md`

**Changes:**

**.env.example** line 1:
```
# Verisum — Environment Variables
```

**CLAUDE.md:**
- Line 1: `# TrustGraph by Verisum — CLAUDE.md` → `# Verisum — CLAUDE.md`
- Any other `TrustGraph` references in CLAUDE.md should be updated to `Verisum`

Commit: `git add src/.env.example CLAUDE.md && git commit -m "docs: update config and CLAUDE.md — TrustGraph → Verisum"`

---

## Task 8: Build Verification

Run `npx tsc --noEmit` and `npm run build` to verify everything compiles.

Fix any type errors from the `TrustGraphInputs` → `TrustPostureInputs` rename (check for external importers).

Commit any fixes if needed.

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Core branding (metadata, shells, homepage) | 4 files |
| 2 | Dashboard/reports — "Trust Health" | 3 files |
| 3 | Executive summary headlines | 1 file |
| 4 | Export filenames | 8 files |
| 5 | TypeScript types — TrustGraphRole → VersiumRole | 4 files |
| 6 | Settings, admin, misc pages | 3 files |
| 7 | Config and documentation | 2 files |
| 8 | Build verification | — |
