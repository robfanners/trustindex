# TrustGraph Category Release — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transition the TrustIndex product to TrustGraph platform identity with tier system, executive summary engine, methodology overlay, and visual elevation.

**Architecture:** Pure-function logic engine (`executiveSummary.ts`, `trustGraphTiers.ts`) with React UI components. All brand text changes are string replacements across ~16 files. No DB schema changes for MVP (snapshot version stored in existing structures). VCC admin console keeps Verisum branding.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS v4, Supabase, Recharts

---

## Task 1: Update CSS Design Tokens + Brand Comment

**Files:**
- Modify: `src/app/globals.css:9-11` (comment), `src/app/globals.css:39` (comment)

**Step 1: Update the HAPP/TrustIndex comment to TrustGraph**

In `src/app/globals.css`, change line 10:
```
/* Design tokens — light mode (HAPP base + TrustIndex extensions) */
```
to:
```
/* Design tokens — light mode (TrustGraph design system) */
```

And change line 39:
```
/* Brand — TrustIndex CTA / action blue */
```
to:
```
/* Brand — TrustGraph CTA / action blue */
```

**Step 2: Add tier colour tokens to :root**

In `src/app/globals.css`, after the `--warning-foreground` line (line 48), add:
```css
/* Tier colours */
--tier-trusted: #16a34a;
--tier-stable: #2563eb;
--tier-elevated: #d97706;
--tier-critical: #dc2626;
```

**Step 3: Add tier colours to the @theme inline block**

After the `--color-destructive-muted` line (line 184), add:
```css
/* Tier colours */
--color-tier-trusted: var(--tier-trusted);
--color-tier-stable: var(--tier-stable);
--color-tier-elevated: var(--tier-elevated);
--color-tier-critical: var(--tier-critical);
```

**Step 4: Verify build**

Run: `cd /Users/robfanshawe/trustindex && npx next build`
Expected: Build succeeds.

**Step 5: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: update CSS design tokens for TrustGraph brand + add tier colours"
```

---

## Task 2: Create Tier Framework Library

**Files:**
- Create: `src/lib/trustGraphTiers.ts`

**Step 1: Create the tier library**

Create `src/lib/trustGraphTiers.ts`:
```typescript
// Pure tier classification functions for TrustGraph scoring.
// No React, no side-effects.

export type TierKey = "trusted" | "stable" | "elevated_risk" | "critical";

export type TierConfig = {
  key: TierKey;
  label: string;
  colorClass: string;
  bgClass: string;
  hex: string;
};

const TIER_CONFIGS: Record<TierKey, TierConfig> = {
  trusted: {
    key: "trusted",
    label: "Trusted",
    colorClass: "text-tier-trusted",
    bgClass: "bg-tier-trusted/10",
    hex: "#16a34a",
  },
  stable: {
    key: "stable",
    label: "Stable",
    colorClass: "text-tier-stable",
    bgClass: "bg-tier-stable/10",
    hex: "#2563eb",
  },
  elevated_risk: {
    key: "elevated_risk",
    label: "Elevated Risk",
    colorClass: "text-tier-elevated",
    bgClass: "bg-tier-elevated/10",
    hex: "#d97706",
  },
  critical: {
    key: "critical",
    label: "Critical",
    colorClass: "text-tier-critical",
    bgClass: "bg-tier-critical/10",
    hex: "#dc2626",
  },
};

/** Score (0-100) → tier key */
export function getTier(score: number): TierKey {
  if (score >= 80) return "trusted";
  if (score >= 65) return "stable";
  if (score >= 50) return "elevated_risk";
  return "critical";
}

/** Get display config for a tier */
export function getTierConfig(tier: TierKey): TierConfig {
  return TIER_CONFIGS[tier];
}

/** Convenience: score → full config */
export function getTierForScore(score: number): TierConfig {
  return TIER_CONFIGS[getTier(score)];
}
```

**Step 2: Verify build**

Run: `cd /Users/robfanshawe/trustindex && npx next build`
Expected: Build succeeds (library is tree-shaken if unused, but should compile).

**Step 3: Commit**

```bash
git add src/lib/trustGraphTiers.ts
git commit -m "feat: add TrustGraph tier classification library"
```

---

## Task 3: Create TierBadge Component

**Files:**
- Create: `src/components/TierBadge.tsx`

**Step 1: Create the badge component**

Create `src/components/TierBadge.tsx`:
```tsx
import { getTierForScore, type TierKey, getTierConfig } from "@/lib/trustGraphTiers";

type TierBadgeProps =
  | { score: number; tier?: never }
  | { tier: TierKey; score?: never };

export default function TierBadge(props: TierBadgeProps) {
  const config = "tier" in props && props.tier
    ? getTierConfig(props.tier)
    : getTierForScore(props.score!);

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.colorClass} ${config.bgClass}`}
    >
      {config.label}
    </span>
  );
}
```

**Step 2: Verify build**

Run: `cd /Users/robfanshawe/trustindex && npx next build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add src/components/TierBadge.tsx
git commit -m "feat: add TierBadge component for TrustGraph score display"
```

---

## Task 4: Create Executive Summary Logic Engine

**Files:**
- Create: `src/lib/executiveSummary.ts`

**Step 1: Create the executive summary logic engine**

Create `src/lib/executiveSummary.ts` with the complete deterministic logic:

```typescript
// Executive Summary Logic Engine for TrustGraph.
// Pure functions, no React, no LLM calls. Fully deterministic.

import { getTier, type TierKey } from "./trustGraphTiers";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DimensionKey =
  | "transparency"
  | "inclusion"
  | "confidence"
  | "explainability"
  | "risk";

export type TrustGraphInputs = {
  module: "org" | "sys";
  score: number; // 0-100
  responseCount: number; // integer
  minResponseThreshold: number; // default 5 for org, 1 for sys
  dimensions: Record<DimensionKey, number>; // 0-100 per dimension
  previousScore?: number; // 0-100
  previousDimensions?: Partial<Record<DimensionKey, number>>;
  lastUpdatedISO?: string; // for copy only
};

export type Severity = "strength" | "watch" | "weak";
export type DataStatus = "insufficient_data" | "provisional" | "stable";

export type DriverEntry = {
  key: DimensionKey;
  label: string;
  score: number;
  severity: Severity;
  why: string;
};

export type PriorityEntry = {
  title: string;
  rationale: string;
  probes: string[];
};

export type ExecSummaryOutput = {
  status: DataStatus;
  tier: TierKey;
  headline: string;
  posture: string;
  primaryDrivers: DriverEntry[];
  priorities: PriorityEntry[];
  confidenceNote: string;
  trendNote?: string;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DIMENSION_LABELS: Record<DimensionKey, string> = {
  transparency: "Transparency",
  inclusion: "Inclusion",
  confidence: "Confidence",
  explainability: "Explainability",
  risk: "Risk",
};

const WHY_TEMPLATES: Record<DimensionKey, Record<Severity, string>> = {
  transparency: {
    strength: "Decision context is visible enough for people to execute with confidence.",
    watch: "Decision context is uneven \u2014 some teams act with clarity, others fill gaps with assumptions.",
    weak: "Low visibility into decisions is likely creating friction, rumours, and slower execution.",
  },
  inclusion: {
    strength: "People feel able to contribute and challenge, reducing hidden risk.",
    watch: "Participation is uneven \u2014 some voices dominate and dissent may be filtered.",
    weak: "Low psychological safety likely suppresses challenge and delays surfacing problems.",
  },
  confidence: {
    strength: "Leadership intent and follow-through are credible, supporting pace.",
    watch: "Follow-through is inconsistent, creating pockets of scepticism.",
    weak: "Low confidence in leadership follow-through is likely reducing pace and engagement.",
  },
  explainability: {
    strength: "Understanding of how decisions are made is strong enough to sustain trust.",
    watch: "Some decisions feel opaque, especially where AI or complexity is involved.",
    weak: "Opaque decisions (especially AI-supported) are likely undermining trust and adoption.",
  },
  risk: {
    strength: "Controls and escalation are strong enough to prevent avoidable exposure.",
    watch: "Controls exist but enforcement is inconsistent across teams or workflows.",
    weak: "Risk controls are too weak \u2014 exposure may be rising without visibility or escalation.",
  },
};

const PRIORITY_PACKS: Record<DimensionKey, PriorityEntry> = {
  transparency: {
    title: "Increase decision transparency where it matters",
    rationale: "Low transparency creates rumours, slows decisions, and reduces adoption.",
    probes: [
      "Where do people feel decisions are made without clear reasons?",
      "What information is consistently missing at the point of execution?",
      "Which decisions need a published \u2018why / trade-offs / owner\u2019 note?",
    ],
  },
  inclusion: {
    title: "Raise psychological safety and inclusion signals",
    rationale: "Low inclusion suppresses challenge and hides risk until late.",
    probes: [
      "Where do people avoid speaking up, and why?",
      "Which groups feel least heard in planning and review?",
      "Are dissenting views recorded and addressed or ignored?",
    ],
  },
  confidence: {
    title: "Rebuild confidence in leadership follow-through",
    rationale: "Low confidence reduces pace and increases silent disengagement.",
    probes: [
      "Which promises or priorities feel repeatedly broken?",
      "Where is execution drifting from stated strategy?",
      "Do teams believe feedback leads to change?",
    ],
  },
  explainability: {
    title: "Improve explainability and human understanding",
    rationale: "Low explainability makes AI-driven decisions brittle and hard to trust.",
    probes: [
      "Which outputs feel like black boxes to teams?",
      "Where is the \u2018reason / evidence / confidence\u2019 missing?",
      "Who is accountable when AI output is wrong?",
    ],
  },
  risk: {
    title: "Strengthen governance controls and escalation",
    rationale: "Low risk control increases operational and regulatory exposure.",
    probes: [
      "Where can risky decisions ship without review?",
      "Are escalation paths clear when confidence is low?",
      "Is monitoring continuous or periodic and manual?",
    ],
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getStatus(responseCount: number, minThreshold: number): DataStatus {
  if (responseCount < minThreshold) return "insufficient_data";
  if (responseCount < minThreshold * 2) return "provisional";
  return "stable";
}

export function getSeverity(dimScore: number): Severity {
  if (dimScore >= 75) return "strength";
  if (dimScore >= 60) return "watch";
  return "weak";
}

function labelFor(key: DimensionKey): string {
  return DIMENSION_LABELS[key];
}

type DimEntry = {
  key: DimensionKey;
  score: number;
  severity: Severity;
  label: string;
};

export function pickDrivers(dimEntries: DimEntry[]): DriverEntry[] {
  const sorted = [...dimEntries].sort((a, b) => a.score - b.score);
  const drivers: DriverEntry[] = [];

  // Up to 2 weakest where severity is weak or watch
  const weakOrWatch = sorted.filter(d => d.severity === "weak" || d.severity === "watch");
  const weakest = weakOrWatch.slice(0, 2);
  for (const d of weakest) {
    drivers.push({
      key: d.key,
      label: d.label,
      score: d.score,
      severity: d.severity,
      why: WHY_TEMPLATES[d.key][d.severity],
    });
  }

  // 1 strongest (highest score >= 75), or least-bad watch
  const sortedDesc = [...dimEntries].sort((a, b) => b.score - a.score);
  const strongest = sortedDesc.find(d => d.score >= 75 && !drivers.some(dr => dr.key === d.key));
  if (strongest) {
    drivers.push({
      key: strongest.key,
      label: strongest.label,
      score: strongest.score,
      severity: strongest.severity,
      why: WHY_TEMPLATES[strongest.key][strongest.severity],
    });
  } else {
    // Least-bad watch dimension not already included
    const leastBadWatch = sortedDesc.find(
      d => d.severity === "watch" && !drivers.some(dr => dr.key === d.key)
    );
    if (leastBadWatch) {
      drivers.push({
        key: leastBadWatch.key,
        label: leastBadWatch.label,
        score: leastBadWatch.score,
        severity: leastBadWatch.severity,
        why: WHY_TEMPLATES[leastBadWatch.key][leastBadWatch.severity],
      });
    } else {
      // Fallback: pick the highest-scoring dimension not yet included
      const fallback = sortedDesc.find(d => !drivers.some(dr => dr.key === d.key));
      if (fallback) {
        drivers.push({
          key: fallback.key,
          label: fallback.label,
          score: fallback.score,
          severity: fallback.severity,
          why: WHY_TEMPLATES[fallback.key][fallback.severity],
        });
      }
    }
  }

  return drivers;
}

export function makeHeadline(opts: {
  tier: TierKey;
  status: DataStatus;
  drivers: DriverEntry[];
}): string {
  const { tier, status, drivers } = opts;
  const weakest = drivers.find(d => d.severity === "weak" || d.severity === "watch");
  const strongest = drivers.find(d => d.severity === "strength") ?? drivers[drivers.length - 1];
  const weakLabel = weakest?.label ?? "multiple areas";
  const strongLabel = strongest?.label ?? "relative strengths";

  let headline: string;
  switch (tier) {
    case "trusted":
      headline = `TrustGraph is strong and resilient \u2014 your main advantage is ${strongLabel}, with attention needed on ${weakLabel}.`;
      break;
    case "stable":
      headline = `TrustGraph is broadly stable \u2014 performance is supported by ${strongLabel}, but ${weakLabel} is the main constraint.`;
      break;
    case "elevated_risk":
      headline = `TrustGraph is under strain \u2014 ${weakLabel} is pulling overall trust down and will limit performance unless addressed.`;
      break;
    case "critical":
      headline = `TrustGraph is fragile \u2014 multiple trust drivers are failing, with ${weakLabel} the most urgent exposure.`;
      break;
  }

  if (status === "insufficient_data") {
    headline = `Early signal: ${headline}`;
  }

  return headline;
}

export function makePosture(
  module: "org" | "sys",
  dims: Record<DimensionKey, number>
): string {
  const risk = dims.risk;
  const explainability = dims.explainability;

  if (module === "sys") {
    // Sys module uses "system assurance posture"
    if (risk < 60 || explainability < 60) {
      return "System assurance posture is reactive \u2014 evaluation and monitoring aren\u2019t strong enough to reliably prevent avoidable risk.";
    }
    if (risk >= 75 && explainability >= 75) {
      return "System assurance posture is proactive \u2014 evaluation, monitoring, and auditability are strong enough to support safe autonomy.";
    }
    return "System assurance posture is developing \u2014 foundations are present, but consistency and enforcement need strengthening.";
  }

  // Org module
  if (risk < 60 || explainability < 60) {
    return "Governance posture is reactive \u2014 controls and explainability aren\u2019t strong enough to reliably prevent avoidable risk.";
  }
  if (risk >= 75 && explainability >= 75) {
    return "Governance posture is proactive \u2014 oversight and explainability are strong enough to support safe autonomy.";
  }
  return "Governance posture is developing \u2014 foundations are present, but consistency and enforcement need strengthening.";
}

export function makeConfidenceNote(
  status: DataStatus,
  responseCount: number,
  minThreshold: number
): string {
  switch (status) {
    case "insufficient_data":
      return `This is an early signal based on ${responseCount} response${responseCount !== 1 ? "s" : ""}. Results become more reliable at ${minThreshold}+ responses.`;
    case "provisional":
      return `Based on ${responseCount} responses. Directionally useful \u2014 expect some movement as more responses arrive.`;
    case "stable":
      return `Based on ${responseCount} responses. Stable enough to act on \u2014 track changes over time to confirm impact.`;
  }
}

export function makeTrendNote(input: TrustGraphInputs): string | undefined {
  if (input.previousScore === undefined) return undefined;

  const delta = input.score - input.previousScore;
  let note: string;

  if (Math.abs(delta) < 3) {
    note = "Stable vs last snapshot.";
  } else if (delta >= 3) {
    note = `Improving (+${delta}) vs last snapshot.`;
  } else {
    note = `Declining (${delta}) vs last snapshot.`;
  }

  // Find dimension with largest movement
  if (input.previousDimensions) {
    let maxDimDelta = 0;
    let maxDimKey: DimensionKey | null = null;
    for (const [key, prevScore] of Object.entries(input.previousDimensions)) {
      const currentScore = input.dimensions[key as DimensionKey];
      if (currentScore !== undefined && prevScore !== undefined) {
        const d = Math.abs(currentScore - prevScore);
        if (d > maxDimDelta) {
          maxDimDelta = d;
          maxDimKey = key as DimensionKey;
        }
      }
    }
    if (maxDimKey && maxDimDelta >= 3) {
      const dimDelta = input.dimensions[maxDimKey] - (input.previousDimensions[maxDimKey] ?? 0);
      const direction = dimDelta > 0 ? "up" : "down";
      note += ` Largest shift: ${DIMENSION_LABELS[maxDimKey]} (${direction} ${Math.abs(dimDelta)}).`;
    }
  }

  return note;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export function buildExecutiveSummary(input: TrustGraphInputs): ExecSummaryOutput {
  const status = getStatus(input.responseCount, input.minResponseThreshold);
  const tier = getTier(input.score);

  const dimEntries: DimEntry[] = (Object.entries(input.dimensions) as [DimensionKey, number][]).map(
    ([key, score]) => ({
      key,
      score,
      severity: getSeverity(score),
      label: labelFor(key),
    })
  );

  const drivers = pickDrivers(dimEntries);
  const weakestTwo = [...dimEntries].sort((a, b) => a.score - b.score).slice(0, 2);

  const priorities: PriorityEntry[] = weakestTwo.map((d) => {
    const pack = PRIORITY_PACKS[d.key];
    return {
      title: pack.title,
      rationale: pack.rationale,
      probes: pack.probes,
    };
  });

  const headline = makeHeadline({ tier, status, drivers });
  const posture = makePosture(input.module, input.dimensions);
  const confidenceNote = makeConfidenceNote(status, input.responseCount, input.minResponseThreshold);
  const trendNote = makeTrendNote(input);

  return {
    status,
    tier,
    headline,
    posture,
    primaryDrivers: drivers,
    priorities,
    confidenceNote,
    ...(trendNote ? { trendNote } : {}),
  };
}
```

**Step 2: Verify build**

Run: `cd /Users/robfanshawe/trustindex && npx next build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add src/lib/executiveSummary.ts
git commit -m "feat: add Executive Summary Logic Engine for TrustGraph"
```

---

## Task 5: Create Executive Summary UI Component

**Files:**
- Create: `src/components/ExecutiveSummary.tsx`

**Step 1: Create the component**

Create `src/components/ExecutiveSummary.tsx`:
```tsx
"use client";

import TierBadge from "./TierBadge";
import type { ExecSummaryOutput, Severity } from "@/lib/executiveSummary";

type Props = {
  summary: ExecSummaryOutput;
};

function severityChip(severity: Severity) {
  const config: Record<Severity, { label: string; className: string }> = {
    strength: { label: "Strength", className: "bg-tier-trusted/10 text-tier-trusted" },
    watch: { label: "Watch", className: "bg-tier-elevated/10 text-tier-elevated" },
    weak: { label: "Weak", className: "bg-tier-critical/10 text-tier-critical" },
  };
  const c = config[severity];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${c.className}`}>
      {c.label}
    </span>
  );
}

export default function ExecutiveSummary({ summary }: Props) {
  return (
    <div className="space-y-6">
      {/* Header: Tier + Status */}
      <div className="flex items-center gap-3">
        <TierBadge tier={summary.tier} />
        {summary.status !== "stable" && (
          <span className="text-xs text-muted-foreground px-2 py-0.5 rounded-full bg-muted">
            {summary.status === "insufficient_data" ? "Early signal" : "Provisional"}
          </span>
        )}
      </div>

      {/* Headline */}
      <h2 className="text-xl font-semibold leading-snug">
        {summary.headline}
      </h2>

      {/* Posture */}
      <p className="text-sm text-muted-foreground leading-relaxed">
        {summary.posture}
      </p>

      {/* Primary Drivers */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-foreground">Primary Drivers</h3>
        <div className="space-y-2">
          {summary.primaryDrivers.map((driver) => (
            <div
              key={driver.key}
              className="flex items-start gap-3 rounded-xl bg-card border border-border p-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">{driver.label}</span>
                  {severityChip(driver.severity)}
                  <span className="text-xs text-muted-foreground ml-auto">
                    {driver.score}/100
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{driver.why}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Priorities */}
      {summary.priorities.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-foreground">Priorities</h3>
          <div className="grid gap-4 md:grid-cols-2">
            {summary.priorities.map((priority, i) => (
              <div
                key={i}
                className="rounded-xl bg-card border border-border p-5 space-y-3"
              >
                <h4 className="font-medium text-sm">{priority.title}</h4>
                <p className="text-xs text-muted-foreground">{priority.rationale}</p>
                <div className="space-y-1.5">
                  <div className="text-xs font-medium text-muted-foreground">
                    Questions to explore:
                  </div>
                  <ul className="space-y-1">
                    {priority.probes.map((probe, j) => (
                      <li key={j} className="text-xs text-muted-foreground flex gap-2">
                        <span className="text-muted-foreground/50 select-none">{j + 1}.</span>
                        {probe}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Confidence + Trend notes */}
      <div className="space-y-1 pt-2">
        <p className="text-xs text-muted-foreground">{summary.confidenceNote}</p>
        {summary.trendNote && (
          <p className="text-xs text-muted-foreground">{summary.trendNote}</p>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Verify build**

Run: `cd /Users/robfanshawe/trustindex && npx next build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add src/components/ExecutiveSummary.tsx
git commit -m "feat: add ExecutiveSummary UI component for TrustGraph results"
```

---

## Task 6: Create Methodology Overlay Component

**Files:**
- Create: `src/components/MethodologyOverlay.tsx`

**Step 1: Create the methodology overlay modal**

Create `src/components/MethodologyOverlay.tsx`:
```tsx
"use client";

import { useState } from "react";

type Props = {
  module?: "org" | "sys";
};

export default function MethodologyOverlay({ module = "org" }: Props) {
  const [open, setOpen] = useState(false);

  const dimensions = module === "org"
    ? [
        { name: "Transparency", weight: "20%", description: "Visibility and clarity of decision-making processes." },
        { name: "Inclusion", weight: "20%", description: "Psychological safety and participation across the organisation." },
        { name: "Confidence", weight: "20%", description: "Trust in leadership follow-through and consistency." },
        { name: "Explainability", weight: "20%", description: "How well decisions (especially AI-supported) can be understood." },
        { name: "Risk", weight: "20%", description: "Strength of governance controls and escalation paths." },
      ]
    : [
        { name: "Transparency", weight: "20%", description: "Clarity of system purpose, limitations, and outputs." },
        { name: "Inclusion", weight: "20%", description: "Stakeholder involvement in system oversight." },
        { name: "Confidence", weight: "20%", description: "Trust in system reliability and consistency." },
        { name: "Explainability", weight: "20%", description: "How well system decisions can be explained to humans." },
        { name: "Risk", weight: "20%", description: "Controls for identifying, escalating, and mitigating system risk." },
      ];

  return (
    <>
      {/* Info icon trigger */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-muted-foreground/30 text-muted-foreground hover:text-foreground hover:border-foreground/50 transition-colors"
        aria-label="View methodology"
        title="View methodology"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />

          {/* Content */}
          <div className="relative bg-card rounded-xl shadow-lg border border-border max-w-lg w-full max-h-[80vh] overflow-y-auto p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">TrustGraph Methodology</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Evidence scoring */}
            <div>
              <h3 className="text-sm font-medium mb-1">Evidence Scoring</h3>
              <p className="text-xs text-muted-foreground">
                Responses are collected on a Likert scale (1\u20135) and normalised to 0\u2013100
                for dimension and overall scores.
              </p>
            </div>

            {/* Dimensions */}
            <div>
              <h3 className="text-sm font-medium mb-2">Dimensions &amp; Weighting</h3>
              <div className="space-y-2">
                {dimensions.map((d) => (
                  <div key={d.name} className="flex items-start gap-3 text-xs">
                    <span className="font-medium w-28 shrink-0">{d.name}</span>
                    <span className="text-muted-foreground/70 w-10 shrink-0">{d.weight}</span>
                    <span className="text-muted-foreground">{d.description}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Version */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t border-border">
              <span>Methodology version: <strong>TrustGraph v1.0</strong></span>
              <span>Last updated: <strong>February 2026</strong></span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
```

**Step 2: Verify build**

Run: `cd /Users/robfanshawe/trustindex && npx next build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add src/components/MethodologyOverlay.tsx
git commit -m "feat: add MethodologyOverlay modal component"
```

---

## Task 7: Brand Rename — Core Shell Components

**Files:**
- Modify: `src/app/layout.tsx:16-18`
- Modify: `src/components/AppShell.tsx:62-75,212`
- Modify: `src/components/AuthenticatedShell.tsx:122-137,230`

**Step 1: Update layout.tsx metadata**

In `src/app/layout.tsx`, change:
```typescript
  title: "TrustIndex™ by Verisum",
  description: "Measure and build organisational trust",
```
to:
```typescript
  title: "TrustGraph™ by Verisum",
  description: "Measure, map and strengthen organisational trust",
```

**Step 2: Update AppShell.tsx header**

In `src/components/AppShell.tsx`, replace the branding div (lines 60-76) — the `Verisum | TrustIndex™` dual brand — with a standalone TrustGraph brand:

Replace:
```tsx
            <div className="flex items-center gap-3">
              <a
                href="https://www.verisum.org"
                target="_blank"
                rel="noopener noreferrer"
                className="text-base md:text-lg font-semibold text-verisum-black hover:text-verisum-blue transition-colors"
              >
                Verisum
              </a>
              <span className="text-verisum-grey">|</span>
              <a
                href="/"
                className="text-base md:text-lg font-semibold text-verisum-black hover:text-verisum-blue transition-colors"
              >
                TrustIndex™
              </a>
            </div>
```
with:
```tsx
            <div className="flex items-center gap-3">
              <a
                href="/"
                className="text-base md:text-lg font-semibold text-verisum-black hover:text-verisum-blue transition-colors"
              >
                TrustGraph™
              </a>
            </div>
```

**Step 3: Update AppShell.tsx footer**

In `src/components/AppShell.tsx`, change line 212:
```tsx
              <span>© {currentYear} Verisum • TrustIndex™</span>
```
to:
```tsx
              <span>© {currentYear} Verisum • TrustGraph™</span>
```

**Step 4: Update AuthenticatedShell.tsx header**

In `src/components/AuthenticatedShell.tsx`, replace the branding div (lines 122-138):

Replace:
```tsx
        <div className="flex items-center gap-3">
          <a
            href="https://www.verisum.org"
            target="_blank"
            rel="noopener noreferrer"
            className="text-base font-semibold text-verisum-black hover:text-verisum-blue transition-colors"
          >
            Verisum
          </a>
          <span className="text-verisum-grey">|</span>
          <a
            href="/dashboard"
            className="text-base font-semibold text-verisum-black hover:text-verisum-blue transition-colors"
          >
            TrustIndex™
          </a>
        </div>
```
with:
```tsx
        <div className="flex items-center gap-3">
          <a
            href="/dashboard"
            className="text-base font-semibold text-verisum-black hover:text-verisum-blue transition-colors"
          >
            TrustGraph™
          </a>
        </div>
```

**Step 5: Update AuthenticatedShell.tsx sidebar footer**

In `src/components/AuthenticatedShell.tsx`, change line 230:
```tsx
              &copy; {currentYear} Verisum
```
to:
```tsx
              &copy; {currentYear} Verisum &middot; TrustGraph&trade;
```

**Step 6: Verify build**

Run: `cd /Users/robfanshawe/trustindex && npx next build`
Expected: Build succeeds.

**Step 7: Commit**

```bash
git add src/app/layout.tsx src/components/AppShell.tsx src/components/AuthenticatedShell.tsx
git commit -m "feat: rebrand core shells from TrustIndex to TrustGraph"
```

---

## Task 8: Brand Rename — Homepage

**Files:**
- Modify: `src/app/_homeClientImpl.tsx`

**Step 1: Replace all TrustIndex references**

In `src/app/_homeClientImpl.tsx`:

Line 9: `TrustIndex&trade;` → `TrustGraph&trade;`
Line 13: `TrustIndex&trade; helps` → `TrustGraph&trade; helps`
Line 22-23: `TrustIndex measures` → `TrustGraph measures`

**Step 2: Verify build**

Run: `cd /Users/robfanshawe/trustindex && npx next build`

**Step 3: Commit**

```bash
git add src/app/_homeClientImpl.tsx
git commit -m "feat: rebrand homepage from TrustIndex to TrustGraph"
```

---

## Task 9: Brand Rename — Dashboard Page + Tabs

**Files:**
- Modify: `src/app/dashboard/page.tsx`

**Step 1: Update dashboard subtitle**

Line 77: `Your TrustIndex dashboard` → `Your TrustGraph dashboard`

**Step 2: Update tab labels**

Find and replace the tab button text:
- `Organisation` → `TrustOrg`
- `Systems` → `TrustSys`

Also update the `activeTab` logic variable name if needed, and the `setTab` parameter values — keep the internal values (`"organisation"`, `"systems"`) for URL params but change the displayed labels.

**Step 3: Verify build**

Run: `cd /Users/robfanshawe/trustindex && npx next build`

**Step 4: Commit**

```bash
git add src/app/dashboard/page.tsx
git commit -m "feat: rebrand dashboard to TrustGraph with TrustOrg/TrustSys tabs"
```

---

## Task 10: Brand Rename — Survey Pages

**Files:**
- Modify: `src/app/survey/[token]/page.tsx`
- Modify: `src/app/dashboard/surveys/new/page.tsx`
- Modify: `src/app/dashboard/surveys/[runId]/page.tsx`
- Modify: `src/app/dashboard/surveys/[runId]/results/page.tsx`

**Step 1: Update survey/[token]/page.tsx**

- Line 170: `TrustIndex Survey` → `TrustOrg Survey`
- Lines 204-207: Email share text — change `TrustIndex` to `TrustGraph`
- Line 227: `TrustIndex™ Survey` → `TrustOrg Survey`

**Step 2: Update dashboard/surveys/new/page.tsx**

- Line 54: Default title `TrustIndex Pilot` → `TrustOrg Pilot`
- Line 205: Default title same change
- Lines 222, 240, 279: `Create a TrustIndex survey` → `Create a TrustOrg survey`

**Step 3: Update dashboard/surveys/[runId]/page.tsx**

- Line 308: CSV filename `trustindex_` → `trustgraph_`
- Lines 328-329: DB view name `v_trustindex_scores` — **keep as-is** (this is a database view name, not UI text)
- Line 370: DB field `trustindex_0_to_100` — **keep as-is** (database field)
- Line 380: DB field — **keep as-is**
- Line 417: CSV filename `trustindex_` → `trustgraph_`
- Line 520: CSV filename `trustindex-links` → `trustgraph-links`
- Line 741: Email text `TrustIndex survey` → `TrustOrg survey`
- Line 745: Email body `TrustIndex survey` → `TrustOrg survey`
- Line 780: Share text `TrustIndex links` → `TrustGraph links`

**Step 4: Update dashboard/surveys/[runId]/results/page.tsx**

- Lines 445, 470, 549, 619: All `TrustIndex results` → `TrustGraph Results`
- Line 621: `live TrustIndex snapshot` → `live TrustGraph snapshot`
- Line 641: `TrustIndex score` → `TrustGraph Score™`
- Line 418: CSV filename `trustindex_` → `trustgraph_`
- Note: Keep DB field references (`trustindex_0_to_100`, `v_trustindex_scores`) unchanged — those are database names.

**Step 5: Verify build**

Run: `cd /Users/robfanshawe/trustindex && npx next build`

**Step 6: Commit**

```bash
git add src/app/survey/[token]/page.tsx src/app/dashboard/surveys/new/page.tsx src/app/dashboard/surveys/\[runId\]/page.tsx src/app/dashboard/surveys/\[runId\]/results/page.tsx
git commit -m "feat: rebrand survey pages from TrustIndex to TrustGraph/TrustOrg"
```

---

## Task 11: Brand Rename — Explorer, Auth, Upgrade, Exports, VCC

**Files:**
- Modify: `src/app/try/page.tsx`
- Modify: `src/app/auth/login/page.tsx`
- Modify: `src/app/upgrade/page.tsx`
- Modify: `src/app/api/settings/export/systems/route.ts`
- Modify: `src/app/api/settings/export/surveys/route.ts`
- Modify: `src/app/verisum-admin/page.tsx`

**Step 1: Update try/page.tsx (Explorer)**

- Line 325: `Calculating your TrustIndex score…` → `Calculating your TrustGraph score…`
- Line 346: `Your TrustIndex™ Results` → `Your TrustGraph™ Results`
- Line 359: `TrustIndex score` → `TrustGraph Score™`
- Line 411: `keep your TrustIndex results` → `keep your TrustGraph results`
- Line 445: `TrustIndex™ Explorer` → `TrustGraph Explorer`
- Note: Keep DB references (`v_trustindex_scores`, `trustindex_0_to_100`) unchanged.

**Step 2: Update auth/login/page.tsx**

- Line 123: `New to TrustIndex?` → `New to TrustGraph?`

**Step 3: Update upgrade/page.tsx**

- Line 135: `TrustIndex%20Enterprise` → `TrustGraph%20Enterprise`

**Step 4: Update export API routes**

- `src/app/api/settings/export/systems/route.ts` lines 53, 73, 131: `trustindex_systems_export.csv` → `trustgraph_systems_export.csv`
- `src/app/api/settings/export/surveys/route.ts` lines 54, 119: `trustindex_surveys_export.csv` → `trustgraph_surveys_export.csv`

**Step 5: Update VCC dashboard description**

- `src/app/verisum-admin/page.tsx` line 60: `TrustIndex platform` → `TrustGraph platform`

**Step 6: Verify build**

Run: `cd /Users/robfanshawe/trustindex && npx next build`

**Step 7: Commit**

```bash
git add src/app/try/page.tsx src/app/auth/login/page.tsx src/app/upgrade/page.tsx src/app/api/settings/export/systems/route.ts src/app/api/settings/export/surveys/route.ts src/app/verisum-admin/page.tsx
git commit -m "feat: complete TrustGraph brand rename across explorer, auth, exports, VCC"
```

---

## Task 12: Integrate Tier Badge + Exec Summary into Results Page

**Files:**
- Modify: `src/app/dashboard/surveys/[runId]/results/page.tsx`

**Step 1: Add imports**

At the top of the file, add:
```typescript
import TierBadge from "@/components/TierBadge";
import ExecutiveSummary from "@/components/ExecutiveSummary";
import MethodologyOverlay from "@/components/MethodologyOverlay";
import { buildExecutiveSummary, type DimensionKey } from "@/lib/executiveSummary";
```

**Step 2: Replace the old `bandFor` function**

The existing `bandFor` function (lines 65-85) uses old tier bands (Fragile/Mixed/Strong). Keep it for backward compatibility but add executive summary computation.

After the existing derived data section (around line 458), add:
```typescript
// Build executive summary if we have trust data and dimensions
const execSummary = useMemo(() => {
  if (!trust || !dims.length) return null;
  const dimRecord = {} as Record<DimensionKey, number>;
  const dimKeyMap: Record<string, DimensionKey> = {
    "Transparency": "transparency",
    "Inclusion": "inclusion",
    "Employee Confidence": "confidence",
    "AI Explainability": "explainability",
    "Risk": "risk",
  };
  for (const d of dims) {
    const key = dimKeyMap[d.dimension];
    if (key) dimRecord[key] = (d.mean_1_to_5 - 1) * 25; // convert 1-5 to 0-100
  }
  // Only build if we have all 5 dimensions
  if (Object.keys(dimRecord).length < 5) return null;
  return buildExecutiveSummary({
    module: run?.mode === "explorer" ? "org" : "org",
    score: Number(trust.trustindex_0_to_100),
    responseCount: counts?.respondents ?? 0,
    minResponseThreshold: run?.mode === "explorer" ? 1 : 5,
    dimensions: dimRecord,
  });
}, [trust, dims, counts, run]);
```

**Step 3: Add tier badge to the score card**

In the score card section (around line 639), after the score display, add the tier badge and methodology overlay:
```tsx
{/* Score card */}
<div className="rounded-xl border border-border p-6 flex items-end justify-between">
  <div>
    <div className="flex items-center gap-2 mb-1">
      <div className="text-sm text-muted-foreground">TrustGraph Score™</div>
      <MethodologyOverlay module="org" />
    </div>
    <div className="flex items-center gap-3">
      <div className="text-5xl font-bold">
        {Number(trust.trustindex_0_to_100).toFixed(1)}
      </div>
      {execSummary && <TierBadge tier={execSummary.tier} />}
    </div>
  </div>
  <div className="text-sm text-muted-foreground">
    Derived from mean score:{" "}
    {Number(trust.overall_mean_1_to_5).toFixed(2)} / 5
  </div>
</div>
```

**Step 4: Add Executive Summary section below the score card**

After the score card and before the dimension breakdown, add:
```tsx
{/* Executive Summary */}
{execSummary && (
  <div className="rounded-xl border border-border p-6">
    <ExecutiveSummary summary={execSummary} />
  </div>
)}
```

**Step 5: Verify build**

Run: `cd /Users/robfanshawe/trustindex && npx next build`

**Step 6: Commit**

```bash
git add src/app/dashboard/surveys/\[runId\]/results/page.tsx
git commit -m "feat: integrate TierBadge, ExecutiveSummary, MethodologyOverlay into results page"
```

---

## Task 13: Integrate Tier Badge into Explorer Results

**Files:**
- Modify: `src/app/try/page.tsx`

**Step 1: Add imports**

Add at top:
```typescript
import TierBadge from "@/components/TierBadge";
```

**Step 2: Add TierBadge next to the score display**

In the Explorer results section (around line 359-362), after the score number, add:
```tsx
<TierBadge score={Math.round(Number(trust.trustindex_0_to_100))} />
```

**Step 3: Verify build**

Run: `cd /Users/robfanshawe/trustindex && npx next build`

**Step 4: Commit**

```bash
git add src/app/try/page.tsx
git commit -m "feat: add TierBadge to Explorer results page"
```

---

## Task 14: Visual Elevation Pass

**Files:**
- Modify: `src/app/dashboard/surveys/[runId]/results/page.tsx` (card styles)
- Modify: `src/app/_homeClientImpl.tsx` (card styles)
- Modify: `src/app/dashboard/page.tsx` (section spacing)

**Step 1: Update results page card styles**

In `src/app/dashboard/surveys/[runId]/results/page.tsx`, do a find-and-replace:
- `border border-verisum-grey rounded-lg p-6` → `rounded-xl border border-border p-6 shadow-sm`

**Step 2: Update homepage card styles**

In `src/app/_homeClientImpl.tsx`:
- `border border-verisum-grey rounded-lg p-6` → `rounded-xl border border-border p-8 shadow-sm`

**Step 3: Update dashboard spacing**

In `src/app/dashboard/page.tsx`:
- Increase section gap if using `space-y-6` → `space-y-8`

**Step 4: Verify build**

Run: `cd /Users/robfanshawe/trustindex && npx next build`

**Step 5: Commit**

```bash
git add src/app/dashboard/surveys/\[runId\]/results/page.tsx src/app/_homeClientImpl.tsx src/app/dashboard/page.tsx
git commit -m "feat: visual elevation — softer cards, more whitespace, reduced border density"
```

---

## Task 15: Final Verification + Full Brand Grep

**Step 1: Grep for any remaining TrustIndex references in UI text**

Run:
```bash
cd /Users/robfanshawe/trustindex && grep -rn "TrustIndex" --include="*.tsx" --include="*.ts" src/ | grep -v "v_trustindex_scores" | grep -v "trustindex_0_to_100" | grep -v "node_modules" | grep -v ".next"
```

Expected: Zero results (all UI text should be TrustGraph now). DB field names (`v_trustindex_scores`, `trustindex_0_to_100`) are expected and correct.

**Step 2: Run full build**

Run: `cd /Users/robfanshawe/trustindex && npx next build`
Expected: Build succeeds with zero errors.

**Step 3: If any remaining TrustIndex references found, fix them and commit**

```bash
git add -A
git commit -m "fix: remove any remaining TrustIndex references"
```

---

## Summary

| Task | Description | New Files | Modified Files |
|------|-------------|-----------|----------------|
| 1 | CSS design tokens + tier colours | 0 | 1 |
| 2 | Tier framework library | 1 | 0 |
| 3 | TierBadge component | 1 | 0 |
| 4 | Executive Summary logic engine | 1 | 0 |
| 5 | ExecutiveSummary UI component | 1 | 0 |
| 6 | MethodologyOverlay component | 1 | 0 |
| 7 | Brand rename: core shells | 0 | 3 |
| 8 | Brand rename: homepage | 0 | 1 |
| 9 | Brand rename: dashboard + tabs | 0 | 1 |
| 10 | Brand rename: survey pages | 0 | 4 |
| 11 | Brand rename: explorer, auth, exports, VCC | 0 | 6 |
| 12 | Integrate tier + exec summary into results | 0 | 1 |
| 13 | Integrate tier badge into explorer | 0 | 1 |
| 14 | Visual elevation pass | 0 | 3 |
| 15 | Final verification + grep | 0 | 0 |

**Total: 5 new files, ~21 modified files, 15 commits.**
