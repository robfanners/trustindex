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

/** Equal 20% weight per dimension: round(Σ(dimScore × 0.2)) */
export function overallScore(
  dimScores: Record<string, number>
): number {
  let sum = 0;
  for (const dim of SYSTEM_DIMENSIONS) {
    sum += (dimScores[dim] ?? 0) * 0.2;
  }
  return Math.round(sum);
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
