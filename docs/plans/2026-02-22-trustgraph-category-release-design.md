# TrustGraph Category Release — Design Document

**Date:** 2026-02-22
**Status:** Approved
**Scope:** MVP-14 — Transition TrustIndex to TrustGraph platform identity

---

## 1. Brand Renaming

### Customer-Facing Brand Identity

| Element | Before | After |
|---------|--------|-------|
| **Header** | `Verisum \| TrustIndex™` | `TrustGraph™` (standalone) |
| **Page title (metadata)** | `TrustIndex™ by Verisum` | `TrustGraph™ by Verisum` |
| **Footer** | `© 2026 Verisum • TrustIndex™` | `© 2026 Verisum • TrustGraph™` |
| **Dashboard subtitle** | `Your TrustIndex dashboard` | `Your TrustGraph dashboard` |
| **Dashboard tabs** | `Organisation` / `Systems` | `TrustOrg` / `TrustSys` |
| **Survey title** | `TrustIndex Survey` | `TrustOrg Survey` |
| **Explorer title** | `TrustIndex™ Explorer` | `TrustGraph Explorer` |
| **Score label** | `TrustIndex score` | `TrustGraph Score™` |
| **Results page** | `Your TrustIndex™ Results` | `Your TrustGraph™ Results` |
| **Login page** | `New to TrustIndex?` | `New to TrustGraph?` |

### Preserved Branding

- **VCC admin console:** Keeps `Verisum | Control Console` unchanged
- **Footer links:** Privacy and Terms still point to `verisum.org`
- **CSS aliases:** `verisum-*` backward-compat aliases remain (mapped to semantic tokens)
- **CSS comment:** Updated from "HAPP base + TrustIndex extensions" to "TrustGraph design tokens"
- **Package name:** `trustindex` in `package.json` stays unchanged (internal only)

### Files Requiring Brand Text Changes

1. `src/app/layout.tsx` — metadata title/description
2. `src/app/_homeClientImpl.tsx` — homepage copy
3. `src/components/AppShell.tsx` — header + footer branding
4. `src/components/AuthenticatedShell.tsx` — header + footer branding
5. `src/app/dashboard/page.tsx` — dashboard subtitle
6. `src/app/survey/[token]/page.tsx` — survey title
7. `src/app/try/page.tsx` — explorer title, score labels, DB field display
8. `src/app/auth/login/page.tsx` — signup prompt
9. `src/app/dashboard/surveys/new/page.tsx` — survey creation copy
10. `src/app/dashboard/surveys/[runId]/page.tsx` — survey detail copy
11. `src/app/dashboard/surveys/[runId]/results/page.tsx` — results copy
12. `src/app/upgrade/page.tsx` — enterprise enquiry mailto subject
13. `src/app/globals.css` — design token comment
14. `src/app/api/settings/export/systems/route.ts` — CSV filenames
15. `src/app/api/settings/export/surveys/route.ts` — CSV filenames
16. `src/app/verisum-admin/page.tsx` — VCC dashboard description (TrustIndex platform → TrustGraph platform)

---

## 2. Tier Framework

**File:** `src/lib/trustGraphTiers.ts`

### Tier Bands

| Tier | Score Range | Colour | Badge |
|------|------------|--------|-------|
| Trusted | 80–100 | Green (`#16a34a`) | `Trusted` |
| Stable | 65–79 | Blue (`#2563eb`) | `Stable` |
| Elevated Risk | 50–64 | Amber (`#d97706`) | `Elevated Risk` |
| Critical | 0–49 | Red (`#dc2626`) | `Critical` |

### Functions

- `getTier(score: number): TierKey` — returns tier classification
- `getTierConfig(tier: TierKey): { label, color, bgColor }` — returns display config

### UI Component

**File:** `src/components/TierBadge.tsx`

Renders a coloured pill badge with the tier label. Displayed:
- Next to score on dashboard
- On results pages
- In executive summary header

---

## 3. Executive Summary Logic Engine

**File:** `src/lib/executiveSummary.ts` (pure functions, no React, no LLM calls)

### Types

```typescript
export type DimensionKey =
  | "transparency"
  | "inclusion"
  | "confidence"
  | "explainability"
  | "risk";

export type TrustGraphInputs = {
  module: "org" | "sys";
  score: number;
  responseCount: number;
  minResponseThreshold: number;
  dimensions: Record<DimensionKey, number>;
  previousScore?: number;
  previousDimensions?: Partial<Record<DimensionKey, number>>;
  lastUpdatedISO?: string;
};

export type ExecSummaryOutput = {
  status: "insufficient_data" | "provisional" | "stable";
  tier: "trusted" | "stable" | "elevated_risk" | "critical";
  headline: string;
  posture: string;
  primaryDrivers: Array<{
    key: DimensionKey;
    label: string;
    score: number;
    severity: "strength" | "watch" | "weak";
    why: string;
  }>;
  priorities: Array<{
    title: string;
    rationale: string;
    probes: string[];
  }>;
  confidenceNote: string;
  trendNote?: string;
};
```

### Logic Rules

**A) Data sufficiency:**
- `responseCount < minResponseThreshold` → `insufficient_data`
- `responseCount < minResponseThreshold * 2` → `provisional`
- else → `stable`

**B) Tier bands:** Same as section 2 above.

**C) Severity per dimension:**
- `>= 75` → `strength`
- `60–74` → `watch`
- `< 60` → `weak`

**D) Primary drivers:** Select 3 — up to 2 weakest (weak/watch), 1 strongest (>= 75 or least-bad watch). Order: weakest first.

**E) Headline:** Templated by tier + drivers. Prefixed with "Early signal: " if insufficient_data.

**F) Governance posture:** Based on risk + explainability scores. Different copy for org vs sys modules.

**G) Priorities:** 2 items based on weakest dimensions. Each has predefined title, rationale, and 3 probe questions.

**H) Confidence note:** Templated by status + response count.

**I) Trend note:** If previousScore exists, compute delta. Mention which dimension moved most.

### Deterministic Helpers

- `getTier(score)`
- `getStatus(responseCount, minThreshold)`
- `getSeverity(dimScore)`
- `pickDrivers(dimEntries)`
- `priorityPackFor(dimensionKey)`
- `makeHeadline({ tier, status, drivers })`
- `makePosture(module, dims)`
- `makeConfidenceNote(status, responseCount, minThreshold)`
- `makeTrendNote(input)`

---

## 4. Executive Summary UI Component

**File:** `src/components/ExecutiveSummary.tsx`

Renders the `ExecSummaryOutput` on results pages:
- Tier badge
- Headline as H2
- Posture as paragraph
- 3 driver rows (label + score + severity chip + why text)
- 2 priority cards with probe questions
- Confidence note (muted text)
- Trend note (if present, beneath confidence)

---

## 5. Methodology Overlay

**File:** `src/components/MethodologyOverlay.tsx`

Info icon on dashboard score card opens a modal showing:
- Weighting per dimension (equal 20% each for TrustOrg)
- Dimension descriptions
- Evidence scoring: "Likert 1-5 mapped to 0-100"
- Methodology version: "TrustGraph v1.0"
- Last updated date

Data is static/hardcoded for v1.0 — no DB dependency.

---

## 6. Score Snapshot Versioning

### Logic

When `status === "stable"` (responseCount >= minResponseThreshold * 2):
- Save current score + methodology version as a snapshot
- Display "Snapshot v1.0" label on results

### Storage

Use existing `survey_runs` table — add optional `snapshot_version` text field (or store in metadata JSON column if available). No new table needed for MVP.

### Display

Badge on results page: "Snapshot v1.0" (muted, next to score)

---

## 7. Visual Elevation

### Updated Design Tokens (globals.css)

- Increased whitespace: card padding `p-6` → `p-8`, section gaps `space-y-6` → `space-y-8`
- Reduced border density: lighter borders, remove unnecessary dividers
- Larger headings: H1 bump to `text-4xl`
- Softer cards: `rounded-xl shadow-sm` instead of `rounded-lg border`
- Comment updated to "TrustGraph design tokens"

### Applied To

- Dashboard page
- Results pages
- Survey pages
- Homepage

---

## 8. Systems Tab for Explorer

On the dashboard, the `TrustSys` tab:
- Shows as **greyed/disabled** for Explorer plan users
- Tooltip: "Available on Org plan and above"
- Already partially implemented (tab exists, `systemsDisabled` logic exists)
- Update label from "Systems" to "TrustSys"

---

## MVP-14 Deliverables Checklist

1. Brand token system installed (CSS comment + any new tokens)
2. UI renamed and unified (TrustIndex → TrustGraph/TrustOrg/TrustSys everywhere)
3. Tier system implemented (`trustGraphTiers.ts` + `TierBadge.tsx`)
4. Methodology overlay live (`MethodologyOverlay.tsx`)
5. Executive summary block live (`executiveSummary.ts` + `ExecutiveSummary.tsx`)
6. Settings module live (already exists — verify)
7. Greyed TrustSys tab for Explorer (update label + verify disabled state)
8. Score snapshot logic (version label on results)
