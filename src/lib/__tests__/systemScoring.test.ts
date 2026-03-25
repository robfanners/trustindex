import { describe, it, expect } from "vitest";
import {
  maturityToScore,
  booleanToScore,
  baseScore,
  evidenceCap,
  questionScore,
  dimensionScore,
  overallScore,
  computeAllScores,
  computeRiskFlags,
} from "@/lib/systemScoring";
import { SYSTEM_QUESTIONS } from "@/lib/systemQuestionBank";
import type { QuestionAnswer } from "@/lib/systemQuestionBank";

// ---------------------------------------------------------------------------
// maturityToScore — Maturity level to numeric score
// ---------------------------------------------------------------------------

describe("maturityToScore", () => {
  it("converts maturity levels to scores", () => {
    expect(maturityToScore("none")).toBe(0.0);
    expect(maturityToScore("ad_hoc")).toBe(0.25);
    expect(maturityToScore("defined")).toBe(0.5);
    expect(maturityToScore("enforced")).toBe(0.75);
    expect(maturityToScore("automated")).toBe(1.0);
  });

  it("defaults unknown levels to 0", () => {
    // @ts-expect-error - testing invalid input
    expect(maturityToScore("unknown")).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// booleanToScore — Boolean to numeric score
// ---------------------------------------------------------------------------

describe("booleanToScore", () => {
  it("converts true to 1.0", () => {
    expect(booleanToScore(true)).toBe(1.0);
  });

  it("converts false to 0.0", () => {
    expect(booleanToScore(false)).toBe(0.0);
  });
});

// ---------------------------------------------------------------------------
// baseScore — Answer to raw score (before evidence cap)
// ---------------------------------------------------------------------------

describe("baseScore", () => {
  it("computes score for boolean answers", () => {
    expect(baseScore({ boolean: true, evidence: undefined }, "boolean")).toBe(1.0);
    expect(baseScore({ boolean: false, evidence: undefined }, "boolean")).toBe(0.0);
  });

  it("computes score for maturity answers", () => {
    expect(baseScore({ maturity: "automated", evidence: undefined }, "maturity")).toBe(1.0);
    expect(baseScore({ maturity: "none", evidence: undefined }, "maturity")).toBe(0.0);
  });

  it("returns 0 for missing answers", () => {
    expect(baseScore({}, "boolean")).toBe(0);
    expect(baseScore({}, "maturity")).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// evidenceCap — Evidence strength to multiplier cap
// ---------------------------------------------------------------------------

describe("evidenceCap", () => {
  it("caps at 0.4 when no evidence provided", () => {
    expect(evidenceCap(undefined)).toBe(0.4);
  });

  it("caps at 1.0 for strong evidence with pointer", () => {
    expect(evidenceCap({ type: "link", pointer: "https://example.com" })).toBe(1.0);
    expect(evidenceCap({ type: "ticket_ref", pointer: "TICK-123" })).toBe(1.0);
    expect(evidenceCap({ type: "log_ref", pointer: "log-id" })).toBe(1.0);
    expect(evidenceCap({ type: "runbook_ref", pointer: "runbook-id" })).toBe(1.0);
    expect(evidenceCap({ type: "policy_ref", pointer: "policy-id" })).toBe(1.0);
  });

  it("caps at 0.6 for weak evidence (no pointer)", () => {
    expect(evidenceCap({ type: "link", pointer: "" })).toBe(0.6);
    expect(evidenceCap({ type: "link", pointer: "   " })).toBe(0.6);
    expect(evidenceCap({ type: "document_ref", pointer: undefined })).toBe(0.6);
  });

  it("caps at 0.6 for document_ref regardless of pointer", () => {
    expect(evidenceCap({ type: "document_ref", pointer: "doc-id" })).toBe(0.6);
    expect(evidenceCap({ type: "document_ref", pointer: "" })).toBe(0.6);
  });
});

// ---------------------------------------------------------------------------
// questionScore — Final score after evidence cap
// ---------------------------------------------------------------------------

describe("questionScore", () => {
  it("applies evidence cap to base score", () => {
    // Base 1.0 × cap 0.4 = 0.4
    expect(questionScore({ boolean: true, evidence: undefined }, "boolean")).toBe(0.4);

    // Base 1.0 × cap 1.0 = 1.0
    expect(
      questionScore(
        { boolean: true, evidence: { type: "link", pointer: "http://example.com" } },
        "boolean"
      )
    ).toBe(1.0);

    // Base 0.5 × cap 0.6 = 0.3
    expect(
      questionScore(
        { maturity: "defined", evidence: { type: "document_ref", pointer: "doc" } },
        "maturity"
      )
    ).toBe(0.3);
  });

  it("handles empty answers", () => {
    expect(questionScore({}, "boolean")).toBe(0);
    expect(questionScore({}, "maturity")).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// dimensionScore — Weighted average for a dimension
// ---------------------------------------------------------------------------

describe("dimensionScore", () => {
  it("computes weighted average of questions in a dimension", () => {
    const answers: Record<string, QuestionAnswer> = {
      "TXS_GOV_01": { boolean: true, evidence: { type: "link", pointer: "url" } },
      "TXS_GOV_02": { boolean: false, evidence: undefined },
    };

    // Both answers exist, scores will be weighted and multiplied by 100
    const score = dimensionScore(SYSTEM_QUESTIONS, answers, "governance");
    expect(typeof score).toBe("number");
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("returns 0 when no answers for dimension", () => {
    const score = dimensionScore(SYSTEM_QUESTIONS, {}, "governance");
    expect(score).toBe(0);
  });

  it("rounds result to integer", () => {
    const answers: Record<string, QuestionAnswer> = {};
    for (const q of SYSTEM_QUESTIONS.filter((q) => q.dimension === "governance").slice(0, 2)) {
      answers[q.id] = { maturity: "enforced", evidence: { type: "link", pointer: "url" } };
    }
    const score = dimensionScore(SYSTEM_QUESTIONS, answers, "governance");
    expect(Number.isInteger(score)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// overallScore — Equal weight for all dimensions
// ---------------------------------------------------------------------------

describe("overallScore", () => {
  it("computes 20% average of all dimensions", () => {
    const dimScores = {
      governance: 80,
      transparency: 70,
      accountability: 60,
      safety: 50,
      fairness: 40,
    };
    // (80 + 70 + 60 + 50 + 40) × 0.2 = 60
    expect(overallScore(dimScores)).toBe(60);
  });

  it("handles missing dimensions as 0", () => {
    const dimScores = {
      governance: 100,
      transparency: 100,
      accountability: 0,
      safety: 0,
      fairness: 0,
    };
    // (100 + 100 + 0 + 0 + 0) × 0.2 = 40
    expect(overallScore(dimScores)).toBe(40);
  });

  it("returns 0 when all dimensions are 0", () => {
    const dimScores = {
      governance: 0,
      transparency: 0,
      accountability: 0,
      safety: 0,
      fairness: 0,
    };
    expect(overallScore(dimScores)).toBe(0);
  });

  it("returns 100 when all dimensions are 100", () => {
    const dimScores = {
      governance: 100,
      transparency: 100,
      accountability: 100,
      safety: 100,
      fairness: 100,
    };
    expect(overallScore(dimScores)).toBe(100);
  });

  it("rounds result to integer", () => {
    const dimScores = {
      governance: 33,
      transparency: 33,
      accountability: 33,
      safety: 33,
      fairness: 33,
    };
    expect(Number.isInteger(overallScore(dimScores))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// computeAllScores — Full pipeline
// ---------------------------------------------------------------------------

describe("computeAllScores", () => {
  it("computes both dimension and overall scores", () => {
    const answers: Record<string, QuestionAnswer> = {};
    for (const q of SYSTEM_QUESTIONS.slice(0, 5)) {
      answers[q.id] = { maturity: "enforced", evidence: { type: "link", pointer: "url" } };
    }

    const result = computeAllScores(answers);
    expect(result.dimensionScores).toBeDefined();
    expect(result.overall).toBeDefined();
    expect(typeof result.overall).toBe("number");
    expect(result.overall).toBeGreaterThanOrEqual(0);
    expect(result.overall).toBeLessThanOrEqual(100);
  });

  it("returns 0 scores for empty answers", () => {
    const result = computeAllScores({});
    expect(result.overall).toBe(0);
    for (const dimScore of Object.values(result.dimensionScores)) {
      expect(dimScore).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// computeRiskFlags — Identify risk areas
// ---------------------------------------------------------------------------

describe("computeRiskFlags", () => {
  it("detects NO_KILL_SWITCH when TXS_HO_03 is false", () => {
    const answers: Record<string, QuestionAnswer> = {
      "TXS_HO_03": { boolean: false, evidence: undefined },
    };
    const flags = computeRiskFlags(answers);
    expect(flags.some((f) => f.code === "NO_KILL_SWITCH")).toBe(true);
  });

  it("detects NO_KILL_SWITCH when TXS_HO_03 is missing", () => {
    const answers: Record<string, QuestionAnswer> = {};
    const flags = computeRiskFlags(answers);
    expect(flags.some((f) => f.code === "NO_KILL_SWITCH")).toBe(true);
  });

  it("detects WEAK_AUDIT_LOGGING when TXS_ACC_02 is below 'defined'", () => {
    const answers: Record<string, QuestionAnswer> = {
      "TXS_ACC_02": { maturity: "ad_hoc", evidence: undefined },
    };
    const flags = computeRiskFlags(answers);
    expect(flags.some((f) => f.code === "WEAK_AUDIT_LOGGING")).toBe(true);
  });

  it("detects WEAK_TOOL_SANDBOX when TXS_RISK_03 is below 'enforced'", () => {
    const answers: Record<string, QuestionAnswer> = {
      "TXS_RISK_03": { maturity: "defined", evidence: undefined },
    };
    const flags = computeRiskFlags(answers);
    expect(flags.some((f) => f.code === "WEAK_TOOL_SANDBOX")).toBe(true);
  });

  it("detects NO_THREAT_MODEL when TXS_RISK_01 is 'none' or missing", () => {
    const answers: Record<string, QuestionAnswer> = {
      "TXS_RISK_01": { maturity: "none", evidence: undefined },
    };
    const flags = computeRiskFlags(answers);
    expect(flags.some((f) => f.code === "NO_THREAT_MODEL")).toBe(true);
  });

  it("returns empty array for well-controlled system", () => {
    const answers: Record<string, QuestionAnswer> = {
      "TXS_HO_03": { boolean: true, evidence: { type: "link", pointer: "url" } },
      "TXS_ACC_02": { maturity: "enforced", evidence: { type: "link", pointer: "url" } },
      "TXS_RISK_03": { maturity: "enforced", evidence: { type: "link", pointer: "url" } },
      "TXS_RISK_01": { maturity: "enforced", evidence: { type: "link", pointer: "url" } },
    };
    const flags = computeRiskFlags(answers);
    expect(flags.length).toBe(0);
  });

  it("all flags have required fields", () => {
    const answers: Record<string, QuestionAnswer> = {};
    const flags = computeRiskFlags(answers);
    for (const flag of flags) {
      expect(flag.code).toBeDefined();
      expect(flag.label).toBeDefined();
      expect(flag.description).toBeDefined();
    }
  });
});
