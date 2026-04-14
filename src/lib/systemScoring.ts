// ---------------------------------------------------------------------------
// TrustSysGraph — Deterministic Scoring Engine
// ---------------------------------------------------------------------------
// Pure functions — safe for both client-side preview and server-side submit.
// ---------------------------------------------------------------------------

import type {
  AnswerType,
  Evidence,
  MaturityLevel,
  QuestionAnswer,
  SystemDimension,
  SystemQuestion,
} from "./systemQuestionBank";
import { SYSTEM_DIMENSIONS, SYSTEM_QUESTIONS } from "./systemQuestionBank";

// ---------------------------------------------------------------------------
// Base score from answer
// ---------------------------------------------------------------------------

const MATURITY_SCORES: Record<MaturityLevel, number> = {
  none: 0.0,
  ad_hoc: 0.25,
  defined: 0.5,
  enforced: 0.75,
  automated: 1.0,
};

export function maturityToScore(m: MaturityLevel): number {
  return MATURITY_SCORES[m] ?? 0;
}

export function booleanToScore(b: boolean): number {
  return b ? 1.0 : 0.0;
}

export function baseScore(answer: QuestionAnswer, answerType: AnswerType): number {
  if (answerType === "boolean") {
    return answer.boolean != null ? booleanToScore(answer.boolean) : 0;
  }
  return answer.maturity != null ? maturityToScore(answer.maturity) : 0;
}

// ---------------------------------------------------------------------------
// Evidence cap
// ---------------------------------------------------------------------------

/** Classify evidence strength and return the cap multiplier */
export function evidenceCap(evidence?: Evidence): number {
  if (!evidence) return 0.4; // No evidence → cap at 0.4

  const { type, pointer } = evidence;
  const hasPointer = typeof pointer === "string" && pointer.trim().length > 0;

  // Strong evidence: link/ticket/log/runbook/policy with a pointer
  const strongTypes: string[] = [
    "link",
    "ticket_ref",
    "log_ref",
    "runbook_ref",
    "policy_ref",
  ];
  if (strongTypes.includes(type) && hasPointer) return 1.0;

  // Weak evidence: document_ref without pointer, or any type with note but no pointer
  return 0.6;
}

// ---------------------------------------------------------------------------
// Per-question score
// ---------------------------------------------------------------------------

/** Final question score = min(baseScore, evidenceCap) */
export function questionScore(
  answer: QuestionAnswer,
  answerType: AnswerType
): number {
  const base = baseScore(answer, answerType);
  const cap = evidenceCap(answer.evidence);
  return Math.min(base, cap);
}

// ---------------------------------------------------------------------------
// Dimension score (0–100)
// ---------------------------------------------------------------------------

/** Weighted sum within a dimension: round(100 × Σ(qScore_i × weight_i)) */
export function dimensionScore(
  questions: SystemQuestion[],
  answers: Record<string, QuestionAnswer>,
  dimension: SystemDimension
): number {
  const dimQuestions = questions.filter((q) => q.dimension === dimension);
  let score = 0;
  for (const q of dimQuestions) {
    const answer = answers[q.id];
    if (answer) {
      score += questionScore(answer, q.answerType) * q.weight;
    }
  }
  return Math.round(score * 100);
}

// ---------------------------------------------------------------------------
// Overall score (0–100)
// ---------------------------------------------------------------------------

/** Equal weight per dimension: round(mean(dimScores across SYSTEM_DIMENSIONS)). */
export function overallScore(
  dimScores: Record<string, number>
): number {
  const n = SYSTEM_DIMENSIONS.length;
  if (n === 0) return 0;
  let sum = 0;
  for (const dim of SYSTEM_DIMENSIONS) {
    sum += dimScores[dim] ?? 0;
  }
  return Math.round(sum / n);
}

// ---------------------------------------------------------------------------
// Compute all scores at once
// ---------------------------------------------------------------------------

export function computeAllScores(
  answers: Record<string, QuestionAnswer>
): {
  dimensionScores: Record<string, number>;
  overall: number;
} {
  const dimensionScores: Record<string, number> = {};
  for (const dim of SYSTEM_DIMENSIONS) {
    dimensionScores[dim] = dimensionScore(SYSTEM_QUESTIONS, answers, dim);
  }
  return {
    dimensionScores,
    overall: overallScore(dimensionScores),
  };
}

// ---------------------------------------------------------------------------
// Data Governance scoring (auto-rated from inventory)
// ---------------------------------------------------------------------------

/**
 * Score data governance based on system_data_inventory records.
 * Returns 0 if no inventory, scales up to 100 with:
 *   - PII/sensitive_pii classification present: +25
 *   - Residency set (not 'unknown'): +25
 *   - Retention days set: +25
 *   - Processor documented: +25
 */
export function dataGovernanceScore(
  hasPiiEntry: boolean,
  hasResidency: boolean,
  hasRetention: boolean,
  hasProcessor: boolean
): number {
  let score = 0;
  if (hasPiiEntry) score += 25;
  if (hasResidency) score += 25;
  if (hasRetention) score += 25;
  if (hasProcessor) score += 25;
  return score;
}

// ---------------------------------------------------------------------------
// Fairness & Bias scoring
// ---------------------------------------------------------------------------

/**
 * Score fairness based on assessment status.
 * Returns 0 if no assessment, 33 if warn, 66 if fail, 100 if pass.
 * Also considers metric coverage: full score only if 2+ metric types.
 */
export function fairnessScore(
  overallStatus: string | undefined,
  metricCount: number = 0,
  passCount: number = 0
): number {
  if (!overallStatus || overallStatus === 'draft') return 0;

  const hasMultipleMetricTypes = metricCount >= 2;
  const passRatio = metricCount > 0 ? passCount / metricCount : 0;

  if (overallStatus === 'pass' && hasMultipleMetricTypes) {
    return 100;
  }
  if (overallStatus === 'warn') {
    return Math.round(50 * passRatio);
  }
  if (overallStatus === 'fail') {
    return Math.round(25 * passRatio);
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Risk flags
// ---------------------------------------------------------------------------

export type RiskFlag = {
  code: string;
  label: string;
  description: string;
};

const RISK_FLAG_DEFS: Record<string, RiskFlag> = {
  NO_KILL_SWITCH: {
    code: "NO_KILL_SWITCH",
    label: "No kill switch",
    description:
      "The system lacks a verified kill-switch or pause capability, or the evidence is insufficient.",
  },
  WEAK_AUDIT_LOGGING: {
    code: "WEAK_AUDIT_LOGGING",
    label: "Weak audit logging",
    description:
      "Audit logging maturity is below 'defined', meaning logs may be incomplete or inconsistent.",
  },
  WEAK_TOOL_SANDBOX: {
    code: "WEAK_TOOL_SANDBOX",
    label: "Weak tool sandboxing",
    description:
      "Tool/action sandboxing maturity is below 'enforced', creating privilege escalation risk.",
  },
  NO_THREAT_MODEL: {
    code: "NO_THREAT_MODEL",
    label: "No threat model",
    description:
      "No threat model or risk assessment exists for this system.",
  },
};

export function computeRiskFlags(
  answers: Record<string, QuestionAnswer>
): RiskFlag[] {
  const flags: RiskFlag[] = [];

  // NO_KILL_SWITCH: TXS_HO_03 is "no" or evidence cap < 1.0
  const ho03 = answers["TXS_HO_03"];
  if (ho03) {
    if (ho03.boolean === false || evidenceCap(ho03.evidence) < 1.0) {
      flags.push(RISK_FLAG_DEFS.NO_KILL_SWITCH);
    }
  } else {
    // No answer at all
    flags.push(RISK_FLAG_DEFS.NO_KILL_SWITCH);
  }

  // WEAK_AUDIT_LOGGING: TXS_ACC_02 maturity < "defined"
  const acc02 = answers["TXS_ACC_02"];
  if (acc02) {
    const m = acc02.maturity;
    if (!m || m === "none" || m === "ad_hoc") {
      flags.push(RISK_FLAG_DEFS.WEAK_AUDIT_LOGGING);
    }
  } else {
    flags.push(RISK_FLAG_DEFS.WEAK_AUDIT_LOGGING);
  }

  // WEAK_TOOL_SANDBOX: TXS_RISK_03 maturity < "enforced"
  const risk03 = answers["TXS_RISK_03"];
  if (risk03) {
    const m = risk03.maturity;
    if (!m || m === "none" || m === "ad_hoc" || m === "defined") {
      flags.push(RISK_FLAG_DEFS.WEAK_TOOL_SANDBOX);
    }
  } else {
    flags.push(RISK_FLAG_DEFS.WEAK_TOOL_SANDBOX);
  }

  // NO_THREAT_MODEL: TXS_RISK_01 maturity is "none"
  const risk01 = answers["TXS_RISK_01"];
  if (risk01) {
    if (!risk01.maturity || risk01.maturity === "none") {
      flags.push(RISK_FLAG_DEFS.NO_THREAT_MODEL);
    }
  } else {
    flags.push(RISK_FLAG_DEFS.NO_THREAT_MODEL);
  }

  return flags;
}

// ---------------------------------------------------------------------------
// Incident Readiness (server-side only)
// ---------------------------------------------------------------------------

/**
 * Compute incident readiness score for a system (server-side).
 * - 0 if no playbooks configured in org + no incidents
 * - 50 if playbooks exist but no recent incident playbook runs
 * - 100 if last 3 incidents had playbook runs with 90%+ SLA adherence
 */
export async function computeIncidentReadiness(
  systemId: string,
  orgId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any
): Promise<number> {
  // Get playbook count
  const { count: playbookCount } = await db
    .from("incident_playbooks")
    .select("id", { count: "exact", head: true })
    .eq("organisation_id", orgId);

  if ((playbookCount ?? 0) === 0) {
    // No playbooks = low readiness
    return 0;
  }

  // Get last 3 incidents for this system
  const { data: incidents } = await db
    .from("incidents")
    .select("id")
    .eq("system_id", systemId)
    .eq("organisation_id", orgId)
    .order("created_at", { ascending: false })
    .limit(3);

  if (!incidents || incidents.length === 0) {
    // No incidents but playbooks exist = partial readiness
    return 50;
  }

  // Check playbook run coverage
  const incidentIds = (incidents as Array<{ id: string }>).map((i) => i.id);
  const { data: runs } = await db
    .from("incident_playbook_runs")
    .select("incident_id")
    .in("incident_id", incidentIds);

  const incidentsWithRuns = new Set(((runs ?? []) as Array<{ incident_id: string }>).map((r) => r.incident_id)).size;
  const coverage = incidentsWithRuns / incidents.length;

  if (coverage < 0.67) {
    // < 67% coverage = partial
    return 50;
  }

  // Check SLA adherence on runs with playbooks
  const { data: breaches } = await db
    .from("incidents")
    .select("breach_acknowledge, breach_resolve")
    .in("id", incidentIds)
    .not("playbook_id", "is", null);

  if (!breaches || breaches.length === 0) {
    return 100;
  }

  const breachCount = (breaches as Array<{ breach_acknowledge: boolean; breach_resolve: boolean }>).filter((b) => b.breach_acknowledge || b.breach_resolve).length;
  const adherenceRate = (breaches.length - breachCount) / breaches.length;

  return adherenceRate >= 0.9 ? 100 : 75;
}

// ---------------------------------------------------------------------------
// Shadow AI Coverage (Capability #1)
// ---------------------------------------------------------------------------

/**
 * Score shadow AI coverage based on reviewed sightings in last 90 days.
 * Returns 0 if no sightings reviewed, 50 if partial, 100 if 1+ reviewed recently.
 */
export function shadowAICoverageScore(
  sightingsCount: number,
  sightingsReviewedInLast90Days: number
): number {
  if (sightingsCount === 0) return 0;
  if (sightingsReviewedInLast90Days === 0) return 25;
  if (sightingsReviewedInLast90Days >= 1) return 100;
  return 0;
}

// ---------------------------------------------------------------------------
// Control Coverage (Capability #2)
// ---------------------------------------------------------------------------

/**
 * Score control evidence coverage per framework.
 * Returns % of controls with 1+ evidence link.
 */
export function controlCoverageScore(
  totalControls: number,
  controlsWithEvidence: number
): number {
  if (totalControls === 0) return 0;
  return Math.round((controlsWithEvidence / totalControls) * 100);
}

// ---------------------------------------------------------------------------
// Risk Registry (Capability #3)
// ---------------------------------------------------------------------------

/**
 * Score risk registry completeness.
 * Returns 0 if no risks, 50 if any risk exists without treatment,
 * 100 if 80%+ of risks have treatment + owner + review date.
 */
export function riskRegistryScore(
  totalRisks: number,
  risksWithTreatment: number,
  risksWithOwner: number,
  risksWithReviewDate: number
): number {
  if (totalRisks === 0) return 0;

  // All three attributes required for "complete"
  const fullyDocumented = Math.min(risksWithTreatment, risksWithOwner, risksWithReviewDate);
  const completionRate = fullyDocumented / totalRisks;

  if (completionRate >= 0.8) return 100;
  if (completionRate >= 0.5) return 75;
  if (completionRate >= 0.2) return 50;
  return 25;
}

// ---------------------------------------------------------------------------
// Accountability (Capability #5)
// ---------------------------------------------------------------------------

/**
 * Score accountability completeness per system.
 * Returns 0 if missing Responsible or Accountable,
 * 100 if both roles assigned, 75 if only one.
 */
export function accountabilityScore(
  hasResponsible: boolean,
  hasAccountable: boolean
): number {
  if (!hasResponsible && !hasAccountable) return 0;
  if (hasResponsible && hasAccountable) return 100;
  return 50;
}

// ---------------------------------------------------------------------------
// Explainability (Capability #8)
// ---------------------------------------------------------------------------

/**
 * Score explainability of AI system.
 * Returns 0 if no method, partial if method set + URL,
 * 100 if reviewed within 180 days AND coverage >= 80%.
 */
export function explainabilityScore(
  method: string,
  documentationUrl: string | undefined,
  lastReviewedAt: string | undefined,
  coveragePercent: number
): number {
  if (method === 'none') return 0;

  const hasUrl = !!documentationUrl;
  const now = new Date();
  const reviewDate = lastReviewedAt ? new Date(lastReviewedAt) : null;
  const daysAgo = reviewDate ? Math.floor((now.getTime() - reviewDate.getTime()) / (1000 * 60 * 60 * 24)) : 999;

  if (hasUrl && daysAgo <= 180 && coveragePercent >= 80) {
    return 100;
  }
  if (hasUrl && coveragePercent >= 50) {
    return 75;
  }
  if (hasUrl) {
    return 50;
  }
  return 25;
}
