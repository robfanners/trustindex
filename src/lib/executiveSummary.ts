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
    strength:
      "Decision context is visible enough for people to execute with confidence.",
    watch:
      "Decision context is uneven \u2014 some teams act with clarity, others fill gaps with assumptions.",
    weak:
      "Low visibility into decisions is likely creating friction, rumours, and slower execution.",
  },
  inclusion: {
    strength:
      "People feel able to contribute and challenge, reducing hidden risk.",
    watch:
      "Participation is uneven \u2014 some voices dominate and dissent may be filtered.",
    weak:
      "Low psychological safety likely suppresses challenge and delays surfacing problems.",
  },
  confidence: {
    strength:
      "Leadership intent and follow-through are credible, supporting pace.",
    watch:
      "Follow-through is inconsistent, creating pockets of scepticism.",
    weak:
      "Low confidence in leadership follow-through is likely reducing pace and engagement.",
  },
  explainability: {
    strength:
      "Understanding of how decisions are made is strong enough to sustain trust.",
    watch:
      "Some decisions feel opaque, especially where AI or complexity is involved.",
    weak:
      "Opaque decisions (especially AI-supported) are likely undermining trust and adoption.",
  },
  risk: {
    strength:
      "Controls and escalation are strong enough to prevent avoidable exposure.",
    watch:
      "Controls exist but enforcement is inconsistent across teams or workflows.",
    weak:
      "Risk controls are too weak \u2014 exposure may be rising without visibility or escalation.",
  },
};

const PRIORITY_PACKS: Record<DimensionKey, PriorityEntry> = {
  transparency: {
    title: "Increase decision transparency where it matters",
    rationale:
      "Low transparency creates rumours, slows decisions, and reduces adoption.",
    probes: [
      "Where do people feel decisions are made without clear reasons?",
      "What information is consistently missing at the point of execution?",
      "Which decisions need a published \u2018why / trade-offs / owner\u2019 note?",
    ],
  },
  inclusion: {
    title: "Raise psychological safety and inclusion signals",
    rationale:
      "Low inclusion suppresses challenge and hides risk until late.",
    probes: [
      "Where do people avoid speaking up, and why?",
      "Which groups feel least heard in planning and review?",
      "Are dissenting views recorded and addressed or ignored?",
    ],
  },
  confidence: {
    title: "Rebuild confidence in leadership follow-through",
    rationale:
      "Low confidence reduces pace and increases silent disengagement.",
    probes: [
      "Which promises or priorities feel repeatedly broken?",
      "Where is execution drifting from stated strategy?",
      "Do teams believe feedback leads to change?",
    ],
  },
  explainability: {
    title: "Improve explainability and human understanding",
    rationale:
      "Low explainability makes AI-driven decisions brittle and hard to trust.",
    probes: [
      "Which outputs feel like black boxes to teams?",
      "Where is the \u2018reason / evidence / confidence\u2019 missing?",
      "Who is accountable when AI output is wrong?",
    ],
  },
  risk: {
    title: "Strengthen governance controls and escalation",
    rationale:
      "Low risk control increases operational and regulatory exposure.",
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

export function getStatus(
  responseCount: number,
  minThreshold: number
): DataStatus {
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
  const weakOrWatch = sorted.filter(
    (d) => d.severity === "weak" || d.severity === "watch"
  );
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
  const strongest = sortedDesc.find(
    (d) => d.score >= 75 && !drivers.some((dr) => dr.key === d.key)
  );
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
      (d) =>
        d.severity === "watch" && !drivers.some((dr) => dr.key === d.key)
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
      const fallback = sortedDesc.find(
        (d) => !drivers.some((dr) => dr.key === d.key)
      );
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
  const weakest = drivers.find(
    (d) => d.severity === "weak" || d.severity === "watch"
  );
  const strongest =
    drivers.find((d) => d.severity === "strength") ??
    drivers[drivers.length - 1];
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

export function makeTrendNote(
  input: TrustGraphInputs
): string | undefined {
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
      const dimDelta =
        input.dimensions[maxDimKey] -
        (input.previousDimensions[maxDimKey] ?? 0);
      const direction = dimDelta > 0 ? "up" : "down";
      note += ` Largest shift: ${DIMENSION_LABELS[maxDimKey]} (${direction} ${Math.abs(dimDelta)}).`;
    }
  }

  return note;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export function buildExecutiveSummary(
  input: TrustGraphInputs
): ExecSummaryOutput {
  const status = getStatus(
    input.responseCount,
    input.minResponseThreshold
  );
  const tier = getTier(input.score);

  const dimEntries: DimEntry[] = (
    Object.entries(input.dimensions) as [DimensionKey, number][]
  ).map(([key, score]) => ({
    key,
    score,
    severity: getSeverity(score),
    label: labelFor(key),
  }));

  const drivers = pickDrivers(dimEntries);
  const weakestTwo = [...dimEntries]
    .sort((a, b) => a.score - b.score)
    .slice(0, 2);

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
  const confidenceNote = makeConfidenceNote(
    status,
    input.responseCount,
    input.minResponseThreshold
  );
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
